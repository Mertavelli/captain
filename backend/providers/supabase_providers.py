# providers/supabase_providers.py
import os
from typing import Dict, List, Optional, Set, Tuple

from agents import RunContextWrapper, function_tool
from models import PlannerIssue, UserContext
from supabase import Client, create_client

# -------------------------------------------------
# Supabase
# -------------------------------------------------
SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
sb: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


# -------------------------------------------------
# Helpers (robust & knapp)
# -------------------------------------------------
def _to_plain(obj) -> dict:
    if hasattr(obj, "model_dump") and callable(obj.model_dump):
        return obj.model_dump(exclude_none=True)
    return obj if isinstance(obj, dict) else {}


def _as_fields_dict(fields) -> Dict:
    return fields if isinstance(fields, dict) else {}


def _lower_name(issuetype) -> Optional[str]:
    if isinstance(issuetype, dict):
        v = issuetype.get("name") or issuetype.get("id")
        return str(v).lower() if v else None
    if isinstance(issuetype, str):
        return issuetype.lower()
    return None


def _is_epic(n: Optional[str]) -> bool:
    return n == "epic"


def _is_subtask(n: Optional[str]) -> bool:
    return n in {"sub-task", "subtask", "sub task"}


def _extract_parent_key(fields) -> Optional[str]:
    if not isinstance(fields, dict):
        return None
    p = fields.get("parent")
    if isinstance(p, dict):
        k = p.get("key") or p.get("id")
        if isinstance(k, str) and k.strip():
            return k.strip()
    if isinstance(p, str) and p.strip():
        return p.strip()
    pik = fields.get("parent_issue_key")
    if isinstance(pik, str) and pik.strip():
        return pik.strip()
    return None


def _normalize_parent(fields: Dict) -> Dict:
    f = _as_fields_dict(fields)
    pk = _extract_parent_key(f)
    if pk:
        f = {**f, "parent": {"key": pk}}
        if "parent_issue_key" in f:
            f = {k: v for k, v in f.items() if k != "parent_issue_key"}
    return f


def _safe_issue_type_name(it: Dict) -> Optional[str]:
    if not isinstance(it, dict):
        return None
    f = _as_fields_dict(it.get("fields"))
    return _lower_name(f.get("issuetype") or f.get("issue_type"))


def _fetch_plan(captain_id: str) -> List[Dict]:
    resp = sb.table("captains").select("plan").eq("id", captain_id).single().execute()
    data = getattr(resp, "data", None) or {}
    plan = data.get("plan") or []
    return [it for it in plan if isinstance(it, dict)]


def _save_plan(captain_id: str, plan: List[Dict]) -> None:
    clean = [it for it in plan if isinstance(it, dict)]
    sb.table("captains").update({"plan": clean}).eq("id", captain_id).execute()


def _next_key(prefix: str, existing: set[str]) -> str:
    i = 1
    while True:
        k = f"{prefix}{i:03d}"
        if k not in existing:
            return k
        i += 1


def _ensure_key(item: Dict, existing_keys: set[str]) -> None:
    if item.get("key") and item["key"] != "static-id":
        return
    f = _as_fields_dict(item.get("fields"))
    itype = _lower_name(f.get("issuetype") or f.get("issue_type"))
    prefix = "T"
    if _is_epic(itype):
        prefix = "E"
    elif _is_subtask(itype):
        prefix = "S"
    item["key"] = _next_key(prefix, existing_keys)


# -------------------------------------------------
# Positionierung: zielgerichtetes Einfügen statt globalem Sortieren
# -------------------------------------------------
def _index_by_key(plan: List[Dict]) -> Dict[str, Dict]:
    return {it.get("key"): it for it in plan if isinstance(it, dict) and it.get("key")}


def _last_index_of_pred(plan: List[Dict], pred) -> int:
    last = -1
    for i, it in enumerate(plan):
        if pred(it):
            last = i
    return last


