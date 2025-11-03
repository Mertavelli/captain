// src/app/(app)/api/jira/callback/route.js
import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'

// Base64URL → JSON (Node: Buffer statt atob)
function base64urlDecodeToJson(str) {
    try {
        let s = (str || '').replace(/-/g, '+').replace(/_/g, '/')
        while (s.length % 4) s += '='
        const json = Buffer.from(s, 'base64').toString('utf8')
        return JSON.parse(json)
    } catch {
        return {}
    }
}

export async function GET(request) {
    const supabase = await createClient()
    const url = new URL(request.url)
    const code = url.searchParams.get('code')
    const stateParam = url.searchParams.get('state') // CSRF (+ evtl. proj, aber hier ungenutzt)
    const cookieStore = await cookies()

    // ---- 0) State/Nonce prüfen ----
    const state = base64urlDecodeToJson(stateParam)
    const nonceFromState = state?.n
    const nonceCookie = cookieStore.get('jira_oauth_nonce')?.value
    if (!nonceFromState || !nonceCookie || nonceFromState !== nonceCookie) {
        console.error('Invalid OAuth state/nonce')
        return redirectTo(url, '/error?reason=invalid_state')
    }
    // Cookie invalidieren (optional)
    cookieStore.set('jira_oauth_nonce', '', { maxAge: 0, path: '/' })

    // 1) Supabase-User prüfen
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (!user || userError) {
        console.error('User authentication failed:', userError)
        return redirectTo(url, '/auth/login?error=auth_required')
    }

    // 2) Code prüfen
    if (!code) {
        console.error('Missing authorization code')
        return redirectTo(url, '/error?reason=missing_code')
    }

    try {
        // 3) Token holen
        console.log(`Fetching token for user ${user.id}`)
        const tokenData = await fetchToken(code)
        if (!tokenData?.access_token) {
            console.error('Token fetch failed:', tokenData)
            return redirectTo(url, '/error?reason=token_failed')
        }

        // 4) Jira-Userdaten holen
        const me = await fetchJiraUser(tokenData.access_token)
        if (!me?.account_id) {
            console.error('Jira user fetch failed:', me)
            return redirectTo(url, '/error?reason=jira_user_failed')
        }

        // 5) Jira-Site-Info holen (alle verfügbaren Sites)
        const jiraSites = await fetchJiraSiteInfo(tokenData.access_token)
        if (!jiraSites || jiraSites.length === 0) {
            console.error('No Jira sites found')
            return redirectTo(url, '/error?reason=no_jira_site')
        }

        // Erste verfügbare Site verwenden (oder später Auswahl ermöglichen)
        const primarySite = jiraSites[0]

        // 6) Bestehende Verbindung bereinigen
        await supabase.from('jira_connections').delete().eq('user_id', user.id)

        // 7) Nur die Verbindung speichern (KEINE Webhooks, KEIN projectKey)
        const { error: dbError1 } = await supabase
            .from('jira_connections')
            .upsert({
                user_id: user.id,
                jira_account_id: me.account_id,
                email: me.email,
                name: me.name,
                access_token: tokenData.access_token,
                refresh_token: tokenData.refresh_token,
                jira_url: primarySite.url,
                cloud_id: primarySite.cloudId,
                scope: tokenData.scope,
                updated_at: new Date().toISOString(),
                created_at: new Date().toISOString(),
            }, { onConflict: 'jira_account_id' })

        if (dbError1) {
            console.error('DB Insert Error:', dbError1)
            return redirectTo(url, '/error?reason=db_failed')
        }

        // Optional: Token-Refresh planen (nur Logging)
        try {
            await scheduleTokenRefresh(user.id, tokenData.expires_in)
        } catch (scheduleError) {
            console.warn('Token refresh scheduling failed:', scheduleError)
        }

        // 8) Weiterleitung zurück ins Frontend (nur „connected“-Info)
        const successParams = new URLSearchParams({
            connected: 'jira',
            site: primarySite.name || 'Unknown'
        })
        return redirectTo(url, `/pages/dashboard?${successParams.toString()}`)

    } catch (error) {
        console.error('Jira OAuth callback error:', error)

        // Cleanup: Verbindung löschen
        try {
            await supabase.from('jira_connections').delete().eq('user_id', user?.id)
        } catch (cleanupError) {
            console.error('Cleanup failed:', cleanupError)
        }

        return redirectTo(url, `/error?reason=callback_failed&details=${encodeURIComponent(error.message)}`)
    }
}

/* ----------------- Helpers ----------------- */

function redirectTo(baseUrl, path) {
    const targetUrl = new URL(path, baseUrl.origin)
    return NextResponse.redirect(targetUrl)
}

async function fetchToken(code) {
    const tokenRequest = {
        grant_type: 'authorization_code',
        client_id: process.env.JIRA_CLIENT_ID,
        client_secret: process.env.JIRA_CLIENT_SECRET,
        code,
        redirect_uri: process.env.JIRA_REDIRECT_URI,
    }

    const res = await fetch('https://auth.atlassian.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'YourApp/1.0' },
        body: JSON.stringify(tokenRequest),
    })

    if (!res.ok) {
        const errorText = await res.text()
        throw new Error(`Token fetch failed: ${res.status} ${res.statusText} - ${errorText}`)
    }
    return res.json()
}

async function fetchJiraUser(access_token) {
    const res = await fetch('https://api.atlassian.com/me', {
        headers: { Authorization: `Bearer ${access_token}`, 'User-Agent': 'YourApp/1.0' },
    })
    if (!res.ok) {
        const errorText = await res.text()
        throw new Error(`Jira user fetch failed: ${res.status} ${res.statusText} - ${errorText}`)
    }
    return res.json()
}

async function fetchJiraSiteInfo(access_token) {
    const res = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
        headers: { Authorization: `Bearer ${access_token}`, Accept: 'application/json', 'User-Agent': 'YourApp/1.0' },
    })
    if (!res.ok) {
        const errorText = await res.text()
        throw new Error(`Jira site info fetch failed: ${res.status} ${res.statusText} - ${errorText}`)
    }
    const data = await res.json()
    const jiraSites = data?.filter(resource =>
        resource.url?.includes('atlassian.net') &&
        resource.scopes?.includes('read:jira-work')
    )
    return jiraSites?.map(site => ({ url: site.url, cloudId: site.id, name: site.name })) || []
}

async function scheduleTokenRefresh(userId, expiresIn) {
    console.log(`Token expires in ${expiresIn} seconds for user ${userId}`)
    const refreshTime = (expiresIn - 3600) * 1000
    if (refreshTime > 0) console.log(`Should schedule token refresh in ${refreshTime}ms`)
}
