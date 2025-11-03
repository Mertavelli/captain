import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(request) {
    const supabase = await createClient()
    const url = new URL(request.url)
    const code = url.searchParams.get('code')

    // 1. Supabase-User prüfen
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (!user || userError) return redirectTo(url, '/')

    // 2. Code prüfen
    if (!code) return redirectTo(url, '/error?reason=missing_code')

    // 3. Slack-Token holen
    const tokenData = await fetchSlackToken(code)
    if (!tokenData?.access_token) return redirectTo(url, '/error?reason=token_failed')

    // 4. Team-/Userdaten extrahieren
    const team_id = tokenData?.team?.id
    const team_name = tokenData?.team?.name
    const bot_user_id = tokenData?.bot_user_id
    const authed_user_id = tokenData?.authed_user?.id

    if (!team_id || !bot_user_id || !authed_user_id) return redirectTo(url, '/error?reason=slack_user_failed')

    // 5. Slack User-Info holen (für E-Mail)
    const slackUser = await fetchSlackUser(tokenData.access_token, authed_user_id)
    const email = slackUser?.user?.profile?.email ?? null

    // 6. In Supabase speichern (upsert: user_id + team_id als conflict)
    const { error: dbError } = await supabase.from('slack_connections').upsert({
        user_id: user.id,
        team_id,
        team_name,
        access_token: tokenData.access_token,
        bot_user_id,
        authed_user_id,
        email,
        created_at: new Date().toISOString(),
    }, { onConflict: 'user_id,team_id' })

    if (dbError) {
        console.error("DB Insert Error:", dbError)
        return redirectTo(url, '/error?reason=db_failed')
    }

    // 7. Erfolg!
    return redirectTo(url, '/pages/dashboard')
}

// -------------------------
// Hilfsfunktionen
// -------------------------

function redirectTo(baseUrl, path) {
    return NextResponse.redirect(new URL(path, baseUrl))
}

async function fetchSlackToken(code) {
    const res = await fetch('https://slack.com/api/oauth.v2.access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            code,
            client_id: process.env.NEXT_PUBLIC_SLACK_CLIENT_ID,
            client_secret: process.env.SLACK_CLIENT_SECRET,
            redirect_uri: process.env.NEXT_PUBLIC_SLACK_REDIRECT_URI,
        }),
    })
    return res.json()
}

// Neu: Slack User-Info holen
async function fetchSlackUser(access_token, user_id) {
    const res = await fetch(`https://slack.com/api/users.info?user=${user_id}`, {
        headers: { Authorization: `Bearer ${access_token}` }
    })
    return res.json()
}