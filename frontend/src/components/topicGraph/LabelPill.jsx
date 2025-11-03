import React from 'react';

export function LabelPill({ text }) {
    return (
        <span
            style={{
                fontSize: 10,
                padding: '2px 6px',
                borderRadius: 999,
                background: 'rgba(0,0,0,0.06)',
                marginRight: 6,
                whiteSpace: 'nowrap',
            }}
        >
            {text}
        </span>
    );
}