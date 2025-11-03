function base64url(str) {
    return btoa(unescape(encodeURIComponent(str)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export const handleJiraConnection = () => {
    const clientId = process.env.NEXT_PUBLIC_JIRA_CLIENT_ID;
    const redirectUri = encodeURIComponent(process.env.NEXT_PUBLIC_JIRA_REDIRECT_URI || "");
    const scopes = encodeURIComponent([
        "read:jira-work",
        "write:jira-work",
        "manage:jira-project",
        "manage:jira-configuration",
        "read:jira-user",
        "manage:jira-webhook",
        "manage:jira-data-provider",
        "read:servicedesk-request",
        "manage:servicedesk-customer",
        "write:servicedesk-request",
        "read:servicemanagement-insight-objects",
        "read:me",
        "offline_access"
    ].join(" "));

    const nonce = crypto.randomUUID();
    // CSRF-Check: Nonce zusätzlich als Cookie setzen (10 Min gültig)
    document.cookie = `jira_oauth_nonce=${nonce}; Max-Age=600; Path=/; SameSite=Lax`;

    // State-Payload inkl. ausgewähltem Projekt verpacken
    const statePayload = { n: nonce };
    const packedState = base64url(JSON.stringify(statePayload));

    const authUrl =
        `https://auth.atlassian.com/authorize?audience=api.atlassian.com` +
        `&client_id=${clientId}` +
        `&scope=${scopes}` +
        `&redirect_uri=${redirectUri}` +
        `&state=${packedState}` + // <-- HIER
        `&response_type=code&prompt=consent`;

    window.location.href = authUrl;
};

export const handleSlackConnection = () => {
    const clientId = process.env.NEXT_PUBLIC_SLACK_CLIENT_ID;
    const redirectUri = encodeURIComponent(process.env.NEXT_PUBLIC_SLACK_REDIRECT_URI || "");
    const scopes = encodeURIComponent([
        "chat:write",
        "channels:history",
        "channels:read",
        "app_mentions:read",
        "users:read",
        "users:read.email"
    ].join(","));

    const state = crypto.randomUUID();
    sessionStorage.setItem("slack_oauth_state", state);
    const authUrl = `https://slack.com/oauth/v2/authorize?client_id=${clientId}&scope=${scopes}&redirect_uri=${redirectUri}&state=${state}`;

    window.location.href = authUrl;
};

export async function fetchJiraProjectsOptions(jwt) {
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/get-jira-projects`;
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${jwt}` } });
    if (!resp.ok) throw new Error("Failed to fetch Jira projects");
    const json = await resp.json();
    const projects = Array.isArray(json && json.data) ? json.data : [];
    return normalizeJiraProjects(projects);
}

export function normalizeJiraProjects(projects) {
    return projects.map((p) => ({
        id: String(p.id),
        label: p.name || p.key || `Project ${p.id}`,
        subtitle: p.key || undefined,
        iconUrl: (p.avatarUrls && (p.avatarUrls["16x16"] || p.avatarUrls["48x48"])) || undefined,
        data: p,
    }));
}


export const CONNECTORS = [
    {
        id: "jira",
        logoSrc: "/logos/jira.png",
        title: "Jira",
        email: "Not connected",
        onConfigure: handleJiraConnection,

        selectable: true,
        optionsLoader: async (getJwt) => {
            const jwt = await getJwt();
            return fetchJiraProjectsOptions(jwt);
        },
    },
    {
        id: "slack",
        logoSrc: "/logos/slack.png",
        title: "Slack",
        email: "Not connected",
        onConfigure: handleSlackConnection,
        selectable: false,
    }
];