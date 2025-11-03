import json
from typing import Dict, List

import requests
from agents import RunContextWrapper, function_tool
from models import Issue, IssueUpdate, UserContext


# --------HELPER--------
def convert_to_rich_text(text: str) -> dict:
    """
    Konvertiert normalen Text in Atlassian Document Format (ADF),
    wie von Jira für die Beschreibung verlangt.
    """
    return {
        "type": "doc",
        "version": 1,
        "content": [
            {
                "type": "paragraph",
                "content": [
                    {
                        "type": "text",
                        "text": text,
                    }
                ],
            }
        ],
    }


def get_epic_field_id(cloud_id, access_token):
    url = f"https://api.atlassian.com/ex/jira/{cloud_id}/rest/api/3/field"
    headers = {"Authorization": f"Bearer {access_token}", "Accept": "application/json"}

    response = requests.get(url, headers=headers)
    response.raise_for_status()
    fields = response.json()

    for field in fields:
        if field["name"] == "Epic Link":
            return field["id"]  # z. B. "customfield_10014"

    raise Exception("Epic Link field not found")


def _jira_update_issue_fields(
    wrapper: RunContextWrapper[UserContext], issue_key: str, update_fields: dict
) -> str:
    import json

    import requests

    access_token = wrapper.context.jira_token
    cloud_id = wrapper.context.jira_cloudId

    # Beschreibung ggf. in ADF konvertieren
    if "description" in update_fields and isinstance(update_fields["description"], str):
        update_fields["description"] = convert_to_rich_text(
            update_fields["description"]
        )

    url = f"https://api.atlassian.com/ex/jira/{cloud_id}/rest/api/3/issue/{issue_key}"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }
    payload = {"fields": update_fields}
    response = requests.put(url, headers=headers, data=json.dumps(payload))

    if response.status_code == 204:
        return f"✅ Issue {issue_key} wurde erfolgreich aktualisiert."
    elif response.status_code == 400:
        return f"❌ Fehler: Ungültige Anfrage oder ungültiges Feld. {response.text}"
    elif response.status_code == 403:
        return f"🚫 Zugriff verweigert. Fehlende Rechte für {issue_key}."
    elif response.status_code == 404:
        return f"🔍 Issue {issue_key} wurde nicht gefunden."
    else:
        return f"❗ Fehler {response.status_code}: {response.text}"


# --------TOOLS--------
@function_tool
def create_jira_issue(
    wrapper: RunContextWrapper[UserContext],
    issue: Issue,
) -> str:
    """
    Legt EIN einzelnes Jira-Issue an (Epic/Story/Task/Bug/Sub-task).
    - Verwendet das gleiche Issue-Modell wie der Bulk-Endpoint.
    - Für Subtasks: 'parent_issue_key' MUSS gesetzt sein.
    - Beschreibung wird ins Atlassian Document Format (ADF) konvertiert.

    Rückgabe:
      - "✅ Angelegt: <ISSUE-KEY>" bei Erfolg
      - Andernfalls detaillierte Fehlermeldung mit HTTP-Status
    """
    access_token = wrapper.context.jira_token
    cloud_id = wrapper.context.jira_cloudId
    project_key = wrapper.context.jira_project_key

    url = f"https://api.atlassian.com/ex/jira/{cloud_id}/rest/api/3/issue"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }

    fields: Dict = {
        "summary": issue.summary,
        "description": convert_to_rich_text(issue.description or ""),
        "project": {"key": project_key},
        "issuetype": {
            "name": issue.issue_type
        },  # z. B. "Task", "Bug", "Story", "Epic", "Sub-task"
    }

    # Fälligkeit (YYYY-MM-DD)
    if issue.due_date:
        fields["duedate"] = issue.due_date

    # Subtask-Parent (wenn gesetzt, wird als Sub-task angelegt)
    if getattr(issue, "parent_issue_key", None):
        fields["parent"] = {"key": issue.parent_issue_key}

    payload = {"fields": fields}

    resp = requests.post(url, headers=headers, data=json.dumps(payload))
    if resp.status_code in (201, 200):
        data = resp.json()
        key = data.get("key")
        return f"✅ Angelegt: {key}" if key else "✅ Angelegt (Key nicht zurückgegeben)"
    elif resp.status_code == 400:
        return f"❌ Ungültige Anfrage (400): {resp.text}"
    elif resp.status_code == 403:
        return f"🚫 Zugriff verweigert (403): {resp.text}"
    else:
        return f"❗ Fehler {resp.status_code}: {resp.text}"


