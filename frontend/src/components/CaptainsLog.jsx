'use client'

import React, { useState, useEffect } from "react"
import { mockEntries } from "@/helpers/mockData";
import { mockProjects } from "@/helpers/mockData";
import ConnectorCard from "./ConnectorCard";
import { createClient } from "@/utils/supabase/client";
import { BentoDemo } from "./BentoDemo";

export default function CaptainsLog({ }) {
    const [jiraEmail, setJiraEmail] = useState(null)
    const [slackEmail, setSlackEmail] = useState(null)

    useEffect(() => {
        const supabase = createClient();

        const fetchEmails = async () => {
            // Jira Email
            const { data: jiraData } = await supabase
                .from('jira_connections')
                .select('email')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            setJiraEmail(jiraData?.email || null);

            // Slack Email
            const { data: slackData } = await supabase
                .from('slack_connections')
                .select('email')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            setSlackEmail(slackData?.email || null);
        };

        fetchEmails();
    }, []);

    const handleJiraConnection = () => {
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

        const state = crypto.randomUUID();
        sessionStorage.setItem("jira_oauth_state", state);

        const authUrl = `https://auth.atlassian.com/authorize?audience=api.atlassian.com&client_id=${clientId}&scope=${scopes}&redirect_uri=${redirectUri}&state=${state}&response_type=code&prompt=consent`;

        window.location.href = authUrl;
    };

    const handleSlackConnection = () => {
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

    return (
        <div className="flex flex-col gap-4">
            <div className="mt-4 flex items-start w-full gap-4">

                <div className="w-[100%]">
                    <h2 className="heading mb-4">
                        Endless Possibilities
                    </h2>

                    <BentoDemo />
                </div>

                {/*                 <div className="flex flex-col gap-2 w-[30%]">
                    <h2 className="heading mb-2">
                        Connect your tools
                    </h2>
                    <ConnectorCard
                        logoSrc={"/logos/jira.png"}
                        title={"Jira Atlassian"}
                        email={jiraEmail || "Nicht verbunden"}
                        onConfigure={handleJiraConnection}
                    />
                    <ConnectorCard
                        logoSrc={"/logos/slack.png"}
                        title={"Slack"}
                        email={slackEmail || "Nicht verbunden"}
                        onConfigure={handleSlackConnection}
                    />
                </div> */}
            </div>
        </div>

    )
}
