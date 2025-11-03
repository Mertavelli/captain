import os

import httpx
from agents import Runner, trace
from custom_agents.tasks_agent import tasks_agent
from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from models import UserContext

load_dotenv(override=True)

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

router = APIRouter()


@router.post("/")
async def tasks_endpoint(request: Request):
    body = await request.json()
    user_id = body.get("user_id")
    captain_id = body.get("captain_id")

    if not user_id or not captain_id:
        raise HTTPException(
            status_code=400, detail="user_id und captain_id sind erforderlich"
        )

    # Der Agent hat schon feste Instruktionen; Prompt kann minimal bleiben
    messages = [
        {"role": "user", "content": "Analysiere Issues und liefere Task-Vorschläge."},
    ]

    context = UserContext(user_id=user_id, captain_id=captain_id)

    try:
        with trace("Tasks"):
            run_result = await Runner.run(
                tasks_agent,
                messages,
                context=context,
                max_turns=4,  # 1 Tool-Call + Antwort reicht
            )

        output = getattr(run_result, "final_output", None)
        if callable(output):
            output = await output()

        # Pydantic-Listen sauber serialisieren
        if isinstance(output, list):
            try:
                # Falls Elemente Pydantic-Modelle sind
                output = [getattr(x, "model_dump", lambda: x)() for x in output]
            except Exception:
                # Wenn bereits dicts
                pass

        if output is None:
            output = []  # gemäß Agent-Contract: leere Liste bei keinen Tasks

        # ---------- NEU: Tasks in Supabase speichern (Upsert) ----------
        if output:
            # Map auf DB-Spalten
            tasks_payload = []
            for t in output:
                # minimaler Schutz: nur valide Vorschläge nehmen
                if not all(
                    k in t
                    for k in (
                        "issue_key",
                        "title",
                        "reason",
                        "description",
                        "priority",
                        "plan",
                    )
                ):
                    continue
                tasks_payload.append(
                    {
                        "captain_id": captain_id,
                        "issue_key": t["issue_key"],
                        "title": t["title"],
                        "reason": t["reason"],
                        "description": t["description"],
                        "priority": t["priority"],
                        "plan": t["plan"],
                        # "status": "open",  # DB-Default greift
                    }
                )

            if tasks_payload:
                upsert_url = f"{SUPABASE_URL}/rest/v1/tasks?on_conflict=captain_id,issue_key,title"
                headers = {
                    "apikey": SUPABASE_KEY,
                    "Authorization": f"Bearer {SUPABASE_KEY}",
                    "Content-Type": "application/json",
                    # return=representation gibt die Rows zurück
                    "Prefer": "resolution=merge-duplicates,return=representation",
                }

                async with httpx.AsyncClient(timeout=30) as client:
                    resp = await client.post(
                        upsert_url, headers=headers, json=tasks_payload
                    )
                    if resp.status_code not in (200, 201):
                        # PostgREST-Fehler mit Details durchreichen
                        raise HTTPException(
                            status_code=500,
                            detail=f"Supabase upsert error: {resp.status_code} {resp.text}",
                        )
                    # Optionales Logging der gespeicherten Rows
                    saved = resp.json()
                    print(f"[tasks] upserted: {len(saved)} / {len(tasks_payload)}")

        # ---------- Response: unverändert die Suggestions-Liste ----------
        return JSONResponse(content=output)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Tasks-Run fehlgeschlagen: {e}")


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


async def get_project_channels(project_id: str) -> list[str]:
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{SUPABASE_URL}/rest/v1/projects?id=eq.{project_id}&select=channels",
            headers={
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {SUPABASE_KEY}",
                "Accept": "application/json",
            },
        )
        response.raise_for_status()
        data = response.json()
        if not data or not data[0].get("channels"):
            return []
        return data[0]["channels"]