def _find_epic_tail_index(plan: List[Dict], epic_key: str) -> int:
    """
    Liefert den Index des letzten Elements, das zum Epic gehört:
    - das Epic selbst
    - alle Tasks mit parent=Epic
    - deren Sub-tasks
    """
    idx = _index_by_key(plan)

    def belongs_to_epic(it: Dict) -> bool:
        n = _safe_issue_type_name(it)
        f = _as_fields_dict(it.get("fields"))
        if _is_epic(n):
            return it.get("key") == epic_key
        if _is_subtask(n):
            # Subtask gehört, wenn seine Parent-Task zum Epic gehört
            p_task = _extract_parent_key(f)
            task = idx.get(p_task) if p_task else None
            if not task:
                return False
            tf = _as_fields_dict(task.get("fields"))
            return _extract_parent_key(tf) == epic_key
        # Task
        return _extract_parent_key(f) == epic_key

    pos = _last_index_of_pred(plan, belongs_to_epic)
    # Wenn gar nichts gefunden wurde, mindestens das Epic selbst suchen:
    if pos == -1:
        pos = _last_index_of_pred(
            plan,
            lambda it: _is_epic(_safe_issue_type_name(it))
            and it.get("key") == epic_key,
        )
    return pos


def _find_task_tail_index(plan: List[Dict], task_key: str) -> int:
    """
    Liefert den Index des letzten Elements der Task-Gruppe:
    - die Task selbst
    - ihre Sub-tasks
    """

    def belongs_to_task(it: Dict) -> bool:
        n = _safe_issue_type_name(it)
        if not _is_subtask(n):
            return it.get("key") == task_key
        f = _as_fields_dict(it.get("fields"))
        return _extract_parent_key(f) == task_key

    pos = _last_index_of_pred(plan, belongs_to_task)
    # Fallback: Task selbst
    if pos == -1:
        pos = _last_index_of_pred(plan, lambda it: it.get("key") == task_key)
    return pos


def _insertion_index(plan: List[Dict], item: Dict) -> int:
    """
    Berechnet die Zielposition zum Einfügen:
    - Epic: hinter dem letzten Epic
    - Task: hinter dem Tail seines Epics
    - Sub-task: hinter dem Tail seiner Task
    """
    n = _safe_issue_type_name(item)
    if _is_epic(n):
        last_epic = _last_index_of_pred(
            plan, lambda it: _is_epic(_safe_issue_type_name(it))
        )
        return last_epic + 1
    f = _as_fields_dict(item.get("fields"))
    if _is_subtask(n):
        tkey = _extract_parent_key(f)  # die Task
        tail = _find_task_tail_index(plan, tkey) if tkey else -1
        return (tail + 1) if tail >= 0 else len(plan)
    # Task
    ekey = _extract_parent_key(f)  # das Epic
    tail = _find_epic_tail_index(plan, ekey) if ekey else -1
    return (tail + 1) if tail >= 0 else len(plan)


def _find_epic_by_summary(plan: List[Dict], summary: str) -> Optional[Dict]:
    s = (summary or "").strip().lower()
    if not s:
        return None
    for it in plan:
        if _is_epic(_safe_issue_type_name(it)):
            f = _as_fields_dict(it.get("fields"))
            if isinstance(f.get("summary"), str) and f["summary"].strip().lower() == s:
                return it
    return None


def _find_task_by_parent_and_summary(
    plan: List[Dict], epic_key: str, summary: str
) -> Optional[Dict]:
    s = (summary or "").strip().lower()
    if not s or not epic_key:
        return None
    for it in plan:
        n = _safe_issue_type_name(it)
        if n and (not _is_epic(n)) and (not _is_subtask(n)):
            f = _as_fields_dict(it.get("fields"))
            par = _extract_parent_key(f)
            if (
                par == epic_key
                and isinstance(f.get("summary"), str)
                and f["summary"].strip().lower() == s
            ):
                return it
    return None


def _find_subtask_by_parent_and_summary(
    plan: List[Dict], task_key: str, summary: str
) -> Optional[Dict]:
    s = (summary or "").strip().lower()
    if not s or not task_key:
        return None
    for it in plan:
        if _is_subtask(_safe_issue_type_name(it)):
            f = _as_fields_dict(it.get("fields"))
            par = _extract_parent_key(f)
            if (
                par == task_key
                and isinstance(f.get("summary"), str)
                and f["summary"].strip().lower() == s
            ):
                return it
    return None


def _has_children(plan: List[Dict], epic_key: str) -> bool:
    for it in plan:
        f = _as_fields_dict(it.get("fields"))
        par = _extract_parent_key(f)
        if par == epic_key:
            return True
        # Subtasks → prüfen, ob deren Task dem Epic gehört
        if _is_subtask(_safe_issue_type_name(it)):
            tkey = _extract_parent_key(f)
            # Task lookup:
            for t in plan:
                if _safe_issue_type_name(t) not in (
                    "epic",
                    "sub-task",
                    "subtask",
                    "sub task",
                ):
                    tf = _as_fields_dict(t.get("fields"))
                    if t.get("key") == tkey and _extract_parent_key(tf) == epic_key:
                        return True
    return False


