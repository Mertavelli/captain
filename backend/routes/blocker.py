import os
import time

import httpx
from agents import Runner, trace
from custom_agents.blocker_agent import blocker_agent  # output_type = List[BlockerItem]
from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from models import UserContext

load_dotenv(override=True)

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
JIRA_CLIENT_ID = os.getenv("JIRA_CLIENT_ID")
JIRA_CLIENT_SECRET = os.getenv("JIRA_CLIENT_SECRET")

router = APIRouter()


@router.post("/")
async def get_blockers_endpoint(request: Request):
    body = await request.json()
    # ---- Payload robust lesen ----
    user_id = (body.get("user") or {}).get("id") or body.get("user_id")
    captain_id = body.get("captain_id") or (body.get("captain") or {}).get("id")

    if not user_id:
        raise HTTPException(status_code=400, detail="user.id fehlt")
    if not captain_id:
        raise HTTPException(status_code=400, detail="captain_id fehlt")

    # ---- Captain lesen: jira_project_key + channels ----
    captain = await get_captain(captain_id)
    jira_project_key = captain.get("jira_project_key")
    channels = captain.get("channels") or []

    # Fallback: wenn jemand noch project.key mitsendet (alt)
    if not jira_project_key:
        jira_project_key = (body.get("project") or {}).get("key")
    if not jira_project_key:
        raise HTTPException(status_code=400, detail="jira_project_key am Captain fehlt")

    # ---- Verbindungen laden ----
    jira_connection = await get_jira_credentials(user_id)
    slack_connection = await get_slack_credentials(user_id)

    # ---- Kontext für Agent ----
    user_context = UserContext(
        jira_email=jira_connection["email"],
        jira_url=jira_connection["jira_url"],
        jira_token=jira_connection["access_token"],
        jira_cloudId=jira_connection["cloud_id"],
        jira_project_key=jira_project_key,
        slack_token=slack_connection["access_token"],
        channels=channels,
    )

    messages = [
        {"role": "system", "content": f"Projekt-Key: {jira_project_key}"},
        {"role": "user", "content": "Analysiere Blocker im aktuellen Projekt."},
    ]

    try:
        with trace("Blocker"):
            run_result = await Runner.run(
                blocker_agent,
                messages,
                context=user_context,
                max_turns=40,
            )

        # SDK-kompatibel final_output / output
        output = getattr(run_result, "final_output", None)
        if callable(output):
            output = await output()
        if output is None:
            output = getattr(run_result, "output", None)

        payload = {
            "blockers": [
                (b.model_dump() if hasattr(b, "model_dump") else b)
                for b in (output if isinstance(output, list) else [])
            ]
        }
        return JSONResponse(payload)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Blocker-Analyse fehlgeschlagen: {e}"
        )


# ---------- Supabase Helfer ----------


async def get_captain(captain_id: str) -> dict:
    async with httpx.AsyncClient() as client:
        r = await client.get(
            f"{SUPABASE_URL}/rest/v1/captains?id=eq.{captain_id}&select=jira_project_key,channels",
            headers={
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {SUPABASE_KEY}",
                "Accept": "application/json",
            },
        )
        r.raise_for_status()
        data = r.json()
        if not data:
            raise HTTPException(status_code=404, detail="Captain nicht gefunden")
        return data[0]


