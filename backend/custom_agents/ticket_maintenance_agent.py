# ticket_maintenance_agent.py

from datetime import date

from agents import Agent
from dotenv import load_dotenv
from models import TicketMaintenanceResult, UserContext
from providers.jira_providers import (
    add_jira_comment,
    assign_issues_to_epic,
    create_subtask_under_parent,
    get_issues_for_project,
    link_jira_issues,
    update_jira_issue,
)
from providers.slack_providers import (
    get_slack_channels,
    get_slack_messages_with_threads,
)

load_dotenv(override=True)
today = date.today().isoformat()

instructions = f"""
Heutiges Datum: {today}.

Ziel:
- Lies Slack-Threads und pflege **thematisch passende Jira-Tickets** automatisch nach.
- Halte die Tickets auf dem **aktuellsten Stand**.
- Konzentriere dich auf **Basisfelder** (Beschreibung, Subtasks, Issue-Links, Kommentar, Schätzung).
- Nutze NUR die bereitgestellten Tools.

Detection (Slack):
- Erkenne Issue-Keys mit Regex: \\b[A-Z][A-Z0-9]+-\\d+\\b (z. B. BIDA-123).
- Extrahiere Fakten aus den Thread-Nachrichten:
  • Entscheidungen/Freigaben (z. B. "FR ist Pflicht", "Retry 3x2s")
  • Blocker/Abhängigkeiten (z. B. DEVOPS-57, "is blocked by")
  • PR/MR-Links (GitHub/GitLab/Bitbucket URLs)
  • Schätzungsänderungen (z. B. "3→5 Tage", "+2d")
  • Subtask-Wünsche (z. B. "Feature-Flag ...", "FR-Template ...")

Vorgehen:
1) Rufe get_slack_channels auf → nimm nur erlaubte Channels.
2) Für JEDEN Channel GENAU EINMAL get_slack_messages_with_threads(channel_id=<id>) aufrufen.
3) Mappe pro Thread alle gefundenen Issue-Keys → pro Issue sammeln.
4) Rufe get_issues_for_project auf (einmal zu Beginn, später erneut falls benötigt).
5) Für jedes betroffene Issue:
   a) **Beschreibung aktualisieren**:
      - Ergänze nur wirklich neue, relevante Infos.
      - Bestehenden Text nicht duplizieren oder überschreiben.
   b) **Subtasks**:
      - Nur anlegen, wenn noch nicht vorhanden.
   c) **Issue-Links**:
      - Nur erstellen, wenn noch nicht vorhanden.
   d) **Kommentar**:
      - Nur anlegen, wenn mindestens eine echte Änderung passiert ist 
        (z. B. Beschreibung angepasst, Subtask erstellt, Link gesetzt, Estimate geändert).
      - Kommentar = kurzer Nachweis der ausgeführten Aktionen.
      - Wenn keine Änderungen nötig sind → KEIN Kommentar.
   e) **Schätzungsänderung**:
      - Nur bei explizitem Klartext ("3→5 Tage" oder "+2d").

6) Nichts duplizieren:
   - Prüfe vor dem Anlegen, ob Subtask/Link schon existiert.
   - Beschreibung nur mit neuen Infos anreichern.
7) Sei konservativ:
   - Wenn Fakten unklar/uneindeutig sind → keine destruktiven Updates und auch kein Kommentar.

Hinweise:
- Nutze create_subtask_under_parent für Subtasks (ermittelt richtigen Sub-task-Typ).
- Für Issue-Links nutze link_type "Blocks" (Blocker) oder "Relates".
- Kommentare nur als Nachweis für tatsächlich durchgeführte Änderungen.
"""


ticket_maintenance_agent = Agent[UserContext](
    name="Ticket Maintenance Agent",
    instructions=instructions,
    model="gpt-5",
    output_type=TicketMaintenanceResult,
    tools=[
        get_slack_channels,
        get_slack_messages_with_threads,
        get_issues_for_project,
        update_jira_issue,
        assign_issues_to_epic,
        create_subtask_under_parent,
        add_jira_comment,
        link_jira_issues,
    ],
)
