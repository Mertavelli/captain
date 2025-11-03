// src/app/(app)/api/jira/webhook/route.js

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import crypto from 'node:crypto';

const AGENT_BASE = process.env.API_URL || 'http://localhost:8000';
const CT_ENDPOINT = `${AGENT_BASE.replace(/\/$/, '')}/api/context-thread`;

export async function POST(request) {
    console.log('\n────────── JIRA → DCCTS (UES) ──────────');

    // ⬇️ Dynamischer Import an der richtigen Stelle (zur Request-Zeit):
    // Falls du einen named export hast:
    const { supabaseAdmin } = await import('@/utils/supabase/admin');
    // Falls du stattdessen default exportierst, nimm:
    // const supabaseAdmin = (await import('@/utils/supabase/admin')).default;

    const raw = await request.text();
    let body = {};
    try { body = JSON.parse(raw || '{}'); } catch { }

    const items = Array.isArray(body) ? body : [body];
    const rows = [];

    for (const p of items) {
        const ues = toUES(p);
        const projectKey = getJiraProjectKey(p);
        if (ues) rows.push({ event_id: ues.event_id, ues, project_key: projectKey });
    }

    if (!rows.length) {
        return json({ ok: true, inserted: 0, notified: 0 });
    }

    // 1) Dedup
    const fps = Array.from(new Set(rows.map(r => r.ues?.dedup_fingerprint).filter(Boolean)));
    let existingSet = new Set();
    if (fps.length) {
        const { data: existing, error: selErr } = await supabaseAdmin
            .from('dccts_events')
            .select('dedup_fingerprint')
            .in('dedup_fingerprint', fps);

        if (selErr) {
            console.error('[Supabase] select dedup error:', selErr);
        } else {
            existingSet = new Set((existing || []).map(r => r.dedup_fingerprint));
        }
    }

    const newRows = rows.filter(r => !existingSet.has(r.ues.dedup_fingerprint));
    if (!newRows.length) {
        console.log('[DCCTS] nothing new (all duplicates this minute)');
        return json({ ok: true, inserted: 0, notified: 0 });
    }

    // 1.5) Captain-Mapping
    const projectKeys = Array.from(new Set(newRows.map(r => r.project_key).filter(Boolean)));
    let captainMap = {};
    if (projectKeys.length) {
        const { data: caps, error: capErr } = await supabaseAdmin
            .from('captains')
            .select('id,jira_project_key')
            .in('jira_project_key', projectKeys);

        if (capErr) {
            console.error('[Supabase] captains lookup error:', capErr);
        } else {
            captainMap = (caps || []).reduce((acc, c) => {
                acc[c.jira_project_key] = c.id;
                return acc;
            }, {});
        }
    }

    // 2) Upsert (idempotent)
    const upsertRows = newRows.map(r => ({
        event_id: r.event_id,
        dedup_fingerprint: r.ues.dedup_fingerprint,
        ues: r.ues,
        captain_id: r.project_key ? (captainMap[r.project_key] ?? null) : null,
    }));

    const { error } = await supabaseAdmin
        .from('dccts_events')
        .upsert(upsertRows, { onConflict: 'dedup_fingerprint', ignoreDuplicates: true });

    if (error) {
        console.error('[Supabase] upsert error:', error);
        return json({ ok: false, inserted: 0, notified: 0 }); // 200, damit Jira nicht spammy retried
    }

    console.log(`[Supabase] inserted/upserted: ${upsertRows.length}`);
    return json({ ok: true, inserted: upsertRows.length, notified: upsertRows.length });
}