async def get_jira_credentials(user_id: str):
    async with httpx.AsyncClient(timeout=15.0) as client:
        # 1) Erstmal alle Spalten holen, damit es nicht an "select=" scheitert
        url = f"{SUPABASE_URL}/rest/v1/jira_connections"
        params = {
            "user_id": f"eq.{user_id}",
            "select": "*",  # << wichtig: keine Spaltenliste erzwingen
        }
        headers = {
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Accept": "application/json",
        }
        r = await client.get(url, headers=headers, params=params)

        if r.status_code != 200:
            # Supabase-Fehlertext mit zurückgeben -> sagt dir exakt, welche Spalte fehlt
            raise HTTPException(
                status_code=502,
                detail=f"Supabase jira_connections Fehler {r.status_code}: {r.text}",
            )

        rows = r.json()
        if not rows:
            raise HTTPException(status_code=404, detail="Kein Jira-Zugang gefunden")

        row = rows[0]

    # 2) Felder normalisieren (falls deine DB andere Namen nutzt)
    #    Passe die Alternativen einfach an deine tatsächlichen Spalten an:
    def pick(d, *keys, default=None):
        for k in keys:
            if k in d and d[k] is not None:
                return d[k]
        return default

    normalized = {
        "user_id": pick(row, "user_id", "userId"),
        "email": pick(row, "email", "jira_email"),
        "jira_url": pick(row, "jira_url", "base_url", "jiraBaseUrl"),
        "access_token": pick(row, "access_token", "accessToken"),
        "refresh_token": pick(row, "refresh_token", "refreshToken"),
        "expires_at": pick(row, "expires_at", "expiresAt", "expires_at_epoch"),
        "cloud_id": pick(row, "cloud_id", "cloudId"),
    }

    # 3) Minimalvalidierung
    for req in ("email", "jira_url", "access_token", "cloud_id"):
        if not normalized.get(req):
            raise HTTPException(
                status_code=500, detail=f"Jira-Creds unvollständig: Feld '{req}' fehlt"
            )

    # 4) Optional: Token-Refresh (nur, wenn du refresh_token + expires_at wirklich speicherst)
    if normalized.get("refresh_token") and normalized.get("expires_at"):
        normalized = await _refresh_jira_token_if_needed(normalized)

    return normalized


async def _refresh_jira_token_if_needed(conn: dict) -> dict:
    # Wenn du (noch) kein Refresh willst, kommentiere diese Funktion einfach aus.
    try:
        # expires_at kann ISO oder epoch sein
        exp = conn["expires_at"]
        if isinstance(exp, str):
            from datetime import datetime, timezone

            exp_epoch = int(
                datetime.fromisoformat(exp.replace("Z", ""))
                .replace(tzinfo=timezone.utc)
                .timestamp()
            )
        else:
            exp_epoch = int(exp)
        now = int(time.time())
        if exp_epoch - now > 60:
            return conn  # noch gültig

        # Refresh nötig
        if not JIRA_CLIENT_ID or not JIRA_CLIENT_SECRET:
            raise HTTPException(
                status_code=500, detail="Jira OAuth Client-ID/Secret fehlen für Refresh"
            )

        token_url = "https://auth.atlassian.com/oauth/token"
        payload = {
            "grant_type": "refresh_token",
            "client_id": JIRA_CLIENT_ID,
            "client_secret": JIRA_CLIENT_SECRET,
            "refresh_token": conn["refresh_token"],
        }
        async with httpx.AsyncClient(timeout=20.0) as client:
            r = await client.post(
                token_url, json=payload, headers={"Accept": "application/json"}
            )
        if r.status_code != 200:
            raise HTTPException(
                status_code=401, detail=f"Jira-Refresh fehlgeschlagen: {r.text}"
            )

        data = r.json()
        new_access = data.get("access_token")
        new_refresh = data.get("refresh_token", conn["refresh_token"])
        expires_in = int(data.get("expires_in", 0))
        if not new_access or not expires_in:
            raise HTTPException(
                status_code=401, detail="Jira-Refresh: unvollständige Antwort"
            )

        conn["access_token"] = new_access
        conn["refresh_token"] = new_refresh
        conn["expires_at"] = int(time.time()) + expires_in

        # In Supabase persistieren (Passe Spaltennamen an deine Tabelle an)
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.patch(
                f"{SUPABASE_URL}/rest/v1/jira_connections?user_id=eq.{conn['user_id']}",
                headers={
                    "apikey": SUPABASE_KEY,
                    "Authorization": f"Bearer {SUPABASE_KEY}",
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                    "Prefer": "return=representation",
                },
                json={
                    "access_token": conn["access_token"],
                    "refresh_token": conn["refresh_token"],
                    "expires_at": conn["expires_at"],
                },
            )
        if r.status_code not in (200, 204):
            raise HTTPException(
                status_code=502,
                detail=f"Supabase-Update jira_tokens fehlgeschlagen: {r.text}",
            )

        return conn
    except HTTPException:
        raise
    except Exception as e:
        # Sei konservativ: lieber mit altem Token weiter, als hart 500 (du siehst den Fehler im Log)
        # Wenn du strikt sein willst, ersetze die nächste Zeile durch: raise HTTPException(500, f"Refresh-Fehler: {e}")
        print("Jira Refresh Warnung:", e)
        return conn