def _find_item_by_key(plan: List[Dict], key: str) -> Optional[Dict]:
    for it in plan:
        if isinstance(it, dict) and it.get("key") == key:
            return it
    return None


def _collect_task_subtasks(plan: List[Dict], task_key: str) -> Set[str]:
    """Task + alle direkten Subtasks (Keys)"""
    out: Set[str] = set()
    out.add(task_key)
    for it in plan:
        if _is_subtask(_safe_issue_type_name(it)):
            f = _as_fields_dict(it.get("fields"))
            if _extract_parent_key(f) == task_key:
                out.add(it.get("key"))
    return out


def _collect_epic_descendants(plan: List[Dict], epic_key: str) -> Set[str]:
    """Epic + alle Tasks darunter + deren Subtasks (Keys)"""
    out: Set[str] = set()
    out.add(epic_key)
    # Tasks unter Epic
    task_keys: List[str] = []
    for it in plan:
        n = _safe_issue_type_name(it)
        if n and (not _is_epic(n)) and (not _is_subtask(n)):
            f = _as_fields_dict(it.get("fields"))
            if _extract_parent_key(f) == epic_key:
                tk = it.get("key")
                if tk:
                    task_keys.append(tk)
                    out.add(tk)
    # Subtasks unter Tasks
    for it in plan:
        if _is_subtask(_safe_issue_type_name(it)):
            f = _as_fields_dict(it.get("fields"))
            pk = _extract_parent_key(f)
            if pk in task_keys:
                out.add(it.get("key"))
    return out


# -------------------------------------------------
# 1) Plan als STRING (hierarchisch) zurückgeben
# -------------------------------------------------
@function_tool
def get_plan_for_context(wrapper: RunContextWrapper[UserContext]) -> str:
    """
    Gibt den Plan als Text zurück – hierarchisch:
    E001 | epic | Implementierung ...
      T001 | task | API entwerfen
        S001 | sub-task | Auth prüfen
    """
    captain_id = getattr(wrapper.context, "captain_id", None)
    if not captain_id:
        return "Kein Captain konfiguriert."

    plan = _fetch_plan(captain_id)
    if not plan:
        return "Plan ist leer."

    idx = _index_by_key(plan)
    lines: List[str] = []
    for it in plan:
        n = _safe_issue_type_name(it) or "unknown"
        f = _as_fields_dict(it.get("fields"))
        key = it.get("key") or "∅"
        summary = f.get("summary")
        if not isinstance(summary, str) or not summary.strip():
            summary = "—"

        indent = ""
        if _is_subtask(n):
            indent = "  "
        elif not _is_epic(n):
            indent = "  "  # Tasks
        # Subtask-Indent tiefer?
        if _is_subtask(n):
            indent = "    "

        lines.append(f"{indent}{key} | {n} | {summary}")

    return "\n".join(lines)