/* ---------------- Agent-Forwarder (optional) ---------------- */
async function postToContextThread(payload) {
    try {
        const res = await fetch(CT_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (!res.ok) {
            const text = await res.text().catch(() => '');
            throw new Error(`HTTP ${res.status} ${text}`);
        }
        return true;
    } catch (err) {
        console.error('[Agent] POST failed:', err?.message || err);
        return false;
    }
}

/* ================= Jira → UES ================= */
function toUES(p = {}) {
    const issue = p.issue || {};
    const f = issue.fields || {};
    const isComment = !!p.comment;
    const comment = p.comment || null;
    const webhookEvent = p.webhookEvent || 'jira:webhook';

    const acct =
        extractJiraTenantHost(issue?.self) ||
        extractJiraTenantHost(comment?.self) ||
        'jira-unknown';

    const event_type = isComment ? 'comment' : 'issue';
    const timestamp =
        (isComment && comment?.created) ||
        f?.updated ||
        new Date().toISOString();

    const actor =
        (isComment && comment?.author) ||
        p.user ||
        p.actor ||
        null;

    const artefactTitle = isComment ? null : safeStr(f?.summary);
    const artefactBody = isComment ? toPlain(comment?.body) : toPlain(f?.description);

    const issueId = safeStr(issue?.id) || '';
    const issueKey = safeStr(issue?.key) || null;
    const commentId = isComment ? safeStr(comment?.id) : null;

    const urls = []
        .concat(issue?.self ? [issue.self] : [])
        .concat(isComment && comment?.self ? [comment.self] : []);

    const event_id = buildJiraEventId({
        host: acct,
        isComment,
        issueId,
        commentId,
        hasChangelog: !!p.changelog?.id,
        changelogId: p.changelog?.id,
    });

    const thread = issueKey || issueId || null;

    const actorId = actor?.accountId || actor?.name || '';
    const minuteIso = truncateToMinute(toISO(timestamp));

    const dedup_fingerprint = sha1Hex([
        (artefactBody || '').slice(0, 512).toLowerCase(),
        (issueKey || thread || ''),
        actorId,
        minuteIso,
    ].join('|'));

    return compact({
        schema_version: '1.0',
        event_id,
        source: 'jira',
        source_account: acct,
        event_type,
        timestamp: toISO(timestamp),
        actor: actor ? {
            id: actor.accountId || actor.name || null,
            display: actor.displayName || actor.name || null,
            email: actor.emailAddress || null,
        } : undefined,
        artefact: {
            title: artefactTitle,
            body: artefactBody || null,
            mime: isLikelyHtml(artefactBody) ? 'text/html' : 'text/plain',
            attachments: [],
        },
        refs: {
            urls,
            channel: null,
            thread,
            object_id: issueId || null,
            object_key: issueKey || null,
            jira: {
                issue_id: issueId || null,
                issue_key: issueKey || null,
                web_url: buildJiraBrowseUrl(acct, issueKey),
            },
            slack: { team_id: null, channel_id: null, thread_ts: null, message_ts: null, permalink: null },
        },
        labels: [],
        ext: {},
        privacy: { classification: 'internal', pii: [] },
        provenance: {
            ingested_at: new Date().toISOString(),
            normalizer: 'dccts-normalizer@1.0.0',
            source_event_kind: webhookEvent,
            raw_ref: { store: null, key: null, checksum: null },
        },
        dedup_fingerprint,
    });
}

/* ===== stabile Jira-Event-IDs ===== */
function buildJiraEventId({ host, isComment, issueId, commentId, hasChangelog, changelogId }) {
    const h = (host || '').toLowerCase();
    if (isComment && commentId) return `jira:${h}:comment:${commentId}`;
    if (hasChangelog && changelogId) return `jira:${h}:changelog:${String(changelogId)}`;
    return `jira:${h}:issue:${issueId || '0'}`;
}

/* ================= Helpers ================= */
function extractJiraTenantHost(selfUrl) { try { if (!selfUrl) return null; return new URL(selfUrl).hostname.toLowerCase(); } catch { return null; } }
function toISO(x) { try { return new Date(x).toISOString(); } catch { return new Date().toISOString(); } }
function truncateToMinute(iso) { const d = new Date(iso); d.setUTCSeconds(0, 0); return d.toISOString(); }
function sha1Hex(s) { return crypto.createHash('sha1').update(s).digest('hex'); }
function safeStr(s) { return typeof s === 'string' ? s : (s == null ? null : String(s)); }
function toPlain(s) { if (s == null) return null; if (typeof s === 'string') return s.trim() || null; return String(s); }
function isLikelyHtml(s) { if (typeof s !== 'string') return false; return /<\/?[a-z][\s\S]*>/i.test(s); }
function compact(obj) {
    if (obj == null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(compact).filter(v => !(v == null || (typeof v === 'object' && Object.keys(v).length === 0)));
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
        const c = compact(v);
        const empty = c && typeof c === 'object' && !Array.isArray(c) && Object.keys(c).length === 0;
        if (!(c == null || c === '' || (Array.isArray(c) && c.length === 0) || empty)) out[k] = c;
    }
    return out;
}
function buildJiraBrowseUrl(host, issueKey) { return host && issueKey ? `https://${host}/browse/${issueKey}` : null; }

// Project-Key-Extractor
function getJiraProjectKey(p = {}) {
    try {
        const f = p?.issue?.fields || {};
        if (f?.project?.key) return String(f.project.key);
        const issueKey = p?.issue?.key || f?.key || null;
        if (typeof issueKey === 'string' && issueKey.includes('-')) {
            return issueKey.split('-')[0];
        }
    } catch { }
    return null;
}

/* ========= kleine JSON-Helper-Response ========= */
function json(obj, status = 200) {
    return new Response(JSON.stringify(obj), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}