async def get_slack_credentials(user_id: str):
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{SUPABASE_URL}/rest/v1/slack_connections?user_id=eq.{user_id}",
            headers={
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {SUPABASE_KEY}",
                "Accept": "application/json",
            },
        )
        response.raise_for_status()
        data = response.json()
        if not data:
            raise HTTPException(status_code=404, detail="Kein Slack-Zugang gefunden")
        return data[0]


async def refresh_jira_token_if_needed(conn_row: dict) -> dict:
    """
    Erwartet eine Zeile aus 'jira_connections' mit:
    - access_token
    - refresh_token
    - expires_at  (Unix seconds ODER ISO-String)
    - cloud_id, email, jira_url (werden unverändert zurückgegeben)
    Wenn der Token in <=60s abläuft/abgelaufen ist, wird er via refresh_token erneuert
    und in Supabase persistiert. Gibt IMMER die (ggf. aktualisierte) Row zurück.
    """
    access_token = conn_row.get("access_token")
    refresh_token = conn_row.get("refresh_token")
    expires_at = conn_row.get("expires_at")
    if not access_token or not refresh_token or not expires_at:
        # Falls du noch kein Refresh implementiert hast: sauberer Fehler
        raise HTTPException(
            status_code=401, detail="Jira-Token unvollständig (kein Refresh möglich)"
        )

    # expires_at normalisieren → epoch seconds
    if isinstance(expires_at, str):
        try:
            # ISO → epoch
            from datetime import datetime, timezone

            expires_epoch = int(
                datetime.fromisoformat(expires_at.replace("Z", ""))
                .replace(tzinfo=timezone.utc)
                .timestamp()
            )
        except Exception:
            # Fallback: evtl. schon epoch-String
            expires_epoch = int(expires_at)
    else:
        expires_epoch = int(expires_at)

    now = int(time.time())
    # 60s Puffer
    if expires_epoch - now > 60:
        return conn_row  # noch gültig

    # === Refresh ===
    if not JIRA_CLIENT_ID or not JIRA_CLIENT_SECRET:
        raise HTTPException(
            status_code=500, detail="Jira OAuth Client-ID/Secret fehlen"
        )

    token_url = "https://auth.atlassian.com/oauth/token"
    payload = {
        "grant_type": "refresh_token",
        "client_id": JIRA_CLIENT_ID,
        "client_secret": JIRA_CLIENT_SECRET,
        "refresh_token": refresh_token,
    }

    async with httpx.AsyncClient(timeout=20.0) as client:
        r = await client.post(
            token_url, json=payload, headers={"Accept": "application/json"}
        )
    if r.status_code != 200:
        # Refresh fehlgeschlagen → 401, damit Frontend ggf. Re-Auth triggern kann
        raise HTTPException(
            status_code=401, detail=f"Jira-Refresh fehlgeschlagen: {r.text}"
        )

    data = r.json()
    new_access = data.get("access_token")
    new_refresh = data.get(
        "refresh_token", refresh_token
    )  # Atlassian liefert nicht immer einen neuen RT
    expires_in = data.get("expires_in")  # Sekunden
    if not new_access or not expires_in:
        raise HTTPException(
            status_code=401, detail="Jira-Refresh: unvollständige Antwort"
        )

    new_expires_epoch = int(time.time()) + int(expires_in)

    # In Supabase speichern
    await update_jira_tokens_in_supabase(
        conn_row["user_id"],  # Stelle sicher, dass du user_id im Row-Select holst
        access_token=new_access,
        refresh_token=new_refresh,
        expires_at=new_expires_epoch,
    )

    # aktualisierte Row zurückgeben
    conn_row["access_token"] = new_access
    conn_row["refresh_token"] = new_refresh
    conn_row["expires_at"] = new_expires_epoch
    return conn_row


async def update_jira_tokens_in_supabase(
    user_id: str, access_token: str, refresh_token: str, expires_at: int
):
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.patch(
            f"{SUPABASE_URL}/rest/v1/jira_connections?user_id=eq.{user_id}",
            headers={
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {SUPABASE_KEY}",
                "Accept": "application/json",
                "Content-Type": "application/json",
                "Prefer": "return=representation",
            },
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
