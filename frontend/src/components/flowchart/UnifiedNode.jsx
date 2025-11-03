import { Handle, Position } from 'reactflow'
import { CheckCircle, Flag, Plus, Pencil, Trash2, X } from 'lucide-react'

const TOKENS = {
    base: {
        card: 'rounded-2xl border shadow-sm transition-all',
        hover: 'hover:shadow-md hover:-translate-y-[1px]',
        title: 'font-semibold text-[0.95rem] text-gray-900 leading-snug truncate',
        meta: 'text-xs text-gray-500',
    },
    jira: { border: 'border-sky-200', bg: 'bg-sky-50', icon: 'text-sky-500', key: 'text-sky-700' },
    subtask: { border: 'border-sky-200', bg: 'bg-sky-50', icon: 'text-sky-500', key: 'text-sky-700' },
    epic: { border: 'border-accent/30', bg: 'bg-accent/10', icon: 'text-accent/60', key: 'text-accent/70' },

    blocker: {
        critical: { border: 'border-red-300', bg: 'bg-red-50' },
        warning: { border: 'border-amber-300', bg: 'bg-amber-50' },
    },

    change: {
        create: {
            badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
            border: 'border-dashed border-emerald-300',
            icon: <Plus className="w-3.5 h-3.5" />,
            text: 'New',
        },
        update: {
            badge: 'bg-sky-100 text-sky-800 border-sky-200',
            icon: <Pencil className="w-3.5 h-3.5" />,
            text: 'Edit',
        },
        delete: {
            badge: 'bg-red-600 text-white border-red-700',
            border: 'border-red-300',
            tone: 'opacity-60 grayscale',
            icon: <Trash2 className="w-3.5 h-3.5" />,
            text: 'Delete',
        },
    },
}

function getBaseSkin(type, isJiraOriginal) {
    if (type === 'epic') return TOKENS.epic
    if (type === 'subtask') return TOKENS.subtask
    return isJiraOriginal ? TOKENS.jira : TOKENS.subtask
}

export default function UnifiedNode({ data, type = 'task', onRemoveFromPlan }) {
    const change = data.change || null
    const isJiraOriginal = !change

    let skin = getBaseSkin(type, isJiraOriginal)
    let border = skin.border
    let bg = skin.bg
    let keyColor = skin.key
    let iconColor = skin.icon
    let titleClass = TOKENS.base.title
    let tone = ''
    let planBorder = ''
    let changeBadge = null

    let icon = <Flag className={`w-4 h-4 ${iconColor}`} />
    if (type === 'subtask') icon = <CheckCircle className={`w-4 h-4 ${iconColor}`} />

    // Blocker Overlay
    if (data.blockerType === 'critical') {
        border = TOKENS.blocker.critical.border
        bg = TOKENS.blocker.critical.bg
    } else if (data.blockerType === 'warning') {
        border = TOKENS.blocker.warning.border
        bg = TOKENS.blocker.warning.bg
    }

    // Change Overlays
    if (change === 'create') {
        planBorder = TOKENS.change.create.border
        changeBadge = { cls: TOKENS.change.create.badge, ico: TOKENS.change.create.icon, text: TOKENS.change.create.text }
    } else if (change === 'update') {
        changeBadge = { cls: TOKENS.change.update.badge, ico: TOKENS.change.update.icon, text: TOKENS.change.update.text }
    } else if (change === 'delete') {
        planBorder = TOKENS.change.delete.border
        tone = TOKENS.change.delete.tone
        titleClass += ' line-through text-gray-500'
        changeBadge = { cls: TOKENS.change.delete.badge, ico: TOKENS.change.delete.icon, text: TOKENS.change.delete.text }
    }

    // Status chip
    let statusBg = 'bg-gray-100 text-gray-700'
    if (data.statusCategory === 'done') statusBg = 'bg-emerald-100 text-emerald-800'
    if (data.statusCategory === 'indeterminate') statusBg = 'bg-amber-100 text-amber-800'
    if (data.statusCategory === 'new') statusBg = 'bg-sky-100 text-sky-800'

    return (
        <div className={`relative ${TOKENS.base.card} ${TOKENS.base.hover} ${tone}
                     w-[232px] px-5 py-3 ${bg} border ${border} ${planBorder}`}>

            {/* Top Overlay: Pill links, Remove rechts */}
            {(changeBadge || (change && onRemoveFromPlan)) && (
                <div className="absolute -top-2 left-0 right-0 px-2 flex items-center justify-between">
                    {/* Pill/Patch (links) */}
                    {changeBadge ? (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border inline-flex items-center gap-1 ${changeBadge.cls}`}>
                            {changeBadge.ico}{changeBadge.text}
                        </span>
                    ) : <span />}

                    {/* Remove-Button (rechts) — nur wenn change gesetzt ist */}
                    {change && onRemoveFromPlan ? (
                        <button
                            aria-label="Aus Plan entfernen"
                            title="Aus Plan entfernen"
                            onClick={(e) => { e.stopPropagation(); onRemoveFromPlan(data.key) }}
                            className="h-5 w-5 inline-flex items-center justify-center rounded-full border border-gray-200 bg-white/90 hover:bg-white shadow-sm"
                        >
                            <X className="w-3.5 h-3.5 text-gray-700" />
                        </button>
                    ) : null}
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between mb-2">
                <div className={`flex items-center gap-1 ${TOKENS.base.meta}`}>
                    {icon}
                    <span className={keyColor}>{data.key}</span>
                </div>
                <div className="flex flex-col items-end gap-0 min-w-[60px]">
                    <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${statusBg}`}>{data.status || '-'}</span>
                    <span className="text-[0.70rem] text-gray-500 mt-0.5">
                        {data.duedate || '—'}
                    </span>
                </div>
            </div>

            {/* Title */}
            <div className={titleClass}>{data.label}</div>
            {change === 'update' && data.originalSummary && data.originalSummary !== data.label && (
                <div className="text-[0.72rem] text-gray-500 mt-1">
                    <span className="line-through">{data.originalSummary}</span>
                    <span className="mx-1">→</span>
                    <span className="font-medium text-gray-800">{data.label}</span>
                </div>
            )}

            {/* Assignee */}
            {data.assignee && (
                <div className="flex items-center gap-2 mt-2">
                    {data.assignee.avatarUrl && (
                        <img src={data.assignee.avatarUrl} alt="" className="h-5 w-5 rounded-full border border-gray-200" />
                    )}
                    <span className="text-xs text-gray-700">{data.assignee.name}</span>
                </div>
            )}

            {/* Handles */}
            <Handle type="target" position={Position.Top} id="top" />
            {type !== 'subtask' && <Handle type="source" position={Position.Bottom} id="bottom" />}
        </div>
    )
}