@function_tool
def create_bulk_jira_issues(
    wrapper: RunContextWrapper[UserContext], issues: list[Issue]
) -> str:
    """
    Erstellt bis zu 50 Jira-Issues über den Bulk-Endpoint.
    Unterstützt auch Subtasks: Wenn 'parent_issue_key' gesetzt ist, wird das Issue als Subtask angelegt.
    """
    access_token = wrapper.context.jira_token
    cloud_id = wrapper.context.jira_cloudId
    project_key = wrapper.context.jira_project_key

    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": f"Bearer {access_token}",
    }

    payload = {"issueUpdates": []}

    for issue in issues:
        fields = {
            "summary": issue.summary,
            "description": convert_to_rich_text(issue.description),
            "project": {"key": project_key},
            "issuetype": {"name": issue.issue_type},
        }

        if issue.due_date:
            fields["duedate"] = issue.due_date  # erwartet YYYY-MM-DD

        # Nur für Subtasks: Parent-Feld setzen, wenn vorhanden
        if issue.parent_issue_key:
            fields["parent"] = {"key": issue.parent_issue_key}

        payload["issueUpdates"].append({"fields": fields})

    url = f"https://api.atlassian.com/ex/jira/{cloud_id}/rest/api/3/issue/bulk"

    response = requests.post(url, headers=headers, data=json.dumps(payload))

    if response.status_code == 201:
        data = response.json()
        created_issues = [issue["key"] for issue in data.get("issues", [])]
        return f"✅ Erfolgreich erstellt: {', '.join(created_issues)}"
    else:
        return (
            f"❌ Fehler beim Bulk-Erstellen. "
            f"Status: {response.status_code}, Fehler: {response.text}"
        )


@function_tool
def assign_jira_issue(
    wrapper: RunContextWrapper[UserContext], issue_id_or_key: str, account_id: str
) -> str:
    """
    Weist ein Jira-Issue einem Benutzer zu.

    - issue_id_or_key: Die Issue-ID oder der Issue-Key (z. B. "QUAD-123").
    - account_id: Die Atlassian accountId des Benutzers (z. B. "5b10ac8d82e05b22cc7d4ef5").

    Gibt eine Bestätigung oder Fehlermeldung zurück.
    """

    access_token = wrapper.context.jira_token  # OAuth2 Access Token
    cloud_id = wrapper.context.jira_cloudId  # Deine Jira Cloud-ID

    url = f"https://api.atlassian.com/ex/jira/{cloud_id}/rest/api/3/issue/{issue_id_or_key}/assignee"

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }

    body = {"accountId": account_id}

    response = requests.put(url, headers=headers, json=body)

    if response.status_code == 204:
        return f"Issue {issue_id_or_key} wurde erfolgreich zugewiesen."
    elif response.status_code == 400:
        return f"❌ Fehler: Ungültiger Request. Möglicherweise ist accountId falsch oder fehlt."
    elif response.status_code == 403:
        return f"🚫 Zugriff verweigert. Fehlende Rechte, um das Issue zuzuweisen."
    elif response.status_code == 404:
        return f"🔍 Issue {issue_id_or_key} wurde nicht gefunden."
    else:
        return f"❗ Fehler {response.status_code}: {response.text}"


