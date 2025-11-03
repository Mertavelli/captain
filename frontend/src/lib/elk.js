let elkInstance = null;

async function ensureElk() {
    if (elkInstance) return elkInstance;
    const { default: ELK } = await import('elkjs/lib/elk.bundled');
    elkInstance = new ELK();
    return elkInstance;
}

export async function layoutWithElk(nodes, edges) {
    const elk = await ensureElk();
    const elkGraph = {
        id: 'root',
        layoutOptions: {
            'elk.algorithm': 'layered',
            'elk.spacing.nodeNode': '40',
            'elk.layered.spacing.nodeNodeBetweenLayers': '60',
            'elk.direction': 'RIGHT',
        },
        children: nodes.map((n) => ({ id: n.id, width: 220, height: 120 })),
        edges: edges.map((e) => ({ id: e.id, sources: [e.source], targets: [e.target] })),
    };

    const res = await elk.layout(elkGraph);
    const posById = {};
    (res.children || []).forEach((c) => {
        posById[c.id] = { x: c.x || 0, y: c.y || 0 };
    });

    return nodes.map((n) => ({
        ...n,
        position: posById[n.id] || n.position || { x: 0, y: 0 },
        positionAbsolute: posById[n.id] || n.position,
    }));
}