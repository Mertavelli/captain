from datetime import UTC, date, datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field

Severity = Literal["critical", "warning"]
EvidenceSource = Literal["status", "comment", "label"]


class SuccessResponse(BaseModel):
    success: bool = Field(
        ...,
        description="True, wenn save_planner_plan erfolgreich aufgerufen wurde, sonst False.",
    )
    message: str = Field(
        ...,
        description="Zusammenfassung der durchgeführten Aktionen oder Fehlerhinweis.",
    )
    found: int = Field(
        0, description="Anzahl gefundener Issues aus dem Projektüberblick."
    )
    created: int = Field(0, description="Anzahl neu geplanter Issues.")
    updated: int = Field(0, description="Anzahl aktualisierter Issues.")
    deleted: int = Field(0, description="Anzahl geplanter Löschungen.")


class Issue(BaseModel):
    summary: str = Field(
        ..., description="Kurzer Titel der Aufgabe, z. B. 'Teammeeting planen'"
    )
    description: str = Field(
        ..., description="Ausführliche Beschreibung, was zu tun ist"
    )
    issue_type: str = Field(
        ...,
        description="Art des Issues, z. B. 'Task', 'Sub-task', 'Epic'. Muss mit den Issue Types im Jira-Projekt übereinstimmen.",
    )
    due_date: Optional[str] = Field(
        None,
        description="Fälligkeitsdatum im Format YYYY-MM-DD (Jira-Standardfeld 'duedate')",
    )
    parent_issue_key: Optional[str] = Field(
        None,
        description="Key des Parent-Issues (nur für Subtasks erforderlich, z. B. 'QUAD-123')",
    )


class Assignee(BaseModel):
    account_id: str = Field(..., description="Eindeutige Jira-Account-ID des Assignees")
    display_name: str = Field(..., description="Anzeigename des Assignees")
    email: Optional[str] = Field(None, description="E-Mail-Adresse des Assignees")
    avatar_url: Optional[str] = Field(None, description="Avatar-URL des Assignees")


class IssueFields(BaseModel):
    status: str = Field(..., description="Aktueller Status, z. B. 'Zu erledigen'")
    due_date: Optional[str] = Field(None, description="YYYY-MM-DD")
    summary: str = Field(..., description="Kurzer Titel")
    description: Optional[str] = Field(None, description="Beschreibung")
    issue_type: str = Field(..., description="z. B. 'Task', 'Sub-task', 'Epic'")
    # Subtasks: entweder parent_issue_key ODER parent (das Tool konvertiert)
    parent_issue_key: Optional[str] = Field(
        None, description="Parent-Key für Subtasks, z. B. 'BIDA-123'"
    )
    assignee: Optional[Assignee] = Field(
        None, description="Zuweisung; bei Delete/teils Update optional"
    )


class PlannerIssue(BaseModel):
    id: Literal["static-id"] = Field("static-id", description="Fester statischer Wert")
    # Für CREATE darf key fehlen; das Tool generiert einen 4-Zeichen Key
    key: Optional[str] = Field(None, description="Jira-Key (bei Create optional)")
    fields: IssueFields = Field(..., description="Relevante Felder")
    change: Literal["create", "update", "delete"] = Field(
        ..., description="Änderungsart"
    )


class UserContext(BaseModel):
    user_id: Optional[str] = Field(
        default=None, description="Eindeutige ID des Nutzers"
    )
    captain_id: Optional[str] = Field(
        default=None, description="Eindeutige ID des Captains"
    )
    jira_url: Optional[str] = Field(
        default=None, description="Basis-URL deiner Jira-Instanz"
    )
    jira_email: Optional[str] = Field(default=None, description="Jira-Login-E-Mail")
    jira_token: Optional[str] = Field(
        default=None, description="Jira-Access-Token für Authentifizierung (OAuth2)"
    )
    jira_cloudId: Optional[str] = Field(
        default=None, description="Jira Cloud-ID für Zugriff auf die API mit OAuth2"
    )
    jira_project_key: Optional[str] = Field(
        default=None, description="Jira-Projektschlüssel, z. B. 'OPS' oder 'MARK'"
    )
    slack_token: Optional[str] = Field(
        default=None, description="Slack OAuth2 Access Token für die Slack Web-API"
    )
    channels: Optional[List[str]] = Field(
        default=None, description="Liste der für das Projekt aktivierten Channel-IDs"
    )
    today: str = Field(
        default_factory=lambda: date.today().isoformat(),
        description="Das aktuelle Tagesdatum im Format YYYY-MM-DD",
    )


class IssueUpdate(BaseModel):
    summary: Optional[str] = Field(None, description="Neuer Titel")
    description: Optional[str] = Field(None, description="Neue Beschreibung")
    duedate: Optional[str] = Field(
        None, description="Neues Fälligkeitsdatum im Format YYYY-MM-DD"
    )
    # parent_issue_key hier NICHT aufführen!