@function_tool
def get_issues_for_project(wrapper: RunContextWrapper[UserContext]) -> list[Dict]:
    """
    Lädt alle Issues eines Projekts aus dem verbundenen PM-Tool (hier Jira) und gibt
    eine kompakte Liste für Agent-Analysen zurück – inkl. Status, Assignee, Labels, Duedate
    und Kommentare.
    """

    access_token = wrapper.context.jira_token
    cloud_id = wrapper.context.jira_cloudId
    project_key = wrapper.context.jira_project_key

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }

    issues = []
    start_at = 0
    max_results = 50

    # Labels + Kommentare mitladen (für Blocker-/Kontextanalyse)
    fields = (
        "summary,issuetype,assignee,status,comment,labels,"
        "duedate,priority,statuscategorychangedate,updated"
    )

    while True:
        jql = f"project={project_key}"
        url = f"https://api.atlassian.com/ex/jira/{cloud_id}/rest/api/3/search"
        params = {
            "jql": jql,
            "startAt": start_at,
            "maxResults": max_results,
            "fields": fields,
        }
        resp = requests.get(url, headers=headers, params=params)
        if resp.status_code != 200:
            print(f"Fehler: {resp.status_code} – {resp.text}")
            return []

        data = resp.json()
        issues.extend(data.get("issues", []))

        if start_at + max_results >= data.get("total", 0):
            break
        start_at += max_results

    structured_issues = []
    COMMENTS_LIMIT = 3  # z. B. nur die letzten 3 Kommentare

    for issue in issues:
        f = issue.get("fields", {}) or {}

        key = issue.get("key")
        summary = f.get("summary", "")
        issue_type = (f.get("issuetype") or {}).get("name", "Unknown")
        duedate = f.get("duedate")
        priority = (f.get("priority") or {}).get("name")
        statuscategorychangedate = f.get(
            "statuscategorychangedate"
        )  # ISO-String oder None
        updated = f.get("updated")  # ISO-String oder None

        assignee = f.get("assignee")
        assignee_name = assignee.get("displayName") if assignee else None

        status_obj = f.get("status") or {}
        status_name = status_obj.get("name")
        status_category = (status_obj.get("statusCategory") or {}).get("key")

        # Labels (Liste von Strings)
        labels = f.get("labels") or []
        if not isinstance(labels, list):
            labels = []

        # Kommentare (erste Seite, begrenzt)
        comment_field = f.get("comment") or {}
        raw_comments = (comment_field.get("comments") or [])[:COMMENTS_LIMIT]
        comments = [
            {
                "id": c.get("id"),
                "author": (c.get("author") or {}).get("displayName"),
                "created": c.get("created"),
                "body": c.get("body"),  # kann ADF sein; für MVP ok
            }
            for c in raw_comments
        ]

        structured_issues.append(
            {
                "key": key,
                "summary": summary,
                "issue_type": issue_type,
                "assignee": assignee_name,
                "status": status_name,
                "status_category": status_category,
                "labels": labels,
                "comments": comments,
                "comments_total": (comment_field.get("total") or len(comments)),
                "duedate": duedate,
                "priority": priority,
                "statuscategorychangedate": statuscategorychangedate,
                "updated": updated,
            }
        )

    return structured_issues


@function_tool
def get_all_users_for_project(wrapper: RunContextWrapper[UserContext]) -> list:
    """
    Gibt eine Liste aller Benutzer mit Zugriff auf ein bestimmtes Jira-Projekt zurück.
    Liefert pro Benutzer: displayName, accountId, email (falls verfügbar).
    """

    access_token = wrapper.context.jira_token  # OAuth2 Access Token
    cloud_id = wrapper.context.jira_cloudId  # Jira Cloud-ID
    project_key = wrapper.context.jira_project_key

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }

    url = f"https://api.atlassian.com/ex/jira/{cloud_id}/rest/api/3/user/assignable/search?project={project_key}&maxResults=1000"

    response = requests.get(url, headers=headers)

    if response.status_code != 200:
        print(
            f"Fehler beim Abrufen der Benutzer: {response.status_code} – {response.text}"
        )
        return []

    users = response.json()

    return [
        {
            "displayName": user.get("displayName"),
            "accountId": user.get("accountId"),
            "emailAddress": user.get("emailAddress", None),
        }
        for user in users
    ]


