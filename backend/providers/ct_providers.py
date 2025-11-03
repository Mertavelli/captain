import hashlib
import json
import os
import re
from typing import Dict, List, Optional

from agents import function_tool
from supabase import Client, create_client

# ---------- Supabase Client ----------
SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]  # Service Role (serverseitig!)
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


# ---------- Helpers ----------
def slugify(text: str, max_len: int = 48) -> str:
    s = (text or "").strip().lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = re.sub(r"-{2,}", "-", s).strip("-")
    return s[:max_len] or "topic"


def short_hash(seed: str, length: int = 6) -> str:
    return hashlib.sha1((seed or "").encode("utf-8")).hexdigest()[:length]


def normalize_labels(labels: Optional[List[str]]) -> List[str]:
    if not labels:
        return []
    out, seen = [], set()
    for x in labels:
        v = (x or "").strip().lower()
        if v and v not in seen:
            seen.add(v)
            out.append(v)
    return out


def topic_payload(topic: Dict) -> Dict:
    return {
        "topic_id": topic["topic_id"],
        "title": topic.get("title"),
        "scope": topic.get("scope"),
        "description": topic.get("description"),
        "labels": topic.get("labels") or [],
        "status": topic.get("status"),
        "created_at": topic.get("created_at"),
        "updated_at": topic.get("updated_at"),
    }


def _payload(t: dict, include_context: bool) -> dict:
    base = {
        "topic_id": t.get("topic_id"),
        "title": t.get("title"),
        "scope": t.get("scope"),
        "labels": t.get("labels") or [],
        "status": t.get("status"),
        "created_at": t.get("created_at"),
        "updated_at": t.get("updated_at"),
    }
    if include_context:
        base.update(
            {
                "summary": t.get("summary"),
                "anchors": t.get("anchors") or [],
                "participants": t.get("participants") or [],
                "last_event_ts": t.get("last_event_ts"),
            }
        )
    return base


# ---------- Tools ----------


@function_tool
def list_topics(
    scope: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 50,
    include_context: bool = True,
) -> str:
    """
    Liefert Topics als JSON:
      {"topics":[{topic_id,title,scope,labels,status,created_at,updated_at,summary?,anchors?,participants?,last_event_ts?}], "count":N}
    - scope: optional (z.B. "acme:web")
    - search: optional (ILIKE auf title/description)
    - limit: 1..200 (Default 50)
    - include_context: summary/anchors/participants/last_event_ts mitliefern
    """
    limit = max(1, min(int(limit or 50), 200))
    cols = "topic_id,title,scope,labels,status,created_at,updated_at"
    if include_context:
        cols += ",summary,anchors,participants,last_event_ts"

    base = supabase.table("dccts_topics").select(cols).order("updated_at", desc=True)

    if search:
        q1 = base.limit(limit)
        if scope:
            q1 = q1.eq("scope", scope)
        q1 = q1.ilike("title", f"%{search}%").execute()

        q2 = base.limit(limit)
        if scope:
            q2 = q2.eq("scope", scope)
        q2 = q2.ilike("description", f"%{search}%").execute()

        seen, rows = set(), []
        for r in (q1.data or []) + (q2.data or []):
            tid = r.get("topic_id")
            if tid in seen:
                continue
            seen.add(tid)
            rows.append(_payload(r, include_context))
        rows = rows[:limit]
        return json.dumps({"topics": rows, "count": len(rows)}, ensure_ascii=False)

    q = base.limit(limit)
    if scope:
        q = q.eq("scope", scope)
    res = q.execute()
    rows = [_payload(t, include_context) for t in (res.data or [])]
    return json.dumps({"topics": rows, "count": len(rows)}, ensure_ascii=False)


@function_tool
def create_topic(
    title: str,
    scope: Optional[str] = None,
    description: Optional[str] = None,
    labels: Optional[List[str]] = None,
    slug: Optional[str] = None,
    seed: Optional[str] = None,
    attach_event_id: Optional[str] = None,
    attach_role: str = "primary",
) -> str:
    """
    Legt ein Topic an (oder gibt ein bestehendes zurück) und liefert JSON:
      {"topic_id","title","scope","description","labels","created":true|false}
    - topic_id: "<scope>:topic:<slug>-<hash6>" (scope optional)
    - attach_event_id: wenn gesetzt, wird in dccts_event_topics verlinkt (role='primary'|'secondary')
    """
    s_slug = slugify(slug or title)
    s_hash = short_hash(seed or title)
    topic_id = f"{scope+':' if scope else ''}topic:{s_slug}-{s_hash}"
    labs = normalize_labels(labels)

    # existiert bereits?
    existing = (
        supabase.table("dccts_topics")
        .select("*")
        .eq("topic_id", topic_id)
        .limit(1)
        .execute()
    )
    if existing.data:
        topic = existing.data[0]
        patch = {}
        if labs:
            merged = sorted(list({*(topic.get("labels") or []), *labs}))
            if merged != (topic.get("labels") or []):
                patch["labels"] = merged
        if description and not (topic.get("description") or ""):
            patch["description"] = description
        if patch:
            supabase.table("dccts_topics").update(patch).eq(
                "topic_id", topic_id
            ).execute()
            topic.update(patch)

        if attach_event_id:
            # Link in n:m Tabelle (idempotent)
            supabase.table("dccts_event_topics").upsert(
                {
                    "event_id": attach_event_id,
                    "topic_id": topic_id,
                    "role": attach_role,
                },
                on_conflict="event_id,topic_id",
            ).execute()

        payload = topic_payload(topic)
        payload["created"] = False
        return json.dumps(payload, ensure_ascii=False)

    # neu
    insert_payload = {
        "topic_id": topic_id,
        "title": title,
        "description": description,
        "scope": scope,
        "labels": labs,
        "created_by": "llm",
        "status": "active",
    }
    supabase.table("dccts_topics").insert(insert_payload).execute()

    if attach_event_id:
        supabase.table("dccts_event_topics").upsert(
            {"event_id": attach_event_id, "topic_id": topic_id, "role": attach_role},
            on_conflict="event_id,topic_id",
        ).execute()

    payload = {
        "topic_id": topic_id,
        "title": title,
        "scope": scope,
        "description": description,
        "labels": labs,
        "created": True,
    }
    return json.dumps(payload, ensure_ascii=False)