class BlockerItem(BaseModel):
    task_key: str = Field(..., description="Issue-Key, z. B. BIDA-123.")
    type: Severity = Field(..., description="Schweregrad: critical | warning.")
    message: str = Field(..., description="Kurzer, menschlicher Hinweis.")
    recommendation: Optional[str] = Field(
        None, description="Konkreter nächster Schritt (optional)."
    )
    source: Optional[EvidenceSource] = Field(
        None, description="Hauptquelle der Einstufung: status | comment | label."
    )
    hits: Optional[List[str]] = Field(
        None, description="Gefundene Schlüsselwörter/Fragmente (optional)."
    )


class SystemContext(BaseModel):
    captain_id: str = Field(..., description="ID des zugehörigen Captains")
    context_key: str = Field(..., description="Projekt-Key (z. B. aus Jira)")
    user_id: str = Field(..., description="ID des Users")


class TaskResult(BaseModel):
    success: bool


class Actor(BaseModel):
    name: str = Field(..., description="Name der Person, die das Event ausgelöst hat")
    id: str = Field(..., description="Eindeutige ID des Actors")


class Dates(BaseModel):
    start: Optional[str] = Field(None, description="Startdatum der Aufgabe")
    due: Optional[str] = Field(None, description="Fälligkeitsdatum der Aufgabe")


class Fields(BaseModel):
    name: Optional[str] = Field(None, description="Name der Aufgabe")
    description: Optional[str] = Field(None, description="Beschreibung der Aufgabe")
    status: Optional[str] = Field(None, description="Status der Aufgabe")
    priority: Optional[str] = Field(None, description="Priorität der Aufgabe")
    assignee: Optional[str] = Field(None, description="Zugewiesene Person")
    dates: Optional[Dates] = Field(None, description="Datumsangaben der Aufgabe")


class DiffItem(BaseModel):
    field: Optional[str] = Field(None, description="Geändertes Feld")
    before: Optional[str] = Field(None, description="Wert vor der Änderung")
    after: Optional[str] = Field(None, description="Wert nach der Änderung")


class WebhookEvent(BaseModel):
    ts: datetime = Field(..., description="Zeitstempel des Events")
    event: str = Field(..., description="Art des Events (z. B. jira:issue_updated)")
    projectKey: str = Field(..., description="Projekt-Key in Jira")
    summary: Optional[str] = Field(None, description="Kurze Zusammenfassung")
    actor: Actor = Field(..., description="Informationen zum Actor")
    fields: Optional[Fields] = Field(None, description="Details der Aufgabe")
    diff: Optional[List[DiffItem]] = Field(None, description="Liste der Änderungen")
    context_key: str = Field(..., description="Projekt-Key (z. B. aus Jira)")


class Task(BaseModel):
    name: str = Field(..., description="Name der Task")
    description: Optional[str] = Field(None, description="Beschreibung der Task")
    status: str = Field(..., description="Aktueller Status der Task")
    priority: Optional[str] = Field(None, description="Priorität der Task")
    due_date: Optional[date] = Field(None, description="Fälligkeitsdatum der Task")
    history: List[WebhookEvent] = Field(
        default_factory=list, description="Änderungshistorie der Task"
    )
    source_system: List[str] = Field(
        default_factory=list,
        description="Liste aller Software, von denen Events kommen",
    )
    rolling_summary: str = Field(
        ..., description="Immer aktuelle Zusammenfassung der Task"
    )
    script: str = Field(..., description="Script zur Ausführung der Tools")
    script_version: int = Field(1, description="Version des Scripts")


class TaskPatch(BaseModel):
    """Nur die Felder, die bei einem Update geändert werden dürfen (alle optional)."""

    name: Optional[str] = Field(None, description="Neuer Name der Task")
    description: Optional[str] = Field(None, description="Neue Beschreibung")
    status: Optional[str] = Field(None, description="Neuer Status")
    priority: Optional[str] = Field(None, description="Neue Priorität")
    due_date: Optional[date] = Field(None, description="Neues Fälligkeitsdatum")
    source_system: Optional[List[str]] = Field(
        None, description="Zusätzliche/quellende Systeme"
    )
    rolling_summary: Optional[str] = Field(
        None, description="Aktualisierte Zusammenfassung"
    )
    script: Optional[str] = Field(None, description="Aktualisiertes Script")
    script_version: Optional[int] = Field(
        None, description="Script-Version (inkrementell erhöhen)"
    )