@function_tool
def assign_issues_to_epic(
    wrapper: RunContextWrapper[UserContext],
    issue_task_keys: List[str],
    issue_epic_key: str,
) -> str:
    """
    Ordnet Tasks/Stories einem Epic zu.
    Robust: Company-managed (Epic Link) ODER Team-managed (parent=id).
    - Subtasks werden nicht direkt verknüpft (Hinweis ausgeben).
    - Liefert detaillierte Fehlermeldungen zurück.
    """
    import json

    import requests

    access_token = wrapper.context.jira_token
    cloud_id = wrapper.context.jira_cloudId

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }

    base_issue_url = f"https://api.atlassian.com/ex/jira/{cloud_id}/rest/api/3/issue"

    # --- 1) Epic validieren + ID holen ---
    epic_resp = requests.get(
        f"{base_issue_url}/{issue_epic_key}?fields=issuetype", headers=headers
    )
    if epic_resp.status_code != 200:
        return f"❌ Epic {issue_epic_key} nicht lesbar ({epic_resp.status_code}): {epic_resp.text}"
    epic_json = epic_resp.json()
    epic_type = (epic_json.get("fields", {}).get("issuetype") or {}).get("name")
    epic_id = epic_json.get("id")
    if (epic_type or "").lower() != "epic":
        return f"❌ {issue_epic_key} ist kein Epic (gefunden: {epic_type})."

    # --- 2) Epic Link Feld ID (Company-managed?) ---
    field_url = f"https://api.atlassian.com/ex/jira/{cloud_id}/rest/api/3/field"
    field_resp = requests.get(field_url, headers=headers)
    if field_resp.status_code != 200:
        return (
            f"❌ Feldliste nicht abrufbar ({field_resp.status_code}): {field_resp.text}"
        )

    epic_link_field_id = None
    for f in field_resp.json():
        if f.get("name") == "Epic Link":
            epic_link_field_id = f.get("id")
            break
    # epic_link_field_id bleibt None bei Team-managed

    results = []

    for key in issue_task_keys:
        # 2a) Issue lesen (Typ/Subtask prüfen)
        it_resp = requests.get(
            f"{base_issue_url}/{key}?fields=issuetype,parent", headers=headers
        )
        if it_resp.status_code != 200:
            results.append(
                f"❌ {key}: nicht lesbar ({it_resp.status_code}): {it_resp.text}"
            )
            continue

        it = it_resp.json()
        issue_type = (it.get("fields", {}).get("issuetype") or {}).get("name")
        is_subtask = (it.get("fields", {}).get("issuetype") or {}).get(
            "subtask"
        ) is True
        if is_subtask:
            parent_key = (it.get("fields", {}).get("parent") or {}).get("key")
            results.append(
                f"ℹ️ {key}: Subtask – bitte Parent {parent_key or '(unbekannt)'} dem Epic zuordnen (Subtasks können nicht direkt verknüpft werden)."
            )
            continue

        # --- 3) Company-managed Versuch: Epic Link setzen ---
        tried_epic_link = False
        if epic_link_field_id:
            tried_epic_link = True
            payload = {"fields": {epic_link_field_id: issue_epic_key}}
            put_resp = requests.put(
                f"{base_issue_url}/{key}", headers=headers, data=json.dumps(payload)
            )
            if put_resp.status_code == 204:
                results.append(f"✅ {key} → {issue_epic_key} (Epic Link) gesetzt.")
                continue
            else:
                # 400/403/... -> später Fallback versuchen
                results.append(
                    f"⚠️ {key}: Epic Link fehlgeschlagen ({put_resp.status_code}): {put_resp.text}"
                )

        # --- 4) Team-managed Fallback: parent setzen (id erforderlich) ---
        # Achtung: parent kann für Story/Task in Team-managed als Epic gesetzt werden.
        payload_parent = {"fields": {"parent": {"id": epic_id}}}
        put_resp2 = requests.put(
            f"{base_issue_url}/{key}", headers=headers, data=json.dumps(payload_parent)
        )
        if put_resp2.status_code == 204:
            results.append(f"✅ {key} → {issue_epic_key} (parent) gesetzt.")
        else:
            prefix = "❌" if not tried_epic_link else "❌ (Fallback)"
            results.append(
                f"{prefix} {key}: parent-Setzen fehlgeschlagen ({put_resp2.status_code}): {put_resp2.text}"
            )

    return "\n".join(results)


