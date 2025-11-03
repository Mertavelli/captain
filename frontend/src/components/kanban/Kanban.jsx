import React, { useMemo, useState } from 'react'
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core'
import {
    arrayMove,
    sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { createClient } from '@/utils/supabase/client'
import Column from './Column'

const Kanban = ({ tasks, setTasks, captain }) => {
    const supabase = useMemo(() => createClient(), [])
    const [columns] = useState([
        { id: 'pending_approval', title: 'Pending Approval' },
        { id: 'in_progress', title: 'In Progress' },
        { id: 'completed', title: 'Completed' },
        { id: 'cancelled', title: 'Cancelled' },
    ])

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    )

    // UI ↔ DB Status-Mapping (DB hat "done", UI zeigt "completed")
    const toDbStatus = (ui) => (ui === 'completed' ? 'done' : ui)
    const toUiStatus = (db) => (db === 'done' ? 'completed' : db)

    const handleAccept = async (task) => {
        // Optimistisches UI
        setTasks(prev => prev.map(t => t.id === task.id
            ? { ...t, status: 'in_progress', needsApproval: false }
            : t
        ))

        const { error } = await supabase
            .from('tasks')
            .update({ status: 'in_progress' })
            .eq('id', task.id)

        if (error) {
            console.error('❌ Accept fehlgeschlagen:', error.message)
            // Rollback
            setTasks(prev => prev.map(t => t.id === task.id
                ? { ...t, status: 'pending_approval', needsApproval: true }
                : t
            ))
        }
    }

    const handleCancel = async (task) => {
        setTasks(prev => prev.map(t => t.id === task.id
            ? { ...t, status: 'cancelled', needsApproval: false }
            : t
        ))
        const { error } = await supabase
            .from('tasks')
            .update({ status: 'cancelled' })
            .eq('id', task.id)
        if (error) console.error('❌ Cancel fehlgeschlagen:', error.message)
    }

    const handleDragEnd = async (event) => {
        const { active, over } = event
        if (!over) return

        const activeId = active.id
        const overId = over.id

        // Drop auf Spaltenkopf → Statuswechsel
        const overColumn = columns.find(col => col.id === overId)
        const activeTask = tasks.find(task => task.id === activeId)

        if (overColumn && activeTask) {
            const newStatus = overColumn.id
            if (activeTask.status !== newStatus) {
                // Optimistisches UI
                setTasks(prev => prev.map(t => t.id === activeId ? { ...t, status: newStatus, needsApproval: newStatus === 'pending_approval' } : t))

                // Persistieren
                const { error } = await supabase
                    .from('tasks')
                    .update({ status: toDbStatus(newStatus) })
                    .eq('id', activeId)

                if (error) {
                    console.error('❌ Status-Update fehlgeschlagen:', error.message)
                    // Rollback
                    setTasks(prev => prev.map(t => t.id === activeId ? { ...t, status: activeTask.status, needsApproval: activeTask.status === 'pending_approval' } : t))
                }
            }
            return
        }

        // Reordering innerhalb der Liste
        const activeIndex = tasks.findIndex(task => task.id === activeId)
        const overIndex = tasks.findIndex(task => task.id === overId)
        if (activeIndex !== overIndex) {
            setTasks(prev => arrayMove(prev, activeIndex, overIndex))
        }
    }

    const getTasksByStatus = (status) => tasks.filter(task => task.status === status)

    return (
        <div className="h-full w-full p-6 flex flex-col bg-white border rounded-md">
            {/* Header */}
            <div className="mb-6 flex-shrink-0">
                <h1 className="text-2xl font-bold text-gray-800 mb-2">Task Board</h1>
                <p className="text-gray-600">
                    Monitor and manage {captain?.name ?? 'your captain'}'s activities in real-time
                </p>
            </div>

            {/* Board */}
            <div className="flex-1 min-h-0">
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <div className="flex gap-6 h-full">
                        {columns.map((column) => (
                            <div key={column.id} className="flex-1 min-w-0">
                                <Column
                                    column={column}
                                    tasks={getTasksByStatus(column.id)}
                                    // ⬇️ an TaskItem weiterreichen (in Column.jsx durchreichen)
                                    onAccept={handleAccept}
                                    onCancel={handleCancel}
                                />
                            </div>
                        ))}
                    </div>
                </DndContext>
            </div>
        </div>
    )
}

export default Kanban