# -------------------------------------------------
# 2) Ein Issue anhängen/ersetzen – mit gezielter Positionierung
# -------------------------------------------------
@function_tool
def append_or_replace_plan_item(
    wrapper: RunContextWrapper[UserContext], item: PlannerIssue
) -> str:
    captain_id = getattr(wrapper.context, "captain_id", None)
    if not captain_id:
        return "❌ captain_id fehlt."

    raw = _to_plain(item)
    if not isinstance(raw, dict):
        return "❌ Ungültiges Item-Format."

    # Sanitize: change
    change = str(raw.get("change") or "").lower().strip()
    if change == "delete":
        # Delete nur erlauben, wenn EPIC ohne Kinder ODER Nicht-Epic ohne Subtasks.
        # (Oder: generell blocken, bis du gezielt ein Delete-Tool bauen willst.)
        return "❌ Delete ist im Einzel-Append nicht erlaubt. Bitte explizit Lösch-Flow nutzen."
    if change not in {"create", "update"}:
        change = "create"

    plan = _fetch_plan(captain_id)
    existing_keys = {
        it.get("key") for it in plan if isinstance(it, dict) and it.get("key")
    }

    # Felder & Typ
    f = _as_fields_dict(raw.get("fields"))
    n = _lower_name(f.get("issuetype") or f.get("issue_type"))
    summary = f.get("summary") if isinstance(f.get("summary"), str) else None

    # Key sicherstellen (vor Upsert-Checks, damit raw.get("key") da ist)
    _ensure_key(raw, set(filter(None, existing_keys)))

    # Upsert anhand (type, parent, summary): wenn gleicher Datensatz existiert → re-use Key
    if _is_epic(n) and summary:
        match = _find_epic_by_summary(plan, summary)
        if match:
            raw["key"] = match.get("key")  # reuse
    elif (not _is_epic(n)) and (not _is_subtask(n)) and summary:
        # Task
        epic_key = _extract_parent_key(f)
        if not epic_key:
            # Auto-Parent nur bei genau 1 Epic
            epic_keys = [
                it.get("key")
                for it in plan
                if _is_epic(_safe_issue_type_name(it)) and it.get("key")
            ]
            if len(epic_keys) == 1:
                epic_key = epic_keys[0]
                f = {**f, "parent": {"key": epic_key}}
        if epic_key:
            match = _find_task_by_parent_and_summary(plan, epic_key, summary)
            if match:
                raw["key"] = match.get("key")  # reuse
    elif _is_subtask(n) and summary:
        task_key = _extract_parent_key(f)
        if task_key:
            match = _find_subtask_by_parent_and_summary(plan, task_key, summary)
            if match:
                raw["key"] = match.get("key")  # reuse

    # Eltern-Prüfungen + Normalisierung
    if _is_epic(n):
        # ok
        pass
    elif _is_subtask(n):
        task_key = _extract_parent_key(f)
        if not task_key:
            return "❌ Sub-task ohne Parent ist nicht erlaubt."
        task_keys = {
            it.get("key")
            for it in plan
            if not _is_epic(_safe_issue_type_name(it))
            and not _is_subtask(_safe_issue_type_name(it))
            and it.get("key")
        }
        if task_key not in task_keys:
            return f"❌ Parent-Task '{task_key}' existiert (noch) nicht im Plan."
    else:
        # Task
        epic_key = _extract_parent_key(f)
        if not epic_key:
            epic_keys = [
                it.get("key")
                for it in plan
                if _is_epic(_safe_issue_type_name(it)) and it.get("key")
            ]
            if len(epic_keys) == 1:
                epic_key = epic_keys[0]
                f = {**f, "parent": {"key": epic_key}}
            else:
                return "❌ Für Tasks muss bei mehreren Epics ein Parent-Epic angegeben werden."

    # Parent normalisieren
    f = _normalize_parent(f)
    raw["fields"] = f

    # Replace in place (update) – Position beibehalten; sonst gezielt einfügen
    key = raw.get("key")
    replaced = False
    for i, it in enumerate(plan):
        if isinstance(it, dict) and it.get("key") == key:
            # Schutz: kein Epic-Reparent, wenn Kinder existieren und Parent sich ändert
            if _is_epic(_safe_issue_type_name(it)):
                old_key = it.get("key")
                new_key = raw.get("key")
                if old_key == new_key and _has_children(plan, old_key):
                    # wir ersetzen nur Felder, Parent von Epic ist sowieso nicht relevant
                    pass
            plan[i] = raw
            replaced = True
            break

    if not replaced:
        # gezielte Einfügeposition (Epic-Tail, Task-Tail)
        insert_at = _insertion_index(plan, raw)
        plan.insert(insert_at, raw)

    _save_plan(captain_id, plan)
    return f"✅ {key} {'ersetzt' if replaced else 'hinzugefügt'} ({n or 'unknown'})."


