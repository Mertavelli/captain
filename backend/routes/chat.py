import asyncio
import json
import logging
import os
import time
from datetime import datetime, timezone
from typing import Any, Dict, Optional

import httpx
from agents import Runner, trace
from custom_agents.chat_agent import chat_agent
from custom_agents.planner_agent import planner_agent
from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from models import UserContext
from openai import APIError, APITimeoutError, InternalServerError, RateLimitError
from openai.types.responses import ResponseTextDeltaEvent

load_dotenv(override=True)

logger = logging.getLogger(__name__)
router = APIRouter()

# --- Env ---
SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
JIRA_CLIENT_ID = os.getenv("JIRA_CLIENT_ID")
JIRA_CLIENT_SECRET = os.getenv("JIRA_CLIENT_SECRET")

# --- Streaming / Retry Settings ---
RETRIABLE = (InternalServerError, APITimeoutError)
NONFATAL = (RateLimitError,)
PLAIN_HEARTBEAT_BYTES = b"\n"  # text/plain flush
HEARTBEAT_INTERVAL_S = 20


# =========================
# Helpers
# =========================
def _pick(d: Dict[str, Any], *keys: str, default: Any = None) -> Any:
    for k in keys:
        if k in d and d[k] is not None:
            return d[k]
    return default


def _to_epoch(value: Any) -> Optional[int]:
    """Accepts ISO string or epoch-like; returns epoch seconds or None."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return int(value)
    if isinstance(value, str):
        try:
            # ISO 8601 (strip trailing Z if present)
            return int(
                datetime.fromisoformat(value.replace("Z", ""))
                .replace(tzinfo=timezone.utc)
                .timestamp()
            )
        except Exception:
            try:
                return int(value)
            except Exception:
                return None
    return None


async def _guarded_stream(iter_events, *, max_attempts: int = 2):
    attempt = 0
    last_beat = time.monotonic()

    while True:
        try:
            async for event in iter_events():
                now = time.monotonic()
                if now - last_beat >= HEARTBEAT_INTERVAL_S:
                    yield PLAIN_HEARTBEAT_BYTES
                    last_beat = now

                if event.type == "raw_response_event" and isinstance(
                    event.data, ResponseTextDeltaEvent
                ):
                    delta = event.data.delta
                    if isinstance(delta, str):
                        delta = delta.encode("utf-8")
                    yield delta
            return

        except asyncio.CancelledError:
            logger.info("stream cancelled by client")
            return

        except RETRIABLE as e:
            attempt += 1
            rid = getattr(e, "request_id", None)
            logger.warning(
                "retriable upstream error (%s) rid=%s attempt=%d/%d",
                type(e).__name__,
                rid,
                attempt,
                max_attempts,
            )
            if attempt >= max_attempts:
                msg = f"\n[error] upstream temporarily unavailable (request_id={rid})\n"
                yield msg.encode("utf-8")
                return
            await asyncio.sleep(0.8 * (2 ** (attempt - 1)))
            continue

        except (APIError, *NONFATAL) as e:
            rid = getattr(e, "request_id", None)
            code = getattr(e, "status_code", None)
            logger.error("openai api error status=%s rid=%s msg=%s", code, rid, str(e))
            msg = f"\n[error] {str(e)} (status={code}, request_id={rid})\n"
            yield msg.encode("utf-8")
            return

        except Exception:
            logger.exception("unhandled error in stream")
            yield b"\n[error] unexpected server error\n"
            return


# =========================
# Supabase fetchers
# =========================
COMMON_HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Accept": "application/json",
}


async def get_captain_meta(captain_id: str) -> dict:
    """Holt Meta-Infos zum Captain (jira_project_key, channels)."""
    async with httpx.AsyncClient(timeout=httpx.Timeout(10.0)) as client:
        resp = await client.get(
            f"{SUPABASE_URL}/rest/v1/captains",
            headers=COMMON_HEADERS,
            params={"id": f"eq.{captain_id}", "select": "jira_project_key,channels"},
        )
        resp.raise_for_status()
        rows = resp.json()
        return rows[0] if rows else {}


async def update_jira_tokens_in_supabase(
    user_id: str, access_token: str, refresh_token: str, expires_at: int
):
    async with httpx.AsyncClient(timeout=httpx.Timeout(15.0)) as client:
        r = await client.patch(
            f"{SUPABASE_URL}/rest/v1/jira_connections",
            headers={
                **COMMON_HEADERS,
                "Content-Type": "application/json",
                "Prefer": "return=representation",
            },
            params={"user_id": f"eq.{user_id}"},
            json={
                "access_token": access_token,
                "refresh_token": refresh_token,
                "expires_at": expires_at,
            },
        )
        if r.status_code not in (200, 204):
            raise HTTPException(
                status_code=502,
                detail=f"Supabase-Update jira_tokens fehlgeschlagen: {r.text}",
            )


async def _refresh_jira_token_if_needed(conn: dict) -> dict:
    """
    Erwartet normalisierte Felder:
      user_id, access_token, refresh_token, expires_at (epoch), cloud_id, email, jira_url
    Refresht, wenn Laufzeit <= 60s. Persistiert neue Tokens in Supabase.
    """
    access = conn.get("access_token")
    refresh = conn.get("refresh_token")
    exp_epoch = _to_epoch(conn.get("expires_at"))

    if not access or not refresh or exp_epoch is None:
        # ohne vollständige Infos kein Refresh möglich
        return conn

    if exp_epoch - int(time.time()) > 60:
        return conn  # noch gültig

    if not JIRA_CLIENT_ID or not JIRA_CLIENT_SECRET:
        raise HTTPException(
            status_code=500, detail="Jira OAuth Client-ID/Secret fehlen für Refresh"
        )

    token_url = "https://auth.atlassian.com/oauth/token"
    payload = {
        "grant_type": "refresh_token",
        "client_id": JIRA_CLIENT_ID,
        "client_secret": JIRA_CLIENT_SECRET,
        "refresh_token": refresh,
    }

    async with httpx.AsyncClient(timeout=httpx.Timeout(20.0)) as client:
        r = await client.post(
            token_url, json=payload, headers={"Accept": "application/json"}
        )
    if r.status_code != 200:
        raise HTTPException(
            status_code=401, detail=f"Jira-Refresh fehlgeschlagen: {r.text}"
        )

    data = r.json()
    new_access = data.get("access_token")
    new_refresh = data.get(
        "refresh_token", refresh
    )  # Atlassian liefert nicht immer einen neuen RT
    expires_in = int(data.get("expires_in", 0))
    if not new_access or not expires_in:
        raise HTTPException(
            status_code=401, detail="Jira-Refresh: unvollständige Antwort"
        )

    new_exp = int(time.time()) + expires_in
    # persistieren
    await update_jira_tokens_in_supabase(
        conn["user_id"], new_access, new_refresh, new_exp
    )

    conn["access_token"] = new_access
    conn["refresh_token"] = new_refresh
    conn["expires_at"] = new_exp
    return conn


async def get_jira_credentials(user_id: str) -> dict:
    """
    Lädt *eine* Zeile aus jira_connections für user_id, normalisiert Felder
    und sorgt dafür, dass access_token garantiert aktuell ist (Refresh falls nötig).
    Rückgabe enthält immer: user_id, email, jira_url, access_token, refresh_token?,
    expires_at (epoch), cloud_id.
    """
    async with httpx.AsyncClient(timeout=httpx.Timeout(10.0)) as client:
        r = await client.get(
            f"{SUPABASE_URL}/rest/v1/jira_connections",
            headers=COMMON_HEADERS,
            params={"user_id": f"eq.{user_id}", "select": "*"},
        )
        r.raise_for_status()
        rows = r.json()
        if not rows:
            raise HTTPException(status_code=404, detail="Kein Jira-Zugang gefunden")
        row = rows[0]

    normalized = {
        "user_id": _pick(row, "user_id", "userId"),
        "email": _pick(row, "email", "jira_email"),
        "jira_url": _pick(row, "jira_url", "base_url", "jiraBaseUrl"),
        "access_token": _pick(row, "access_token", "accessToken"),
        "refresh_token": _pick(row, "refresh_token", "refreshToken"),
        "expires_at": _to_epoch(
            _pick(row, "expires_at", "expiresAt", "expires_at_epoch")
        ),
        "cloud_id": _pick(row, "cloud_id", "cloudId"),
    }

    # Minimal-Check (Access/Cloud/URL/Email sind nötig für Upstream-Calls)
    for req in ("email", "jira_url", "access_token", "cloud_id"):
        if not normalized.get(req):
            raise HTTPException(
                status_code=500, detail=f"Jira-Creds unvollständig: Feld '{req}' fehlt"
            )

    # Refresh bei Bedarf
    normalized = await _refresh_jira_token_if_needed(normalized)
    return normalized


async def get_slack_credentials(user_id: str) -> dict:
    async with httpx.AsyncClient(timeout=httpx.Timeout(10.0)) as client:
        resp = await client.get(
            f"{SUPABASE_URL}/rest/v1/slack_connections",
            headers=COMMON_HEADERS,
            params={"user_id": f"eq.{user_id}", "select": "*"},
        )
        resp.raise_for_status()
        rows = resp.json()
        if not rows:
            raise HTTPException(status_code=404, detail="Kein Slack-Zugang gefunden")
        return rows[0]


# =========================
# API Route
# =========================
@router.post("/")
async def create_chat_endpoint(request: Request):
    body = await request.json()

    messages = body.get("messages", [])
    captain = body.get("captain", {}) or {}
    user_id = body.get("user", {}).get("id")

    # captain basics
    captain_id = captain.get("id")
    captain_connections = captain.get("connections", []) or []
    channels = captain.get("channels") or []

    # Jira Project Key ggf. aus DB nachladen
    jira_project_key = captain.get("jira_project_key") or None
    if captain_id and (not jira_project_key or not channels):
        try:
            meta = await get_captain_meta(captain_id)
            jira_project_key = jira_project_key or meta.get("jira_project_key")
            channels = channels or (meta.get("channels") or [])
        except Exception as e:
            logger.warning("[chat] get_captain_meta failed: %s", e)

    # --- Jira Credentials laden (inkl. Auto-Refresh) ---
    jira_email = jira_url = jira_token = jira_cloudId = None
    if "jira" in captain_connections and user_id:
        try:
            jira_conn = await get_jira_credentials(user_id)
            jira_email = jira_conn.get("email")
            jira_url = jira_conn.get("jira_url")
            jira_token = jira_conn.get("access_token")  # ← garantiert frisch
            jira_cloudId = jira_conn.get("cloud_id")
        except HTTPException as e:
            # durchreichen – Frontend kann reauth triggern
            raise
        except Exception as e:
            logger.exception("[chat] get_jira_credentials failed")
            raise HTTPException(status_code=500, detail=f"Jira Credentials Fehler: {e}")

    # --- Slack optional ---
    slack_token = None
    if "slack" in captain_connections and user_id:
        try:
            slack_row = await get_slack_credentials(user_id)
            slack_token = slack_row.get("access_token")
        except HTTPException:
            raise
        except Exception as e:
            logger.warning("[chat] get_slack_credentials failed: %s", e)

    # System-Kontext
    system_message = {
        "role": "system",
        "content": (
            f"Du bist ein AI-Mitarbeiter mit folgendem Kontext:\n"
            f"- Name: {captain.get('name')}\n"
            f"- Rolle: {captain.get('role')}\n"
            f"- Beschreibung: {captain.get('description') or 'Keine Beschreibung'}\n"
            f"- Verbundene Tools: {', '.join(captain_connections) or 'Keine'}\n"
            f"- Jira Project Key: {jira_project_key or 'unbekannt'}"
        ),
    }

    user_context = UserContext(
        jira_email=jira_email,
        jira_url=jira_url,
        jira_token=jira_token,  # ← frisch
        jira_cloudId=jira_cloudId,
        jira_project_key=jira_project_key,
        slack_token=slack_token,
        channels=channels,
        captain_id=captain_id,
    )

    full_messages = [system_message] + messages

    with trace("Chat"):
        result = Runner.run_streamed(
            planner_agent, full_messages, context=user_context, max_turns=20
        )

    async def _iter_events():
        async for ev in result.stream_events():
            yield ev

    async def event_generator():
        async for chunk in _guarded_stream(_iter_events):
            yield chunk
            await asyncio.sleep(0)

    headers = {
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    }

    return StreamingResponse(
        event_generator(), media_type="text/plain", headers=headers
    )