@function_tool
def assign_event_to_topic(event_id: str, topic_id: str, role: str = "primary") -> str:
    """
    Verknüpft ein Event mit einem Topic (n:m, idempotent). Rückgabe:
      {"event_id","topic_id","role","linked":true|false}
    role: 'primary' oder 'secondary'
    """
    # Topic existiert?
    t = (
        supabase.table("dccts_topics")
        .select("topic_id")
        .eq("topic_id", topic_id)
        .limit(1)
        .execute()
    )
    if not t.data:
        return json.dumps(
            {
                "event_id": event_id,
                "topic_id": topic_id,
                "role": role,
                "linked": False,
                "error": "topic_not_found",
            },
            ensure_ascii=False,
        )

    # idempotent verlinken
    res = (
        supabase.table("dccts_event_topics")
        .upsert(
            {"event_id": event_id, "topic_id": topic_id, "role": role},
            on_conflict="event_id,topic_id",
        )
        .execute()
    )
    linked = True  # upsert ist idempotent; wenn es schon da war, bleibt True
    return json.dumps(
        {"event_id": event_id, "topic_id": topic_id, "role": role, "linked": linked},
        ensure_ascii=False,
    )


@function_tool
def record_topic_signals(
    topic_id: str,
    event_id: str,
    actor_id: Optional[str] = None,
    object_key: Optional[str] = None,
    urls: Optional[List[str]] = None,
    ts: Optional[str] = None,
) -> str:
    """
    Aktualisiert anchors/participants/last_event_ts eines Topics (idempotent, ohne LLM).
    """
    t = (
        supabase.table("dccts_topics")
        .select("anchors,participants")
        .eq("topic_id", topic_id)
        .limit(1)
        .execute()
    )
    if not t.data:
        return json.dumps({"ok": False, "error": "topic_not_found"}, ensure_ascii=False)

    anchors = set(t.data[0].get("anchors") or [])
    participants = set(t.data[0].get("participants") or [])

    if object_key:
        anchors.add(f"jira:{object_key}")
    for u in urls or []:
        anchors.add(f"url:{u}")
    if actor_id:
        participants.add(actor_id)

    supabase.table("dccts_topics").update(
        {
            "anchors": list(anchors),
            "participants": list(participants),
            "last_event_ts": ts,
        }
    ).eq("topic_id", topic_id).execute()

    return json.dumps({"ok": True, "topic_id": topic_id}, ensure_ascii=False)


@function_tool
def ensure_baseline_topics(scope: str) -> str:
    """
    Legt/aktualisiert Standard-Themen für einen Scope an (idempotent).
    """
    presets = [
        (
            "General Discussion",
            ["pm", "discussion"],
            "Allgemeine Konversation zum Projekt/Issue.",
        ),
        (
            "Schedule Risk",
            ["pm", "risk", "schedule"],
            "Zeitplanrisiken, Verzögerungen, Blocker.",
        ),
        (
            "Resource Availability",
            ["pm", "people"],
            "Krankheit, Urlaub, Kapazität, Staffing.",
        ),
        ("Decision Log", ["pm", "decision"], "Entscheidungen/ADR & Begründungen."),
        ("Incident / Bug", ["pm", "incident", "bug"], "Störungen, Fehler, Ausfälle."),
        ("Action Items", ["pm", "action"], "To-dos, nächste Schritte, Aufgaben."),
        (
            "Requirements & Scope",
            ["pm", "requirements"],
            "Anforderungen, Scope, Akzeptanzkriterien.",
        ),
        ("Meeting Notes", ["pm", "meeting"], "Agenda, Protokolle, Ergebnisse."),
    ]
    created = []
    for title, labels, desc in presets:
        slug = slugify(title)
        tid = f"{scope}:topic:{slug}-{short_hash(scope+title)}"
        exist = (
            supabase.table("dccts_topics")
            .select("topic_id")
            .eq("topic_id", tid)
            .limit(1)
            .execute()
        )
        if not exist.data:
            supabase.table("dccts_topics").insert(
                {
                    "topic_id": tid,
                    "title": title,
                    "scope": scope,
                    "labels": labels,
                    "description": desc,
                    "created_by": "system",
                    "status": "active",
                }
            ).execute()
            created.append(tid)
    return json.dumps({"ok": True, "created": created}, ensure_ascii=False)


@function_tool
def link_topics(
    topic_id: str, related_topic_id: str, relation_type: str = "category"
) -> str:
    """
    Verknüpft zwei Topics (idempotent).
    relation_type: 'category'|'related'|'blocks'|'caused_by'|'impacts'|'duplicate_of'
    """
    supabase.table("dccts_topic_relations").upsert(
        {
            "topic_id": topic_id,
            "related_topic_id": related_topic_id,
            "relation_type": relation_type,
        }
    ).execute()
    return json.dumps(
        {
            "ok": True,
            "topic_id": topic_id,
            "related_topic_id": related_topic_id,
            "relation_type": relation_type,
        },
        ensure_ascii=False,
    )
