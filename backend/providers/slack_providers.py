import requests
from agents import RunContextWrapper, function_tool
from models import UserContext


@function_tool
def get_slack_channels(wrapper: RunContextWrapper[UserContext]) -> list[dict]:
    """
    Ruft alle verfügbaren Slack-Channels (ID und Name) auf.
    """
    access_token = wrapper.context.slack_token
    allowed_channel_ids = set(wrapper.context.channels or [])

    url = "https://slack.com/api/conversations.list"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/x-www-form-urlencoded",
    }

    response = requests.get(url, headers=headers)
    if response.status_code != 200:
        print(f"Fehler: {response.status_code} – {response.text}")
        return []

    data = response.json()
    if not data.get("ok"):
        print(f"Slack API Error: {data.get('error')}")
        return []

    channels = data.get("channels", [])
    simplified_channels = [
        {"id": ch["id"], "name": ch["name"]}
        for ch in channels
        if ch["id"] in allowed_channel_ids
    ]

    return simplified_channels


@function_tool
def get_slack_messages(
    wrapper: RunContextWrapper[UserContext], channel_id: str
) -> list[dict]:
    """
    Holt die letzten 20 Nachrichten aus einem Slack-Channel (nur Top-Level).
    """
    access_token = wrapper.context.slack_token
    limit = 20  # Fest codiertes Limit

    url = "https://slack.com/api/conversations.history"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/x-www-form-urlencoded",
    }
    params = {"channel": channel_id, "limit": limit}

    response = requests.get(url, headers=headers, params=params)
    if response.status_code != 200:
        print(f"Fehler: {response.status_code} – {response.text}")
        return []

    data = response.json()
    if not data.get("ok"):
        print(f"Slack API Error: {data.get('error')}")
        return []

    messages = data.get("messages", [])
    simplified = [
        {
            "text": msg.get("text"),
            "user": msg.get("user"),
            "ts": msg.get("ts"),
            "type": msg.get("type"),
            "subtype": msg.get("subtype", None),
        }
        for msg in messages
    ]

    return simplified


@function_tool
def get_slack_messages_with_threads(
    wrapper: RunContextWrapper[UserContext], channel_id: str
) -> list[dict]:
    """
    Holt die letzten 20 Nachrichten aus einem Slack-Channel,
    inklusive aller Thread-Replies zu jeder Top-Level-Nachricht.
    """
    access_token = wrapper.context.slack_token
    limit = 20

    url_history = "https://slack.com/api/conversations.history"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/x-www-form-urlencoded",
    }
    params = {"channel": channel_id, "limit": limit}

    response = requests.get(url_history, headers=headers, params=params)
    if response.status_code != 200:
        print(f"Fehler: {response.status_code} – {response.text}")
        return []

    data = response.json()
    if not data.get("ok"):
        print(f"Slack API Error: {data.get('error')}")
        return []

    messages = data.get("messages", [])
    results = []

    for msg in messages:
        item = {
            "text": msg.get("text"),
            "user": msg.get("user"),
            "ts": msg.get("ts"),
            "type": msg.get("type"),
            "subtype": msg.get("subtype", None),
            "replies": [],
        }

        # Prüfen, ob Thread existiert
        thread_ts = msg.get("thread_ts") or msg.get("ts")
        if msg.get("reply_count", 0) > 0:
            url_replies = "https://slack.com/api/conversations.replies"
            params_replies = {"channel": channel_id, "ts": thread_ts, "limit": 50}
            res_replies = requests.get(
                url_replies, headers=headers, params=params_replies
            )

            if res_replies.status_code == 200:
                data_replies = res_replies.json()
                if data_replies.get("ok"):
                    replies = data_replies.get("messages", [])
                    # exclude die erste Nachricht (Obernachricht), nur echte Replies
                    item["replies"] = [
                        {
                            "text": r.get("text"),
                            "user": r.get("user"),
                            "ts": r.get("ts"),
                        }
                        for r in replies
                        if r.get("ts") != msg.get("ts")
                    ]
        results.append(item)

    return results
