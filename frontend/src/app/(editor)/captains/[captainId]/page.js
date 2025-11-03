'use client'

import { useParams } from 'next/navigation'
import { useEffect, useMemo, useState, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import Chat from '@/components/Chat'
import FlowChart from '@/components/flowchart/FlowChart'
import Kanban from '@/components/kanban/Kanban'
import Sidebar from '@/components/sidebar/Sidebar'
import {
    GitBranch,
    KanbanSquare,
    FolderKanban,
    RefreshCw,
    CheckCheck,
    Trash2,
    Loader2,
} from 'lucide-react'
import { toast } from 'sonner'

// --------- Helper ---------
const userLite = (u) =>
    u
        ? {
            accountId: u.accountId,
            displayName: u.displayName,
            emailAddress: u.emailAddress ?? null,
            avatarUrl: u.avatarUrls?.['48x48'] ?? u.avatarUrl ?? null,
        }
        : null

const statusLite = (s) =>
    s
        ? {
            id: s.id ?? null,
            name: s.name ?? null,
            statusCategory: s.statusCategory
                ? {
                    id: s.statusCategory.id,
                    key: s.statusCategory.key,
                    name: s.statusCategory.name,
                    colorName: s.statusCategory.colorName,
                }
                : null,
        }
        : { id: null, name: null, statusCategory: null }

const isSubtaskName = (name) => {
    if (!name) return false;
    const n = String(name).toLowerCase().trim();
    return n === 'sub-task' || n === 'subtask' || n === 'sub task';
};

// ersetzt deine bisherige Version
const issueTypeLite = (t) => {
    if (!t) return { id: null, name: null, subtask: null };

    // String-Input (z.B. aus Plan: "Sub-task", "Task", "Bug", "Epic", …)
    if (typeof t === 'string') {
        return { id: null, name: t, subtask: isSubtaskName(t) };
    }

    // Objekt-Input (Jira API)
    const name = t.name ?? t.type ?? null;
    // nimm vorhandene Flags, sonst heuristisch aus dem Namen
    const sub =
        (typeof t.subtask === 'boolean' ? t.subtask : undefined) ??
        (typeof t.isSubtask === 'boolean' ? t.isSubtask : undefined) ??
        isSubtaskName(name);

    return {
        id: t.id ?? null,
        name,
        subtask: !!sub,
    };
};

const priorityLite = (p) => (p ? { id: p.id ?? null, name: p.name ?? null } : null)

const projectLite = (p) =>
    p ? { id: p.id ?? null, key: p.key ?? null, name: p.name ?? null } : { id: '', key: '', name: '' }

const parentLite = (p) => {
    if (!p) return null
    if (typeof p === 'string') return { id: null, key: p, summary: null }
    return { id: p.id ?? null, key: p.key ?? null, summary: p.fields?.summary ?? p.summary ?? null }
}

const subtaskLite = (st) => ({
    id: st.id ?? null,
    key: st.key ?? null,
    summary: st.fields?.summary ?? st.summary ?? null,
})

// --------- Normalisierung ---------
const unifyNormalize = (raw) => {
    if (!raw) return null
    const f = raw.fields || {}

    return {
        id: raw.id ?? 'static-id',
        key: raw.key,
        change: raw.change ?? raw._change ?? null, // create|update|delete oder null
        fields: {
            summary: f.summary ?? '',
            description: f.description ?? null,
            status:
                typeof f.status === 'string'
                    ? { id: null, name: f.status, statusCategory: null }
                    : statusLite(f.status),
            issuetype: issueTypeLite(f.issuetype ?? f.issueType ?? f.issue_type),

            priority:
                typeof f.priority === 'string'
                    ? { id: null, name: f.priority }
                    : priorityLite(f.priority),
            assignee: f.assignee
                ? {
                    accountId: f.assignee.accountId ?? f.assignee.account_id ?? null,
                    displayName: f.assignee.displayName ?? f.assignee.display_name ?? null,
                    emailAddress: f.assignee.emailAddress ?? f.assignee.email ?? null,
                    avatarUrl: f.assignee.avatarUrl ?? f.assignee.avatar_url ?? null,
                }
                : null,
            reporter: userLite(f.reporter),
            creator: userLite(f.creator),
            project: projectLite(f.project),
            parent: parentLite(f.parent),
            labels: Array.isArray(f.labels) ? f.labels : [],
            // Due-Date Aliase
            duedate:
                f.duedate ??
                f.due_date ??
                f.dueDate ??
                f.due ??
                f.targetDate ??
                f.target_date ??
                null,
            created: f.created ?? null,
            updated: f.updated ?? null,
            subtasks: Array.isArray(f.subtasks) ? f.subtasks.map(subtaskLite) : [],
        },
    }
}

// --------- Merge Jira + Plan ---------
const nonNullMerge = (base = {}, patch = {}) => {
    const out = { ...base }
    for (const [k, v] of Object.entries(patch)) {
        if (v !== null && v !== undefined) out[k] = v
    }
    return out
}

const mergeIssuesWithPlanFlags = (jiraIssues = [], planIssues = []) => {
    const byKey = new Map(jiraIssues.map((i) => [i.key, { ...i, change: null }]))

    // 1) Deletes
    for (const p of planIssues) {
        if (p.change === 'delete') {
            const base = byKey.get(p.key)
            byKey.set(p.key, base ? { ...base, change: 'delete' } : { ...p, change: 'delete' })
        }
    }

    // 2) Updates
    for (const p of planIssues) {
        if (p.change !== 'update') continue
        const base = byKey.get(p.key)
        if (base && base.change === 'delete') continue

        const original = base ? structuredClone(base.fields) : {}
        const pf = p.fields || {}

        const mergedFields = nonNullMerge(original, pf)
        if (base) {
            byKey.set(p.key, { ...base, fields: mergedFields, change: 'update', _original: original })
        } else {
            byKey.set(p.key, { ...p, fields: mergedFields, change: 'update' })
        }
    }

    // 3) Creates
    for (const p of planIssues) {
        if (p.change === 'create') {
            byKey.set(p.key, { ...p, change: 'create' })
        }
    }

    return Array.from(byKey.values())
}

// --------- Component ---------
export default function WorkboardPage() {
    const params = useParams()
    const captainId = params?.captainId ?? null

    const supabase = useMemo(() => createClient(), [])

    const [view, setView] = useState('flowchart')
    const [chatLoading, setChatLoading] = useState(false)

    const [messages, setMessages] = useState([])
    const [captain, setCaptain] = useState(null)
    const [captainLoading, setCaptainLoading] = useState(false)
    const [tasks, setTasks] = useState([])

    const [planIssues, setPlanIssues] = useState([])
    const [issues, setIssues] = useState([])

    const projectKey = captain?.jira_project_key ?? null
    const [activeProjectName, setActiveProjectName] = useState(null)

    const [issuesRefreshing, setIssuesRefreshing] = useState(false)

    // NEW: Button Lade-States
    const [accepting, setAccepting] = useState(false)
    const [clearing, setClearing] = useState(false)

    const hasPlanChanges = Array.isArray(planIssues) && planIssues.length > 0

    // Captain laden
    useEffect(() => {
        if (!captainId) return
            ; (async () => {
                setCaptainLoading(true)
                const { data, error } = await supabase
                    .from('captains')
                    .select('*, plan')
                    .eq('id', String(captainId))
                    .single()
                if (error) console.error('❌ Captain laden:', error)
                setCaptain(data || null)
                setPlanIssues(Array.isArray(data?.plan) ? data.plan : [])
                setCaptainLoading(false)
            })()
    }, [captainId, supabase])

    // Plan-Subscription (ersetzt deinen aktuellen Effect)
    useEffect(() => {
        if (!captainId) return;

        const capId = String(captainId);
        const channel = supabase
            .channel(`realtime:captains:${capId}`, {
                config: { broadcast: { self: false } }, // kein Echo nötig
            })
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'captains', filter: `id=eq.${capId}` },
                (payload) => {
                    try {
                        if (payload.eventType === 'DELETE') {
                            // Zeile gelöscht → Plan leer machen
                            setPlanIssues([]);
                            return;
                        }
                        const newPlan = payload.new?.plan ?? null;
                        if (Array.isArray(newPlan)) {
                            // nur updaten, wenn sich wirklich was ändert
                            setPlanIssues((prev) => {
                                const prevStr = JSON.stringify(prev ?? []);
                                const nextStr = JSON.stringify(newPlan);
                                return prevStr === nextStr ? prev : newPlan;
                            });
                        } else if (newPlan === null) {
                            setPlanIssues([]);
                        }
                    } catch (e) {
                        console.error('❌ Realtime payload handling error:', e, payload);
                    }
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    // optional: console.log('✅ Subscribed to plan updates');
                }
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [captainId, supabase]);

    // Tasks initial + realtime
    useEffect(() => {
        if (!captainId) return
        let cancelled = false
        const capId = String(captainId)

        const loadTasks = async () => {
            const { data, error } = await supabase
                .from('tasks')
                .select(
                    'id,captain_id,issue_key,title,reason,description,priority,plan,status,created_at,updated_at'
                )
                .eq('captain_id', capId)
                .order('created_at', { ascending: false })
            if (error) {
                console.error('❌ Tasks laden:', error)
                return
            }
            if (!cancelled)
                setTasks(
                    (data ?? []).map((t) => ({
                        id: t.id,
                        issue_key: t.issue_key,
                        title: t.title,
                        description: t.description,
                        priority: t.priority,
                        status: t.status,
                        type: 'jira',
                        createdAt: t.created_at,
                        needsApproval: t.status === 'pending_approval',
                        plan: t.plan,
                    }))
                )
        }
        loadTasks()

        const ch = supabase
            .channel(`tasks:${capId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => loadTasks())
            .subscribe()

        return () => {
            cancelled = true
            supabase.removeChannel(ch)
        }
    }, [captainId, supabase])

    // Jira Issues laden
    const fetchIssues = useCallback(async () => {
        if (!projectKey) return
        setIssuesRefreshing(true)
        try {
            const { data: sessionData } = await supabase.auth.getSession()
            const token = sessionData?.session?.access_token
            if (!token) throw new Error('Nicht eingeloggt')

            const res = await fetch(
                `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/getJiraIssuesByProjectId`,
                {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ projectKey, captainId }),
                }
            )

            const data = await res.json()
            if (!res.ok) throw new Error(data?.error || 'Fehler beim Issues-Load')

            setIssues((data.issues || []).map(unifyNormalize))
        } catch (err) {
            console.error('❌ Issues laden:', err)
        } finally {
            setIssuesRefreshing(false)
        }
    }, [projectKey, supabase])

    useEffect(() => {
        if (projectKey) fetchIssues()
    }, [projectKey, chatLoading, fetchIssues])

    const merged = mergeIssuesWithPlanFlags(
        issues,
        (Array.isArray(planIssues) ? planIssues : []).map(unifyNormalize)
    )

    const handleAcceptPlan = async () => {
        if (!captainId) return
        try {
            setAccepting(true)

            const { data: sessionData } = await supabase.auth.getSession()
            const token = sessionData?.session?.access_token
            if (!token) throw new Error('Not logged in')

            const res = await fetch(
                'https://nxopmtxgswlezmgpmeed.supabase.co/functions/v1/executePlan',
                {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        captainId: String(captainId),
                        changes: planIssues,
                    }),
                }
            )

            const data = await res.json()
            if (!res.ok) throw new Error(data?.error || 'Error while executing plan')

            console.log('✅ Edge Function executePlan successful:', data)

            // 🔔 Permission Errors speziell für Delete prüfen
            const permErrRegex = /(nicht berechtigt|not permitted|not authorized|permission|unauthorized|forbidden|403)/i
            const deletePermErrors = Array.isArray(data?.results)
                ? data.results.filter(
                    (r) =>
                        r?.action === 'delete' &&
                        r?.ok === false &&
                        permErrRegex.test(String(r?.error || ''))
                )
                : []

            if (deletePermErrors.length > 0) {
                toast.error("You don't have permission to delete issues in this project.")
            } else {
                toast.success('Plan changes successfully applied to Jira.')
            }

            // 👉 Issues neu laden
            await fetchIssues()
        } catch (e) {
            console.error('❌ Plan übernehmen fehlgeschlagen:', e)
            toast.error('Failed to apply plan. Please try again.')
        } finally {
            setAccepting(false)
        }
    }


    const handleClearPlan = async () => {
        if (!captainId) return
        try {
            setClearing(true)
            // Optimistic Update
            const prev = planIssues
            setPlanIssues([])

            const { error } = await supabase
                .from('captains')
                .update({ plan: null })
                .eq('id', String(captainId))

            if (error) {
                console.error('❌ Plan löschen fehlgeschlagen:', error)
                // rollback
                setPlanIssues(prev)
            }
        } catch (e) {
            console.error('❌ Plan löschen Exception:', e)
        } finally {
            setClearing(false)
        }
    }

    // Areas
    const FlowchartArea = () =>
        merged.length > 0 ? (
            <div className="h-full w-full overflow-y-auto overflow-x-hidden">
                <FlowChart issues={merged} captainId={captainId} />
            </div>
        ) : (
            <div className="flex flex-col items-center justify-center w-full h-full border border-border bg-white rounded-md">
                <GitBranch className="w-10 h-10 text-gray-400" />
                <p className="mt-2 text-xs text-gray-500">No issues yet</p>
            </div>
        )

    const KanbanArea = () =>
        !!captain && !captainLoading ? (
            <div className="h-full w-full overflow-y-auto overflow-x-hidden">
                <Kanban captain={captain} tasks={tasks} setTasks={setTasks} />
            </div>
        ) : (
            <div className="flex flex-col items-center justify-center w-full h-full border border-border bg-white rounded-md">
                <KanbanSquare className="w-10 h-10 text-gray-400" />
                <p className="mt-2 text-xs text-gray-500">No captain selected</p>
            </div>
        )

    return (
        <div className="w-full h-screen flex overflow-hidden overflow-x-hidden">
            <div className="flex min-w-[14rem] max-w-[20rem] w-[18rem] h-full">
                <div className="flex-1 minh-0 minH-0 overflow-y-auto overflow-x-hidden min-w-0">
                    <Chat
                        captain={captain}
                        captainLoading={captainLoading}
                        setCaptainLoading={setCaptainLoading}
                        chatLoading={chatLoading}
                        setChatLoading={setChatLoading}
                        messages={messages}
                        setMessages={setMessages}
                    />
                </div>
            </div>

            <div className="flex-1 min-w-0 h-full p-4 flex flex-col min-h-0">
                <div className="flex-none pb-2">
                    <div className="flex items-center justify-between">
                        <div className="min-w-0 max-w-[60%] truncate text-xs sm:text-sm text-gray-600">
                            {projectKey ? (
                                <span className="inline-flex items-center gap-2">
                                    <FolderKanban className="w-4 h-4 text-gray-500" />
                                    <span className="font-medium truncate">{activeProjectName || 'Project'}</span>
                                    <span className="text-gray-400 truncate">({projectKey})</span>
                                </span>
                            ) : (
                                <span className="text-gray-400">No project</span>
                            )}
                        </div>

                        {/* ---------- Button-Leiste oben rechts ---------- */}
                        <div className="flex items-center gap-2">
                            {/* Gruppe A: Accept / Delete (links, gleich hoch) */}
                            <div className="inline-flex items-stretch h-9 border border-gray-200 bg-white p-0.5 rounded-md">
                                <button
                                    onClick={handleAcceptPlan}
                                    disabled={!hasPlanChanges || accepting}
                                    className="h-full px-3 text-sm rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                                    title={hasPlanChanges ? 'Plan-Änderungen in Jira übernehmen' : 'Keine Plan-Änderungen vorhanden'}
                                >
                                    {accepting ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <span className="inline-flex items-center gap-1">
                                            <CheckCheck className="w-4 h-4" />
                                            <span className="hidden sm:inline">Accept</span>
                                        </span>
                                    )}
                                </button>
                                <div className="w-px bg-gray-200 mx-1" />
                                <button
                                    onClick={handleClearPlan}
                                    disabled={!hasPlanChanges || clearing}
                                    className="h-full px-3 text-sm rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                                    title={hasPlanChanges ? 'Alle Plan-Änderungen löschen' : 'Keine Plan-Änderungen vorhanden'}
                                >
                                    {clearing ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <span className="inline-flex items-center gap-1">
                                            <Trash2 className="w-4 h-4" />
                                            <span className="hidden sm:inline">Delete All</span>
                                        </span>
                                    )}
                                </button>
                            </div>

                            {/* Gruppe B: View / Refresh (rechts, gleich hoch) */}
                            <div className="inline-flex items-stretch h-9 border border-gray-200 bg-white p-0.5 rounded-md">
                                <button
                                    onClick={() => setView('flowchart')}
                                    className={`h-full px-3 text-sm rounded-md ${view === 'flowchart' ? 'bg-accent text-white' : 'text-gray-700 hover:bg-gray-50'
                                        }`}
                                    title="Flowchart anzeigen"
                                >
                                    <GitBranch className="w-4 h-4" />
                                </button>
                                <div className="w-px bg-gray-200 mx-1" />
                                <button
                                    onClick={fetchIssues}
                                    disabled={issuesRefreshing}
                                    className="h-full px-3 text-sm rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                                    title="Issues neu laden"
                                >
                                    {issuesRefreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>


                    </div>
                </div>

                <div className="flex-1 min-h-0 overflow-hidden">
                    {view === 'flowchart' ? <FlowchartArea /> : <KanbanArea />}
                </div>
            </div>

            <div className="flex min-w-[14rem] max-w-[20rem] w-[18rem] h-full">
                <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden min-w-0">
                    <Sidebar captain={captain} captainLoading={captainLoading} />
                </div>
            </div>
        </div>
    )
}
