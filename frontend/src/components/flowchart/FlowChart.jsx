'use client'

import React, { useMemo } from 'react'
import ReactFlow, { Background, Controls } from 'reactflow'
import 'reactflow/dist/style.css'
import dagre from '@dagrejs/dagre'
import UnifiedNode from './UnifiedNode'
import { removePlanItemByIssueKey } from './supabasePlan' // <— neu

const nodeWidth = 208
const nodeHeight = 102

function getLayoutedElements(nodes, edges, direction = 'TB') {
    const dagreGraph = new dagre.graphlib.Graph()
    dagreGraph.setDefaultEdgeLabel(() => ({}))

    const isHorizontal = direction === 'LR'
    dagreGraph.setGraph({
        rankdir: direction,
        nodesep: 50,
        ranksep: 170,
        marginx: 50,
        marginy: 30,
    })

    nodes.forEach((node) => {
        if (node.type === 'dummy') {
            dagreGraph.setNode(node.id, { width: 300, height: 70 })
        } else {
            dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight })
        }
    })

    edges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target)
    })

    dagre.layout(dagreGraph)

    const layoutedNodes = nodes.map((node) => {
        const nodeWithPosition = dagreGraph.node(node.id)
        return {
            ...node,
            position: {
                x: nodeWithPosition.x - (node.type === 'dummy' ? 150 : nodeWidth / 2),
                y: nodeWithPosition.y - (node.type === 'dummy' ? 35 : nodeHeight / 2),
            },
            sourcePosition: isHorizontal ? 'right' : 'bottom',
            targetPosition: isHorizontal ? 'left' : 'top',
        }
    })

    return { nodes: layoutedNodes, edges }
}

function blockerTypeFromLabels(labels) {
    if (!Array.isArray(labels)) return null
    if (labels.includes('blocker_critical')) return 'critical'
    if (labels.includes('blocker_warning')) return 'warning'
    return null
}

export default function FlowChart({ issues, preview, captainId, onPlanItemRemoved }) {
    const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
        const nodes = []
        const edges = []

        const epics = issues.filter((issue) => issue.fields.issuetype.name === 'Epic')
        let epicIndex = 0

        const tasks = issues.filter(
            (issue) =>
                issue.fields.issuetype.name !== 'Epic' &&
                issue.fields.issuetype.subtask !== true
        )

        const subtasksByParent = {}
        issues.forEach((issue) => {
            if (issue.fields.issuetype.subtask === true && issue.fields.parent?.key) {
                const parentKey = issue.fields.parent.key
                if (!subtasksByParent[parentKey]) subtasksByParent[parentKey] = []
                subtasksByParent[parentKey].push(issue)
            }
        })

        issues.forEach((issue) => {
            let type = 'task'
            if (issue.fields.issuetype.name === 'Epic') type = 'epic'
            else if (issue.fields.issuetype.subtask === true) type = 'subtask'

            const labels = Array.isArray(issue.fields.labels) ? issue.fields.labels : []
            const blockerType = blockerTypeFromLabels(labels)

            nodes.push({
                id: `node-${issue.key}`,
                type,
                data: {
                    label: issue.fields.summary,
                    assignee: issue.fields.assignee
                        ? {
                            name: issue.fields.assignee.displayName,
                            avatarUrl: issue.fields.assignee.avatarUrl
                        }
                        : null,
                    blockerType,
                    blockerMessage: null,
                    duedate: issue.fields.duedate,
                    key: issue.key,
                    status: issue.fields.status?.name ?? '',
                    statusCategory: issue.fields.status?.statusCategory?.key ?? null,
                    change: issue.change || null,
                    originalSummary: issue.originalSummary || null,
                },
                position: { x: 0, y: 0 },
            })

            // Dummy-Node nach jedem Epic (außer dem letzten)
            if (issue.fields.issuetype.name === 'Epic' && epicIndex < epics.length - 1) {
                nodes.push({
                    id: `dummy-epic-gap-${epicIndex}`,
                    type: 'dummy',
                    data: { label: '' },
                    position: { x: 0, y: 0 },
                    style: { width: 300, height: 70, opacity: 0, pointerEvents: 'none' },
                })
                epicIndex++
            }

            // Dummy-Nodes nach Subtask-Gruppen (wenn >1 Task existiert)
            if (issue.fields.issuetype.subtask !== true && tasks.length > 1) {
                const subtasks = subtasksByParent[issue.key] || []
                if (subtasks.length > 0) {
                    const lastSubtask = subtasks[subtasks.length - 1]?.key
                    if (lastSubtask) {
                        nodes.push({
                            id: `dummy-subtask-gap-after-${lastSubtask}`,
                            type: 'dummy',
                            data: { label: '' },
                            position: { x: 0, y: 0 },
                            style: { width: 300, height: 70, opacity: 0, pointerEvents: 'none' },
                        })
                    }
                }
            }

            // Kanten
            if (issue.fields.parent?.key) {
                edges.push({
                    id: `edge-${issue.fields.parent.key}-${issue.key}`,
                    source: `node-${issue.fields.parent.key}`,
                    target: `node-${issue.key}`,
                    animated: false,
                    style: {
                        stroke: issue.fields.issuetype.name === 'Epic' ? '#bbb' : '#4477ee',
                        strokeWidth: issue.fields.issuetype.name === 'Epic' ? 1.5 : 1.3,
                        strokeDasharray: issue.fields.issuetype.name === 'Epic' ? undefined : '3 2',
                    },
                })
            }
        })

        return { nodes, edges }
    }, [issues])

    const { nodes, edges } = useMemo(
        () => getLayoutedElements(initialNodes, initialEdges, 'TB'),
        [initialNodes, initialEdges]
    )

    async function handleRemoveFromPlan(issueKey) {
        try {
            await removePlanItemByIssueKey(captainId, issueKey)
            if (onPlanItemRemoved) onPlanItemRemoved(issueKey)
        } catch (e) {
            // Zeige präzise Hinweise im Log/Toast
            const msg = (e && e.message) || 'Unbekannter Fehler'
            console.error('Plan-Eintrag konnte nicht entfernt werden:', msg, e)
            // optional: toast.error(msg)
        }
    }

    return (
        <div className="w-full h-full border border-border overflow-hidden rounded-md">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                fitView
                nodeOrigin={[0.5, 0]}
                proOptions={{ hideAttribution: true }}
                nodeTypes={{
                    epic: (props) => (
                        <UnifiedNode
                            {...props}
                            type="epic"
                            onRemoveFromPlan={() => handleRemoveFromPlan(props.data.key)}
                        />
                    ),
                    task: (props) => (
                        <UnifiedNode
                            {...props}
                            type="task"
                            onRemoveFromPlan={() => handleRemoveFromPlan(props.data.key)}
                        />
                    ),
                    subtask: (props) => (
                        <UnifiedNode
                            {...props}
                            type="subtask"
                            onRemoveFromPlan={() => handleRemoveFromPlan(props.data.key)}
                        />
                    ),
                    dummy: () => <div style={{ width: 300, height: 70, opacity: 0, pointerEvents: 'none' }} />,
                }}

                style={{ backgroundColor: '#ffffff' }}
            >
                <Background gap={32} size={0.5} color="#cccccc" />
                {!preview && <Controls />}
            </ReactFlow>
        </div>
    )
}
