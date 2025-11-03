import json
import os

import httpx
from agents import Runner, trace
from custom_agents.ticket_maintenance_agent import ticket_maintenance_agent
from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException, Request
from fastapi.encoders import jsonable_encoder  # << NEU
from fastapi.responses import JSONResponse
from models import UserContext
from pydantic import BaseModel  # << optional für isinstance-Check

load_dotenv(override=True)

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

router = APIRouter()


@router.post("/")
async def get_ticket_maintenance_endpoint(request: Request):
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
        {
            "role": "user",
            "content": "Sorge für Ticket Maintenance im aktuellen Projekt.",
        },
    ]

    try:
        with trace("Ticket Maintenance"):
            run_result = await Runner.run(
                ticket_maintenance_agent,
                messages,
                context=user_context,
                max_turns=20,
            )

        # SDK-kompatibel final_output / output
        output = getattr(run_result, "final_output", None)
        print("raw final_output:", output, type(output))
        if callable(output):
            output = await output()
            # print("awaited final_output:", output, type(output))
        if output is None:
            output = getattr(run_result, "output", None)
            # print("fallback output:", output, type(output))

        # --- Robust serialisieren ---
        # Fall A: Agent liefert String mit JSON
        if isinstance(output, str):
            try:
                output = json.loads(output)
            except json.JSONDecodeError:
                # als plain string zurückgeben, eingepackt
                output = {"ok": True, "result": output}

        # Fall B: Agent liefert Pydantic-Model oder beliebiges Objekt
        payload = jsonable_encoder(output)  # macht dict/list/Model JSON-fähig

        return JSONResponse(payload)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Ticket-Maintenance fehlgeschlagen: {e}"
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
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{SUPABASE_URL}/rest/v1/jira_connections?user_id=eq.{user_id}",
            headers={
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {SUPABASE_KEY}",
                "Accept": "application/json",
            },
        )
        response.raise_for_status()
        data = response.json()
        if not data:
            raise HTTPException(status_code=404, detail="Kein Jira-Zugang gefunden")
        return data[0]


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
