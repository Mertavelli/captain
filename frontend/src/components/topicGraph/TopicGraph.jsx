'use client';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, {
    Background,
    Controls,
    MiniMap,
    addEdge,
    useNodesState,
    useEdgesState,
    MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { nodeTypes } from './TopicNode';
import { buildGraph } from '@/lib/graph';
import { layoutWithElk } from '@/lib/elk';
import { layoutWithForce } from '@/lib/force';
import { useTopicGraphData } from '@/hooks/useTopicGraphData';

export default function TopicGraph({ scope = null, layout = 'force' }) {
    const { topics, relations } = useTopicGraphData(scope);
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [hoveredId, setHoveredId] = useState(null);
    const [layoutType, setLayoutType] = useState(layout); // 'force' | 'elk'
    const [chargeStrength, setChargeStrength] = useState(-260);
    const containerRef = useRef(null);

    // Layout when topics/relations change
    useEffect(() => {
        let killed = false;
        const { nodes: rawNodes, edges: rawEdges } = buildGraph({ topics, relations });

        const run = async () => {
            if (layoutType === 'elk') {
                const laidOut = await layoutWithElk(rawNodes, rawEdges);
                if (!killed) {
                    setNodes(laidOut);
                    setEdges(rawEdges);
                }
            } else {
                const size = containerRef.current?.getBoundingClientRect();
                const laidOut = await layoutWithForce(rawNodes, rawEdges, {
                    width: size?.width || 1200,
                    height: size?.height || 800,
                    iterations: 300,
                    strength: chargeStrength,
                });
                if (!killed) {
                    setNodes(laidOut);
                    setEdges(rawEdges);
                }
            }
        };

        run();
        return () => {
            killed = true;
        };
    }, [topics, relations, layoutType, chargeStrength, setNodes, setEdges]);

    const onConnect = useCallback((params) => setEdges((eds) => addEdge(params, eds)), [setEdges]);
    const onNodeClick = useCallback((_, node) => {
        console.log('node', node);
    }, []);
    const onSelectionChange = useCallback(() => { }, []);

    const neighborSets = useMemo(() => {
        const neighbors = new Map();
        edges.forEach((e) => {
            if (!neighbors.has(e.source)) neighbors.set(e.source, new Set());
            if (!neighbors.has(e.target)) neighbors.set(e.target, new Set());
            neighbors.get(e.source).add(e.target);
            neighbors.get(e.target).add(e.source);
        });
        return neighbors;
    }, [edges]);

    const displayNodes = useMemo(() => {
        if (!hoveredId) return nodes;
        const neigh = neighborSets.get(hoveredId) || new Set();
        return nodes.map((n) => {
            const isFocus = n.id === hoveredId || neigh.has(n.id);
            return {
                ...n,
                style: {
                    ...(n.style || {}),
                    opacity: isFocus ? 1 : 0.25,
                    outline: isFocus ? '2px solid #2563eb' : 'none',
                    transition: 'opacity 150ms',
                },
            };
        });
    }, [nodes, hoveredId, neighborSets]);

    const displayEdges = useMemo(() => {
        if (!hoveredId) return edges;
        const neigh = neighborSets.get(hoveredId) || new Set();
        return edges.map((e) => {
            const isFocus = e.source === hoveredId || e.target === hoveredId || neigh.has(e.source) || neigh.has(e.target);
            return {
                ...e,
                animated: isFocus || e.animated,
                style: {
                    ...(e.style || {}),
                    strokeWidth: isFocus ? 3 : (e.style?.strokeWidth || 1.5),
                    opacity: isFocus ? 0.95 : 0.25,
                },
            };
        });
    }, [edges, hoveredId, neighborSets]);

    // 1) defaultEdgeOptions gut sichtbar (türkis, dünn, gerade)
    const defaultEdgeOptions = {
        type: 'straight',
        style: { stroke: '#5ac0c8', strokeWidth: 1.2, opacity: 0.7 },
    };

    // 2) Container dunkel + Extras weg (MiniMap/Controls/Regler-UI entfernen)
    return (
        <div style={{ height: '80vh', width: '100%', position: 'relative' }}>
            <div
                ref={containerRef}
                style={{
                    flex: 1,
                    position: 'relative',
                    height: '100%',
                }}
            >
                <ReactFlow
                    nodes={displayNodes}
                    edges={displayEdges}
                    nodeTypes={nodeTypes}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onSelectionChange={onSelectionChange}
                    onNodeClick={onNodeClick}
                    onNodeMouseEnter={(e, node) => setHoveredId(node.id)}
                    onNodeMouseLeave={() => setHoveredId(null)}
                    fitView
                    defaultEdgeOptions={defaultEdgeOptions}
                    // Optional: glättet Animation beim Fit
                    fitViewOptions={{ padding: 0.2 }}
                >
                    {/* KEIN <MiniMap/> / <Controls/> / <Background/> */}
                </ReactFlow>
            </div>
        </div>
    );
}
