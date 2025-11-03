import React from 'react';
import {
    SortableContext,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
    Brain,
    Clock,
    Zap,
    CheckCircle2,
    XCircle,
    Clipboard,
    Bot
} from 'lucide-react';
import TaskItem from './TaskItem';

export default function Column({ column, tasks, onAccept, onCancel }) {
    const getColumnColor = (status) => {
        switch (status) {
            case 'pending_approval': return 'bg-orange-100 border-orange-200';
            case 'in_progress': return 'bg-yellow-100 border-yellow-200';
            case 'completed': return 'bg-green-100 border-green-200';
            case 'cancelled': return 'bg-red-100 border-red-200';
            default: return 'bg-gray-100 border-gray-200';
        }
    };

    const getColumnIcon = (status) => {
        const iconProps = { size: 20, className: "text-gray-700" };

        switch (status) {
            case 'pending_approval': return <Clock {...iconProps} className="text-orange-600" />;
            case 'in_progress': return <Zap {...iconProps} className="text-yellow-600" />;
            case 'completed': return <CheckCircle2 {...iconProps} className="text-green-600" />;
            case 'cancelled': return <XCircle {...iconProps} className="text-red-600" />;
            default: return <Clipboard {...iconProps} />;
        }
    };

    return (
        <div className="bg-gray-50 rounded-lg p-4 h-full w-full flex flex-col">
            {/* Header - Fixed */}
            <div className={`
                flex items-center justify-between p-3 rounded-lg mb-4 border-2 flex-shrink-0
                ${getColumnColor(column.id)}
            `}>
                <div className="flex items-center gap-3">
                    {getColumnIcon(column.id)}
                    <h2 className="font-bold text-gray-800">{column.title}</h2>
                </div>
                <span className="bg-white px-2 py-1 rounded-full text-sm font-medium text-gray-700">
                    {tasks.length}
                </span>
            </div>

            {/* Tasks Container - Scrollable */}
            <div className="flex-1 overflow-y-auto">
                <SortableContext items={tasks.map(task => task.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-2 pr-1"> {/* pr-1 für scrollbar spacing */}
                        {tasks.map((task) => (
                            <TaskItem key={task.id} task={task} onAccept={onAccept} onCancel={onCancel} />
                        ))}
                    </div>
                </SortableContext>

                {/* Empty State */}
                {/*                 {tasks.length === 0 && (
                    <div className="text-center text-gray-500 py-8">
                        <Bot size={32} className="mx-auto mb-2 text-gray-400" />
                        <p>AI Agent wird hier Tasks platzieren</p>
                    </div>
                )} */}
            </div>
        </div>
    );
}