@function_tool
def update_jira_issue(
    wrapper: RunContextWrapper[UserContext],
    issue_key: str,
    fields: IssueUpdate,
) -> str:
    update_fields = {
        k: v for k, v in fields.dict(exclude_unset=True).items() if v is not None
    }
    return _jira_update_issue_fields(wrapper, issue_key, update_fields)


@function_tool
def create_subtask_under_parent(
    wrapper: RunContextWrapper[UserContext],
    parent_identifier: str,  # z.B. "Frontend erstellen" ODER "BIDA-123"
    subtask_summary: str,
    subtask_description: str = "",
) -> str:
    """
    Legt eine Subtask unter einem bestehenden Parent an.
    parent_identifier: Issue-Key (BIDA-123) ODER Summary ("Frontend erstellen")
    """
    import json

    import requests

    access_token = wrapper.context.jira_token
    cloud_id = wrapper.context.jira_cloudId
    project_key = wrapper.context.jira_project_key

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }

    # 1) Parent-Key auflösen (Key oder Summary)
    parent_key = None
    # Wenn es wie ein Key aussieht
    import re

    if re.match(r"^[A-Z][A-Z0-9]+-\d+$", parent_identifier):
        parent_key = parent_identifier
    else:
        # Suche Task mit exakt passendem Summary (keine Epics)
        jql = f'project = "{project_key}" AND summary ~ "{parent_identifier}" AND issuetype != Epic ORDER BY updated DESC'
        url_search = f"https://api.atlassian.com/ex/jira/{cloud_id}/rest/api/3/search"
        resp = requests.get(
            url_search,
            headers=headers,
            params={"jql": jql, "maxResults": 10, "fields": "summary,issuetype"},
        )
        resp.raise_for_status()
        hits = resp.json().get("issues", [])
        # Bevorzugt: exakter Summary-Match und ein singler Treffer
        exact = [
            i
            for i in hits
            if (i.get("fields", {}).get("summary") or "").strip().lower()
            == parent_identifier.strip().lower()
        ]
        chosen = exact[0] if exact else (hits[0] if hits else None)
        if not chosen:
            return f'❌ Kein Parent gefunden für "{parent_identifier}". Bitte Issue-Key angeben.'
        # Sicherheit: nicht auf Epic verlinken
        if (chosen.get("fields", {}).get("issuetype") or {}).get("name") == "Epic":
            return f"❌ Gefundener Parent ist ein Epic. Bitte Task-Key angeben (nicht Epic)."
        parent_key = chosen.get("key")

    # 2) Sub-task IssueType ermitteln (CreateMeta)
    url_meta = (
        f"https://api.atlassian.com/ex/jira/{cloud_id}/rest/api/3/issue/createmeta"
    )
    meta = requests.get(
        url_meta,
        headers=headers,
        params={"projectKeys": project_key, "expand": "projects.issuetypes.fields"},
    )
    meta.raise_for_status()
    projects = meta.json().get("projects", [])
    if not projects:
        return "❌ CreateMeta leer – keine Berechtigung oder falsches Projekt?"
    issuetypes = projects[0].get("issuetypes", [])
    subtask_type = next((it for it in issuetypes if it.get("subtask")), None)
    if not subtask_type:
        return "❌ In diesem Projekt ist kein Sub-task IssueType aktiviert."

    # 3) Subtask anlegen (nutzt denselben Bulk-Endpoint wie dein Tool)
    payload = {
        "issueUpdates": [
            {
                "fields": {
                    "summary": subtask_summary,
                    "description": convert_to_rich_text(subtask_description or ""),
                    "project": {"key": project_key},
                    "issuetype": {"id": subtask_type["id"]},  # ID ist robuster als Name
                    "parent": {"key": parent_key},
                }
            }
        ]
    }
    url_bulk = f"https://api.atlassian.com/ex/jira/{cloud_id}/rest/api/3/issue/bulk"
    res = requests.post(url_bulk, headers=headers, data=json.dumps(payload))
    if res.status_code == 201:
        data = res.json()
        created = [i["key"] for i in data.get("issues", [])]
        return f"✅ Subtask angelegt: {', '.join(created)} unter {parent_key}"
    return f"❌ Fehler {res.status_code}: {res.text}"


