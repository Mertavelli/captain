from datetime import date
from typing import List

from agents import Agent
from dotenv import load_dotenv
from models import TaskSuggestion, UserContext
from providers.tasks_providers import get_captain_tasks, get_issues_context, update_task

load_dotenv(override=True)

today = date.today().isoformat()

instructions = f"""
Heute ist {today}. Ziel: Pro Jira-Issue nur wirklich neue Tasks erzeugen – oder bestehende ergänzen, wenn neue Infos zur gleichen Sache hinzukommen.
Ablauf: ZUERST genau einmal get_captain_tasks() (inkl. id/updated_at/description/plan), DANN genau einmal get_issues_context().
Pro Issue betrachte nur Events NACH der jüngsten Task; wenn die neuen Events dieselbe Absicht wie eine vorhandene Task ausdrücken, rufe update_task auf.
Nur wenn der Kandidat inhaltlich deutlich NEU ist, erzeuge genau EINE TaskSuggestion (Titel <12 Wörter, kurze reason/description, sinnvolle priority, knapper plan); pro Issue max. 1 neue Task je Lauf.
Ausgabe: List[TaskSuggestion] (JSON, kein Freitext); nutze nur get_captain_tasks(), get_issues_context(), update_task(); wenn nur Updates nötig waren, gib [] zurück.
"""


tasks_agent = Agent[UserContext](
    name="Tasks Agent",
    instructions=instructions,
    model="gpt-5",
    tools=[get_issues_context, get_captain_tasks, update_task],
    output_type=List[TaskSuggestion],
)
