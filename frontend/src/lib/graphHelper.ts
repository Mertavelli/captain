import 'dotenv/config';
import { Client } from '@microsoft/microsoft-graph-client';
import { ClientSecretCredential } from '@azure/identity';
import { TokenCredentialAuthenticationProvider }
    from '@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials';

// ---- Config aus ENV (niemals hardcoden) ----
const TENANT_ID = process.env.MICROSOFT_APP_TENANT_ID!;
const CLIENT_ID = process.env.MICROSOFT_APP_ID!;
const CLIENT_SECRET = process.env.MICROSOFT_APP_PASSWORD!;
const CALLBACK_URI = process.env.BOT_CALLBACK_URI!; // z.B. https://yourdomain/api/teams/bot/calling

// ---- Graph Client (App-Only) ----
let _graphClient: Client | null = null;
export function getGraphClient(): Client {
    if (_graphClient) return _graphClient;

    const credential = new ClientSecretCredential(TENANT_ID, CLIENT_ID, CLIENT_SECRET);
    const authProvider = new TokenCredentialAuthenticationProvider(credential, {
        scopes: ['https://graph.microsoft.com/.default'], // App-Only
    });

    _graphClient = Client.initWithMiddleware({ authProvider });
    return _graphClient;
}

// ---- Call starten: Variante A (threadId + Organizer) ----
export async function createCallWithThreadAndOrganizer(params: {
    threadId: string;                 // "19:meeting_...@thread.v2"
    organizerUserId: string;          // GUID des Organizers
    organizerDisplayName?: string;
    allowConversationWithoutHost?: boolean;
    tenantId?: string;
}) {
    const client = getGraphClient();
    const tenantId = params.tenantId ?? TENANT_ID;

    const callPayload = {
        '@odata.type': '#microsoft.graph.call',
        direction: 'outgoing',
        callbackUri: CALLBACK_URI,
        requestedModalities: ['audio'],
        mediaConfig: {
            '@odata.type': '#microsoft.graph.serviceHostedMediaConfig',
            // optional: initial audio files für Prompt/Join
            preFetchMedia: [
                { uri: 'https://cdn.contoso.com/beep.wav', resourceId: 'beep' },
                { uri: 'https://cdn.contoso.com/cool.wav', resourceId: 'cool' },
            ],
        },
        chatInfo: {
            '@odata.type': '#microsoft.graph.chatInfo',
            threadId: params.threadId,
            messageId: '0',
        },
        meetingInfo: {
            '@odata.type': '#microsoft.graph.organizerMeetingInfo',
            organizer: {
                '@odata.type': '#microsoft.graph.identitySet',
                user: {
                    '@odata.type': '#microsoft.graph.identity',
                    id: params.organizerUserId,
                    tenantId,
                    displayName: params.organizerDisplayName ?? 'Organizer',
                },
            },
            allowConversationWithoutHost: params.allowConversationWithoutHost ?? true,
        },
        tenantId,
    };

    return client.api('/communications/calls').post(callPayload);
}