class CTDecision(BaseModel):
    """
    Agent-Ausgabe: Zuordnung eines Events zu Topics (Primary + optional Secondary).
    """

    mode: Literal["attach", "new"] = Field(
        ...,
        description=(
            "attach = Event wurde einem bestehenden Topic zugeordnet; "
            "new = es wurde ein neues Topic angelegt (topic_id zeigt auf das neue Topic)."
        ),
    )
    topic_id: str = Field(
        ...,
        min_length=3,
        description=(
            "Primary-Topic-ID im Format '<scope>:topic:<slug>-<hash6>'. "
            "Bei mode='attach' ist dies ein bestehendes Topic; bei mode='new' das soeben erstellte."
        ),
    )
    secondary: List[str] = Field(
        default_factory=list,
        description=(
            "Weitere passende Topic-IDs als Secondary-Links (ohne Primary). "
            "Maximal 3, jeweils eindeutige IDs."
        ),
    )
    title: Optional[str] = Field(
        None,
        description=(
            "Menschlicher, prägnanter Titel NUR bei mode='new' erforderlich "
            "(z. B. 'API Timeouts – Checkout Service'). Bei mode='attach' leer lassen."
        ),
    )
    labels: List[str] = Field(
        default_factory=lambda: ["pm"],
        description=(
            "Labels für das neu angelegte Topic oder zur Validierung beim Attach "
            "(z. B. ['pm','incident']). Doppelwerte werden entfernt."
        ),
    )
    reason: str = Field(
        ...,
        min_length=3,
        max_length=300,
        description=(
            "Kurze, klare Begründung für die Wahl des Primary-Topics und evtl. Secondary-Topics."
        ),
    )
    confidence: Optional[float] = Field(
        None,
        ge=0.0,
        le=1.0,
        description="Optionales Vertrauen (0..1) für die Primary-Entscheidung.",
    )


class EventLite(BaseModel):
    event_id: str
    t: str
    type: Optional[str] = None
    actor: Optional[str] = None
    title: Optional[str] = None
    body: Optional[str] = None


class IssueContext(BaseModel):
    issue_key: str
    web_url: Optional[str] = None
    events: List[EventLite]


Priority = Literal["low", "medium", "high"]


class TaskSuggestion(BaseModel):
    issue_key: str = Field(..., description="Jira-Key, z. B. 'BIDA-2'.")
    title: str = Field(
        ..., description="Kurzer, handlungsorientierter Titel (< 12 Wörter)."
    )
    reason: str = Field(
        ..., description="Ein Satz: Warum ist die Task nötig? (aus Events abgeleitet)."
    )
    description: str = Field(
        ..., description="2–3 Sätze Kontext, Ziel und relevante Details."
    )
    priority: Priority = Field(..., description="Priorität: 'low' | 'medium' | 'high'.")
    plan: str = Field(
        ...,
        description="Knappes Ausführungsskript/Schrittfolge als Freitext für den Executor-Agent.",
    )


class ExistingTaskLite(BaseModel):
    id: str = Field(..., description="Task-UUID")
    issue_key: str = Field(..., description="Jira-Key, z. B. 'BIDA-2'.")
    title: str = Field(..., description="Kurzer, handlungsorientierter Titel.")
    status: Literal["pending_approval", "in_progress", "done", "cancelled"] = Field(
        ..., description="Aktueller Status der Task."
    )
    priority: Literal["low", "medium", "high"] = Field(
        ..., description="Priorität der Task."
    )
    created_at: str = Field(..., description="Erstellzeitpunkt (ISO, timestamptz).")
    updated_at: str


class TaskRow(BaseModel):
    id: str = Field(..., description="Task-UUID")
    captain_id: str = Field(..., description="Captain-UUID")
    issue_key: str = Field(..., description="Jira-Key, z. B. 'BIDA-2'")
    title: str = Field(..., description="Handlungsorientierter Titel")
    reason: str = Field(..., description="Kurzbegründung (1 Satz)")
    description: str = Field(..., description="Mehr Kontext/Details (2–3 Sätze)")
    priority: Literal["low", "medium", "high"] = Field(
        ..., description="Task-Priorität"
    )
    plan: str = Field(..., description="Ausführungsplan als Freitext")
    status: Literal["pending_approval", "in_progress", "done", "cancelled"] = Field(
        ..., description="Task-Status"
    )
    created_at: str = Field(..., description="Erstellt (timestamptz)")
    updated_at: str = Field(..., description="Zuletzt geändert (timestamptz)")


class IssueChange(BaseModel):
    key: str
    changes: List[
        Literal[
            "description_append",
            "subtasks_created",
            "issue_link_added",
            "comment_added",
            "estimate_updated",
        ]
    ]


class TicketMaintenanceResult(BaseModel):
    done: bool = Field(
        ..., description="Setze True, wenn alle Schritte abgeschlossen sind."
    )
    channels_processed: int = 0
    threads_scanned: int = 0
    issues_updated: List[IssueChange] = []
    notes: List[str] = []


class BlockerHit(BaseModel):
    key: str
    level: Literal["critical", "warning"]
    reason: str
    source: Optional[str] = None  # z.B. "slack:#sozial" oder "jira:status"


class BlockerScanResult(BaseModel):
    done: bool = Field(..., description="True, wenn Scan & Flagging abgeschlossen.")
    channels_processed: int = 0
    messages_scanned: int = 0
    critical_count: int = 0
    warning_count: int = 0
    issues_flagged: int = 0  # Anzahl Issues, an denen Labels gesetzt/geändert wurden
    hits: List[BlockerHit] = Field(
        default_factory=list
    )  # optional, aber praktisch fürs UI
    notes: List[str] = Field(default_factory=list)
