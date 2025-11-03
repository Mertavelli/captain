import os
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from agents import RunContextWrapper, function_tool
from models import EventLite, ExistingTaskLite, IssueContext, TaskRow
from supabase import Client, create_client

# Supabase init
SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Config
BODY_MAX_CHARS = 800
SINCE_ISO = (datetime.utcnow() - timedelta(days=30)).isoformat() + "Z"
MAX_EVENTS_PER_ISSUE = 50
MAX_EXISTING_TASKS = 500


@function_tool
def get_issues_context(wrapper: RunContextWrapper) -> List[IssueContext]:
    """Gibt eine Liste aller Events eines Captains gruppiert nach Issues aus."""

    captain_id = wrapper.context.captain_id
    if not captain_id:
        raise ValueError("No captain_id provided in UserContext.")

    sel = ",".join(
        [
            "event_id",
            "event_type",
            "object_key",
            "ts",
            "actor_display:ues->actor->>display",
            "artefact_title:ues->artefact->>title",
            "artefact_body:ues->artefact->>body",
            "jira_web_url:ues->refs->jira->>web_url",
        ]
    )

    q = (
        supabase.table("dccts_events")
        .select(sel)
        .eq("captain_id", captain_id)
        .gte("ts", SINCE_ISO)
        .order("ts", desc=False)
    )
    rows = q.execute().data or []

    groups: Dict[str, Dict[str, Any]] = {}

    def _cut(s: Optional[str]) -> Optional[str]:
        if not s:
            return s
        return s if len(s) <= BODY_MAX_CHARS else (s[:BODY_MAX_CHARS] + " …")

    for r in rows:
        issue_key = r.get("object_key") or "unknown"
        if issue_key not in groups:
            groups[issue_key] = {
                "issue_key": issue_key,
                "web_url": r.get("jira_web_url"),
                "events": [],
            }

        ev = EventLite(
            event_id=r.get("event_id"),
            t=(r.get("ts") or datetime.utcnow().isoformat() + "Z"),
            type=r.get("event_type"),
            actor=r.get("actor_display"),
            title=r.get("artefact_title"),
            body=_cut(r.get("artefact_body")),
        )
        groups[issue_key]["events"].append(ev)

    issues: List[IssueContext] = []
    for g in groups.values():
        evs = sorted(g["events"], key=lambda e: e.t or "")[-MAX_EVENTS_PER_ISSUE:]
        issues.append(
            IssueContext(issue_key=g["issue_key"], web_url=g["web_url"], events=evs)
        )

    issues.sort(key=lambda ic: (ic.events[-1].t if ic.events else ""), reverse=True)
    return issues


@function_tool
def get_captain_tasks(wrapper: RunContextWrapper) -> List[ExistingTaskLite]:
    """Gibt die dedupe-relevanten Tasks eines Captains aus (alle Stati)."""
    captain_id = getattr(getattr(wrapper, "context", None), "captain_id", None)
    if not captain_id:
        raise ValueError("No captain_id provided in UserContext.")
    captain_id = str(captain_id)

    TRIM_DESC = 400
    TRIM_PLAN = 300

    def _clip(s, n):
        if not s:
            return s
        s = str(s)
        return s if len(s) <= n else s[:n] + " …"

    sel = "id,issue_key,title,description,plan,status,priority,created_at,updated_at"

    rows = (
        supabase.table("tasks")
        .select(sel)
        .eq("captain_id", captain_id)
        .order(
            "updated_at", desc=False
        )  # älteste → neueste; für ts_ref nimm einfach max()
        .limit(MAX_EXISTING_TASKS)  # hartes Limit gegen Token-Bloat
        .execute()
        .data
        or []
    )

    out: List[ExistingTaskLite] = []
    for r in rows:
        try:
            out.append(
                ExistingTaskLite(
                    id=str(r.get("id")),
                    issue_key=r.get("issue_key") or "",
                    title=r.get("title") or "",
                    description=_clip(r.get("description"), TRIM_DESC),
                    plan=_clip(r.get("plan"), TRIM_PLAN),
                    status=r.get("status") or "pending_approval",
                    priority=r.get("priority") or "medium",
                    created_at=r.get("created_at") or "",
                    updated_at=r.get("updated_at") or "",
                )
            )
        except Exception:
            continue
    return out


@function_tool
def update_task(wrapper: RunContextWrapper, task_row: TaskRow) -> TaskRow:
    """Updated eine bestehende Task"""
    captain_id = getattr(getattr(wrapper, "context", None), "captain_id", None)
    if not captain_id:
        raise ValueError("No captain_id provided in UserContext.")
    task_id = task_row.id
    if not task_id:
        raise ValueError("task_row.id is required.")

    sel = "id,captain_id,issue_key,title,reason,description,priority,plan,status,created_at,updated_at"
    res = (
        supabase.table("tasks")
        .select(sel)
        .eq("id", task_id)
        .eq("captain_id", captain_id)
        .limit(1)
        .execute()
    )
    rows = res.data or []
    if not rows:
        raise ValueError("Task not found for this captain_id.")
    current = rows[0]

    patch: Dict[str, Any] = {}
    for field in ["issue_key", "title", "reason", "priority", "status"]:
        val = getattr(task_row, field, None)
        if val is not None:
            patch[field] = val

    # ---- NEU: sichere Default-Append-Logik ----
    desc_mode = getattr(task_row, "description_mode", "append")  # 'append' | 'replace'
    plan_mode = getattr(task_row, "plan_mode", "append")  # 'append' | 'replace'

    if getattr(task_row, "description", None) is not None:
        if desc_mode == "append":
            old = current.get("description") or ""
            sep = "\n\n" if old and not old.endswith("\n") else ""
            patch["description"] = (old + sep + task_row.description).strip()
        else:
            patch["description"] = task_row.description

    if getattr(task_row, "plan", None) is not None:
        if plan_mode == "append":
            oldp = current.get("plan") or ""
            sep = "\n" if oldp and not oldp.endswith("\n") else ""
            patch["plan"] = (oldp + sep + task_row.plan).strip()
        else:
            patch["plan"] = task_row.plan
    # -------------------------------------------

    if not patch:
        return TaskRow(**current)

    supabase.table("tasks").update(patch).eq("id", task_id).eq(
        "captain_id", captain_id
    ).execute()
    res2 = (
        supabase.table("tasks")
        .select(sel)
        .eq("id", task_id)
        .eq("captain_id", captain_id)
        .limit(1)
        .execute()
    )
    rows2 = res2.data or []
    if not rows2:
        raise RuntimeError("Updated task could not be fetched.")
    return TaskRow(**rows2[0])