# ---------- UPDATE: Felder eines Items ändern ----------
@function_tool
def update_plan_item_fields(
    wrapper: RunContextWrapper[UserContext],
    key: str,
    summary: Optional[str] = None,
    description: Optional[str] = None,
    status: Optional[str] = None,
    duedate: Optional[str] = None,  # YYYY-MM-DD (oder wie bei dir üblich)
    assignee_account_id: Optional[str] = None,
    labels: Optional[List[str]] = None,
    parent_issue_key: Optional[str] = None,  # nur bei EXPLIZITEM Reparenting setzen
) -> str:
    """
    Fügt ein bestehendes Issue (Jira-Key oder Temp-Key) in den Plan ein ODER ersetzt
    es, falls der Key bereits existiert. Setzt change="update".
    - Nur übergebene Felder werden geändert.
    - Parent bleibt unverändert, außer parent_issue_key ist angegeben (dann validieren).
    """
    captain_id = getattr(wrapper.context, "captain_id", None)
    if not captain_id:
        return "❌ captain_id fehlt."
    if not isinstance(key, str) or not key.strip():
        return "❌ Ungültiger Key."

    plan = _fetch_plan(captain_id)

    # Zielobjekt vorbereiten
    new_fields: Dict = {}
    if summary is not None:
        new_fields["summary"] = summary
    if description is not None:
        new_fields["description"] = description
    if status is not None:
        new_fields["status"] = status
    if duedate is not None:
        new_fields["duedate"] = duedate
    if labels is not None:
        new_fields["labels"] = list(labels)
    if assignee_account_id is not None:
        new_fields["assignee"] = {"account_id": assignee_account_id}

    # Reparenting nur, wenn explizit gewünscht
    if parent_issue_key is not None:
        target = parent_issue_key.strip()
        # Typ herausfinden (nur zur Validierung)
        exists = _find_item_by_key(plan, key.strip())
        if not exists:
            # wenn das Issue noch nicht im Plan ist, nehmen wir es auf (Update-Planung)
            # Typ kennen wir dann nicht sicher → Parent nur syntaktisch setzen
            if target:
                new_fields["parent"] = {"key": target}
        else:
            n = _safe_issue_type_name(exists)
            if _is_epic(n):
                return "❌ Epic kann keinen Parent haben."
            if _is_subtask(n):
                # neuer Task muss existieren
                if not any(
                    (not _is_epic(_safe_issue_type_name(it)))
                    and (not _is_subtask(_safe_issue_type_name(it)))
                    and it.get("key") == target
                    for it in plan
                ):
                    return f"❌ Ziel-Task {target} existiert nicht im Plan."
                new_fields["parent"] = {"key": target}
            else:
                # Task → neues Epic muss existieren
                if not any(
                    _is_epic(_safe_issue_type_name(it)) and it.get("key") == target
                    for it in plan
                ):
                    return f"❌ Ziel-Epic {target} existiert nicht im Plan."
                new_fields["parent"] = {"key": target}

    # Parent normalisieren (parent_issue_key -> parent.key)
    new_fields = _normalize_parent(new_fields)

    new_item = {
        "id": "static-id",
        "key": key.strip(),
        "change": "update",
        "fields": new_fields,
    }

    # Ersetzen oder anhängen
    replaced = False
    for i, it in enumerate(plan):
        if it.get("key") == new_item["key"]:
            plan[i] = new_item
            replaced = True
            break
    if not replaced:
        plan.append(new_item)

    _save_plan(captain_id, plan)
    return f"✅ {key} {'ersetzt' if replaced else 'hinzugefügt'} (update)."


# ---------- DELETE: Item entfernen (optional mit Cascade) ----------
@function_tool
def delete_plan_item(
    wrapper: RunContextWrapper[UserContext],
    key: str,
    cascade: bool = False,
) -> str:
    """
    Löscht ein Item aus dem Plan.
    - Ohne cascade:
        * Sub-task: ok.
        * Task: blockiert, wenn Sub-tasks existieren.
        * Epic: blockiert, wenn Tasks/Sub-tasks existieren.
    - Mit cascade:
        * Task: löscht Task + Sub-tasks.
        * Epic: löscht Epic + alle Tasks + alle Sub-tasks darunter.
    """
    captain_id = getattr(wrapper.context, "captain_id", None)
    if not captain_id:
        return "❌ captain_id fehlt."
    if not isinstance(key, str) or not key.strip():
        return "❌ Ungültiger Key."

    plan = _fetch_plan(captain_id)
    item = _find_item_by_key(plan, key.strip())
    if not item:
        return f"❌ Key {key} nicht im Plan gefunden."

    n = _safe_issue_type_name(item)

    if _is_epic(n):
        if cascade:
            to_del = _collect_epic_descendants(plan, key)
        else:
            # blockieren, wenn Kinder existieren
            if _has_children(plan, key):
                return (
                    f"❌ Epic {key} hat abhängige Elemente. 'cascade=True' verwenden."
                )
            to_del = {key}
    elif _is_subtask(n):
        to_del = {key}
    else:
        # Task
        if cascade:
            to_del = _collect_task_subtasks(plan, key)
        else:
            # blockieren, wenn Subtasks vorhanden
            has_sub = any(
                _is_subtask(_safe_issue_type_name(it))
                and _extract_parent_key(_as_fields_dict(it.get("fields"))) == key
                for it in plan
            )
            if has_sub:
                return f"❌ Task {key} hat Sub-tasks. 'cascade=True' verwenden."
            to_del = {key}

    new_plan = [it for it in plan if it.get("key") not in to_del]
    _save_plan(captain_id, new_plan)
    if len(to_del) == 1:
        return f"✅ {key} gelöscht."
    return f"✅ {len(to_del)} Elemente gelöscht ({', '.join(sorted(to_del))})."
