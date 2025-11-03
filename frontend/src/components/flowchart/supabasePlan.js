import { createClient } from "@/utils/supabase/client"

function norm(v) {
    if (v === null || v === undefined) return null
    return String(v).trim().toUpperCase()
}

/** zieht mögliche IssueKeys aus einem beliebig strukturierten Plan-Item */
function extractCandidateKeys(it = {}) {
    const cand = [
        it.issueKey,
        it.issuekey,
        it.key,
        it.jiraKey,
        it.jira_key,
        it?.issue?.key,
        it?.data?.key,
        it?.target?.key,
        it?.meta?.issueKey,
    ].filter(Boolean)

    // Duplikate rausschmeißen, normalisiert
    const seen = new Set()
    const out = []
    for (const c of cand) {
        const n = norm(c)
        if (n && !seen.has(n)) {
            seen.add(n)
            out.push(n)
        }
    }
    return out
}

export async function removePlanItemByIssueKey(captainId, issueKey) {
    const supabase = createClient()
    if (!issueKey) throw new Error('[supabasePlan] issueKey ist undefined/null')
    if (!captainId) throw new Error('[supabasePlan] captainId ist undefined/null')

    const want = norm(issueKey)

    // 1) aktuellen Plan holen
    const { data, error } = await supabase
        .from('captains')
        .select('plan')
        .eq('id', captainId)
        .maybeSingle()
    if (error) throw error
    if (!data) throw new Error(`[supabasePlan] Kein Captain mit id=${captainId} gefunden (oder RLS).`)

    const original = Array.isArray(data.plan) ? data.plan : []

    // 2) nur ERSTES passendes Element entfernen (robuste Key-Erkennung)
    let idx = -1
    for (let i = 0; i < original.length; i++) {
        const candidates = extractCandidateKeys(original[i])
        if (candidates.includes(want)) {
            idx = i
            break
        }
    }

    if (idx === -1) {
        // hilfreiches Debugging: zeig’ mal, welche Keys überhaupt drin sind
        // (kannst du nach der Fehlersuche wieder entfernen)
        const sample = original.slice(0, 10).map((it) => ({
            raw_issueKey: it?.issueKey ?? it?.issuekey ?? it?.key ?? it?.jiraKey ?? it?.jira_key,
            nested_issue: it?.issue?.key,
            data_key: it?.data?.key,
            target_key: it?.target?.key,
            meta_issueKey: it?.meta?.issueKey,
        }))
        // eslint-disable-next-line no-console
        console.warn('[supabasePlan] Kein passendes Element gefunden für', issueKey, '— Kandidaten (erste 10):', sample)
        return { changed: false }
    }

    const updated = original.slice()
    const [removed] = updated.splice(idx, 1)

    // 3) Update erzwingen + Rückgabe prüfen
    const { data: updatedRow, error: upErr } = await supabase
        .from('captains')
        .update({ plan: updated })
        .eq('id', captainId)
        .select('id, plan')
        .single()
    if (upErr) throw upErr
    if (!updatedRow) throw new Error('[supabasePlan] Update hatte keinen Effekt.')

    return { changed: true, removed }
}
