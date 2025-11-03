# blocker_agent.py
from datetime import date

from agents import Agent
from dotenv import load_dotenv
from models import BlockerScanResult, UserContext
from providers.jira_providers import set_issue_labels  # << NEU
from providers.jira_providers import (
    update_jira_issue,  # kann drin bleiben, wird aber vom Wrapper genutzt
)
from providers.jira_providers import get_issues_for_project
from providers.slack_providers import (
    get_slack_channels,
    get_slack_messages_with_threads,
)

load_dotenv(override=True)
today = date.today().isoformat()

instructions = f"""
Heutiges Datum: {today}.

Ziel:
- Scanne Jira-Issues und Slack-Nachrichten (inkl. Threads) nach Blockern/Warnungen.
- Flagge betroffene Jira-Issues über Labels:
  - Critical → Label 'blocker_critical'
  - Warning  → Label 'blocker_warning'
- Liefere am Ende ein kompaktes Ergebnisobjekt (done, Counts, optional Hits/Notes).

Vorgehen (strict):
1) Rufe EINMAL get_issues_for_project auf (liefert Status, Labels, Assignee, DueDate, Kommentare etc.).
2) Rufe EINMAL get_slack_channels auf (nur erlaubte Channels).
3) Für JEDEN Channel GENAU EINMAL get_slack_messages_with_threads(channel_id=<id>) aufrufen (letzte 20 Nachrichten inkl. Thread-Replies).
4) Erkenne Blocker/Warnungen:
   - Einstufung per Regeln (zuerst CRITICAL prüfen, dann WARNING; keine Dopplungen).
   - Hinweise aus Slack berücksichtigen (z.B. „blockiert“, „warte auf“, „kein Zugang“).
   - Entblockt-/Aufgelöst-Signale („unblocked“, „resolved“, „done“, „erledigt“) setzen den Status für dieses Issue auf „kein Blocker“.

5) Flagging in Jira (sehr wichtig, Mutual Exclusion):
   - Hole die existierenden Labels eines Issues aus get_issues_for_project (Liste von Strings).
   - Entferne aus einer Arbeitskopie IMMER beide Blocker-Labels {'blocker_critical','blocker_warning'}.
     => base_labels = existing_labels OHNE diese beiden.
   - Bestimme flag_label:
       • 'blocker_critical', falls kritisch,
       • 'blocker_warning', falls nur Warnung,
       • None, wenn kein Blocker.
   - Baue new_labels:
       • Wenn flag_label ist None: new_labels = base_labels (Blocker-Labels werden entfernt).
       • Sonst: new_labels = base_labels + [flag_label] (genau EIN Blocker-Label).
   - Rufe set_issue_labels(issue_key=<KEY>, labels=new_labels) GENAU EINMAL auf,
     ABER NUR wenn sich der Label-Satz wirklich ändert (set(new_labels) != set(existing_labels)).
   - Andere (fachliche) Labels NIEMALS entfernen oder verändern.

6) Ergebnisobjekt füllen:
   - channels_processed, messages_scanned (Summe aller Channel-Hauptposts + Thread-Replies),
   - critical_count, warning_count (erkannte Fälle),
   - issues_flagged = Anzahl erfolgreicher Label-Änderungen via set_issue_labels,
   - Optional hits[]: (key, level, reason, source) und notes[].

7) Konservativ handeln:
   - Keine Fantasie-Blocker.
   - Wenn Zuordnung unklar → KEIN Label-Update; nur Hit/Note erfassen.

8) Idempotenz & Konflikte:
   - Wenn beide Blocker-Labels bereits gesetzt sind, normalisiere auf genau eines:
     'blocker_critical' hat Vorrang vor 'blocker_warning'.
   - Wenn widersprüchliche Signale in einem Thread/Zeitraum auftreten, bevorzugt die neueste Information.
   - Bei expliziter Entblockung („unblocked“, „resolved“) → beide Blocker-Labels entfernen (new_labels = base_labels).

9) Abschluss:
   - Setze 'done' auf true und beende.
"""


blocker_agent = Agent[UserContext](
    name="Blocker Agent",
    instructions=instructions,
    model="gpt-5",
    tools=[
        get_issues_for_project,
        get_slack_channels,
        get_slack_messages_with_threads,
        set_issue_labels,  # << dem Modell eine einfache, klare API geben
        update_jira_issue,  # optional (kann bleiben)
    ],
    output_type=BlockerScanResult,
)

blocker_tool = blocker_agent.as_tool(
    tool_name="blocker_tool",
    tool_description="Scannt Jira & Slack auf Blocker/Warnungen und flaggt Issues via Labels.",
)
