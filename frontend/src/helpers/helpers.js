import axios from 'axios';
import CaptainLottie from '@/components/CaptainLottie';

export const formatDateTime = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleString('de-DE', {
        day: '2-digit',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });
};

export function generateFlowLayout(rawElements, itemsPerRow = 3, spacing = { x: 220, y: 140 }) {
    const nodes = [];
    const edges = [];

    let row = 0;
    let column = 0;

    rawElements.forEach((el) => {
        if (el.source && el.target) {
            edges.push({
                ...el,
                type: 'straight',
                animated: true,
                markerEnd: {
                    type: 'arrowclosed',
                },
            });
            return;
        }

        const x = column * spacing.x;
        const y = row * spacing.y;

        nodes.push({
            ...el,
            position: { x, y },
            sourcePosition: 'right',
            targetPosition: 'left',
        });

        column++;
        if (column >= itemsPerRow) {
            column = 0;
            row++;
        }
    });

    return [...nodes, ...edges];
}

export function formatActionsWithFlow(actions, itemsPerColumn = 3, spacing = { x: 220, y: 120 }) {
    return actions.map(action => ({
        ...action,
        flowElements: generateFlowLayout(action.flowElements ?? [], itemsPerColumn, spacing),
    }));
}

export async function chat() {
    try {
        const response = await axios.post('http://localhost:8000/api/chat', {
            projectName: 'Analytics Dashboard',
            key: 'DASH',
            teamSize: 4,
            durationWeeks: 6
        });

        console.log('Projekt erfolgreich erstellt:', response.data);
        return response.data;
    } catch (error) {
        console.error('Fehler beim Erstellen des Projekts:', error);
        throw error;
    }
}

export const AssistantHeader = ({ name, isLoading }) => (
    <div className="text-xs font-semibold text-gray-700 flex items-center gap-2">
        <CaptainLottie isLoading={isLoading} className="w-8" />
        <h1 className="-m-2">{name}</h1>
    </div>
)


export const renderMessage = (name, msg) => {
    const isSystem = msg.role === 'system'

    if (isSystem) {
        return (
            <div className="flex flex-col gap-2">
                {/* Header: nie als "loading" innerhalb der Nachricht */}
                <AssistantHeader name={name} isLoading={false} />

                <div className="text-sm ml-5 text-gray-800 whitespace-pre-wrap break-words font-normal">
                    {msg.content}
                </div>
            </div>
        )
    }

    return (
        <div className="bg-gray-100 p-3 rounded-tl-lg rounded-tr-lg rounded-bl-lg max-w-xl self-end text-sm text-gray-800 font-normal">
            <p className="whitespace-pre-wrap break-words">{msg.content}</p>
        </div>
    )
}


export function buildTree(issues) {
    // Map mit allen Issues nach Key
    const issueMap = Object.fromEntries(issues.map(i => [i.key, i]));
    // Baum-Wurzel: alle Epics
    const epics = issues.filter(i => i.fields.issuetype.name === 'Epic');
    // Für jede Epic, rekursiv Kinder aufbauen
    function buildChildren(parentKey, type) {
        if (type === 'Epic') {
            return issues.filter(i => i.fields.parent?.key === parentKey && i.fields.issuetype.name !== 'Epic' && i.fields.issuetype.subtask !== true)
                .map(task => ({
                    ...task,
                    children: buildChildren(task.key, 'Task')
                }));
        } else if (type === 'Task') {
            return issues.filter(i => i.fields.parent?.key === parentKey && i.fields.issuetype.subtask === true)
                .map(subtask => ({
                    ...subtask,
                    children: [] // Subtasks sind Blätter
                }));
        }
        return [];
    }
    return epics.map(epic => ({
        ...epic,
        children: buildChildren(epic.key, 'Epic')
    }));
}

export function colorFromString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    // 245–285° Violett, 55% Sättigung, 65% Helligkeit
    const base = 245;
    const range = 40;
    const hue = base + (Math.abs(hash) % range);
    return `hsl(${hue}, 55%, 65%)`;
}