@function_tool
def add_jira_comment(
    wrapper: RunContextWrapper[UserContext],
    issue_key: str,
    body_markdown: str,
) -> str:
    """
    Fügt einem Issue einen Kommentar (Markdown/ADF Plaintext) hinzu.
    """
    access_token = wrapper.context.jira_token
    cloud_id = wrapper.context.jira_cloudId
    url = f"https://api.atlassian.com/ex/jira/{cloud_id}/rest/api/3/issue/{issue_key}/comment"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }
    # Einfaches ADF-Dokument (Paragraph mit Text)
    adf = {
        "body": {
            "type": "doc",
            "version": 1,
            "content": [
                {
                    "type": "paragraph",
                    "content": [{"type": "text", "text": body_markdown}],
                }
            ],
        }
    }
    r = requests.post(url, headers=headers, data=json.dumps(adf))
    if r.status_code in (201, 200):
        return f"✅ Kommentar zu {issue_key} hinzugefügt."
    return f"❌ Kommentar fehlgeschlagen ({r.status_code}): {r.text}"


@function_tool
def link_jira_issues(
    wrapper: RunContextWrapper[UserContext],
    inward_issue_key: str,  # z.B. DEVOPS-57 (der Blocker)
    outward_issue_key: str,  # z.B. BIDA-123  (das eigentliche Ticket)
    link_type: str = "Blocks",  # Jira-Linktyp, üblich: "Blocks", "Relates"
) -> str:
    """
    Verlinkt zwei Issues über /issueLink.
    Für 'Blocks': inward -> outward ergibt "DEVOPS-57 blocks BIDA-123".
    Für 'is blocked by' nimm link_type="Blocks" und drehe die Richtung.
    """
    access_token = wrapper.context.jira_token
    cloud_id = wrapper.context.jira_cloudId
    url = f"https://api.atlassian.com/ex/jira/{cloud_id}/rest/api/3/issueLink"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }
    payload = {
        "type": {"name": link_type},
        "inwardIssue": {"key": inward_issue_key},
        "outwardIssue": {"key": outward_issue_key},
    }
    r = requests.post(url, headers=headers, data=json.dumps(payload))
    if r.status_code in (201, 200, 204):
        return (
            f"✅ Link {inward_issue_key} -[{link_type}]-> {outward_issue_key} erstellt."
        )
    return f"❌ Issue-Link fehlgeschlagen ({r.status_code}): {r.text}"


@function_tool
def set_issue_labels(
    wrapper: RunContextWrapper[UserContext],
    issue_key: str,
    labels: List[str],
) -> str:
    if not isinstance(labels, list):
        return "❌ labels muss eine Liste sein"
    labels = [str(x) for x in labels if x is not None]
    # Direkt den internen Helper nutzen – kein Tool-zu-Tool Call!
    return _jira_update_issue_fields(wrapper, issue_key, {"labels": labels})
