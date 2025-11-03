import React from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

export default function TaskItem({
    task,
    isDragging,
    onAccept = () => { },
    onCancel = () => { },
    maxDescLen = 160,
}) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: task.id })
    const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }

    const getTaskIcon = (type) => {
        switch (type) {
            case 'jira': return '🎯'
            case 'slack': return '💬'
            case 'analysis': return '🔍'
            case 'automation': return '⚙️'
            default: return '📋'
        }
    }

    const getPriorityColor = (priority) => {
        switch (priority) {
            case 'high': return 'border-l-red-500 bg-red-50'
            case 'medium': return 'border-l-yellow-500 bg-yellow-50'
            case 'low': return 'border-l-green-500 bg-green-50'
            default: return 'border-l-blue-500 bg-blue-50'
        }
    }

    const truncate = (s, n) => {
        if (!s) return ''
        const str = String(s).trim()
        return str.length > n ? str.slice(0, n).trimEnd() + '…' : str
    }

    const formatShort = (iso) => {
        if (!iso) return ''
        const d = new Date(iso)
        if (isNaN(d)) return ''
        return d.toLocaleString('de-DE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    }

    const stopDrag = (e) => { e.stopPropagation() }

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className={`p-4 mb-3 bg-white rounded-lg border-l-4 shadow-sm hover:shadow-md transition-all cursor-grab ${getPriorityColor(task.priority)}`}
        >
            <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                    <span className="text-lg">{getTaskIcon(task.type)}</span>
                    <span className="text-sm font-medium text-gray-600">{(task.type || 'task').toUpperCase()}</span>
                </div>
                <span
                    className={`px-2 py-1 text-xs rounded-full font-medium ${task.priority === 'high'
                        ? 'bg-red-100 text-red-700'
                        : task.priority === 'medium'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-green-100 text-green-700'
                        }`}
                >
                    {task.priority || 'medium'}
                </span>
            </div>

            <h3 className="font-semibold text-gray-800 mb-1 leading-tight">{task.title}</h3>
            {task.description ? (
                <p className="text-sm text-gray-600 mb-3" title={task.description}>
                    {truncate(task.description, maxDescLen)}
                </p>
            ) : null}

            <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">{formatShort(task.createdAt)}</span>

                {task.needsApproval ? (
                    <div className="flex items-center gap-2">
                        <button
                            className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-50 text-gray-700 cursor-pointer"
                            onMouseDown={stopDrag}
                            onPointerDown={stopDrag}
                            onClick={(e) => { e.stopPropagation(); onCancel(task) }}
                            aria-label="Cancel task"
                        >
                            Cancel
                        </button>
                        <button
                            className="text-xs px-2 py-1 rounded bg-black text-white hover:bg-black/90 cursor-pointer"
                            onMouseDown={stopDrag}
                            onPointerDown={stopDrag}
                            onClick={(e) => { e.stopPropagation(); onAccept(task) }}
                            aria-label="Accept task"
                        >
                            Accept
                        </button>
                    </div>
                ) : null}
            </div>
        </div>
    )
}
