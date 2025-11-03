import React from 'react';
import { LabelPill } from './LabelPill';
import { Handle, Position } from 'reactflow';

export function TopicNode({ data }) {
    const { title, labels = [], summary, last_event_ts, updated_at } = data || {};
    const ts = last_event_ts || updated_at;

    return (
        <div
            style={{
                background: 'transparent',
                border: 'none',
                boxShadow: 'none',
                padding: 0,
                minWidth: 0,
                maxWidth: 'unset',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                pointerEvents: 'all',
            }}
        >
            {/* Kanten-Anker (wichtig, damit Linien gerendert werden) */}
            <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
            <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />

            {/* Punkt */}
            <div
                style={{
                    width: 10,
                    height: 10,
                    borderRadius: '999px',
                    background: data?.color || '#ff3bd4', // Magenta wie im Bild
                    boxShadow: '0 0 8px rgba(255,59,212,0.6)',
                }}
            />

            {/* Label rechts vom Punkt */}
            <span className='text-xs'>
                {title}
            </span>
        </div>
    );
}

export const nodeTypes = { topic: TopicNode };