import json
from typing import Any, Dict, List

from agents import Runner, trace
from custom_agents.ct_agent import ct_agent
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import PlainTextResponse

router = APIRouter()


@router.post("/", response_class=PlainTextResponse)
async def ct_endpoint(request: Request):
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    items = payload if isinstance(payload, list) else [payload]
    results = 0
    last_output = ""

    for item in items:
        ues = (item or {}).get("ues")
        if not isinstance(ues, dict):
            continue
        ev_min = project_event(ues)
        msgs = build_messages(ev_min)

        with trace(f"CT:{ev_min.get('event_id')}"):
            run = await Runner.run(ct_agent, msgs, max_turns=12)

        out = getattr(run, "final_output", None)
        if callable(out):
            out = await out()
        if out is None:
            out = getattr(run, "output", None)
        last_output = "" if out is None else str(out)
        results += 1

    return PlainTextResponse(
        json.dumps(
            {"processed": len(items), "ok": results, "last_output": last_output},
            ensure_ascii=False,
        )
    )


def project_event(ues: Dict[str, Any]) -> Dict[str, Any]:
    a = ues.get("artefact") or {}
    r = ues.get("refs") or {}
    scope = f"{(ues.get('source_account') or 'org')}:{(r.get('object_key') or 'global').split('-')[0]}"
    return {
        "event_id": ues.get("event_id"),
        "source": ues.get("source"),
        "source_account": ues.get("source_account"),
        "event_type": ues.get("event_type"),
        "timestamp": ues.get("timestamp"),
        "actor_id": (ues.get("actor") or {}).get("id"),
        "object_key": r.get("object_key"),
        "thread": r.get("thread"),
        "urls": (r.get("urls") or [])[:20],
        "text": (a.get("body") or "")[:512],
        "scope": scope,
    }


def build_messages(ev_min: Dict[str, Any]) -> List[Dict[str, str]]:
    return [
        {
            "role": "system",
            "content": (
                "Du bist der Context-Thread-Agent. Ordne das Event GENAU EINEM Topic/Thread zu "
                "oder schlage ein neues vor. Antworte NUR mit JSON.\n\n"
                "Output-Schema:\n"
                '{ "mode":"attach|new", "topic_id":"string", "title":"string?", "labels":["..."]?, "reason":"string" }\n\n'
                "Regeln:\n"
                "- topic_id ist stabil & deterministisch (z.B. '<scope>:topic:<slug>-<hash6>').\n"
                "- Issue-Keys/URLs dienen als 'anchors' des Topics (nicht als topic_id).\n"
                "- Wenn unsicher: neues Topic mit kurzem, prägnantem Title + slug anlegen.\n"
            ),
        },
        {
            "role": "user",
            "content": json.dumps({"event_min": ev_min}, ensure_ascii=False),
        },
    ]
