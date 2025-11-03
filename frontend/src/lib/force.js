let d3 = null;
async function ensureD3() {
    if (d3) return d3;
    d3 = await import('d3-force');
    return d3;
}

export async function layoutWithForce(nodes, edges, { width = 1200, height = 800, iterations = 300, strength = -260 } = {}) {
    const { forceSimulation, forceManyBody, forceCenter, forceLink } = await ensureD3();

    const simNodes = nodes.map((n) => ({ id: n.id }));
    const links = edges.map((e) => ({ source: e.source, target: e.target }));

    const sim = forceSimulation(simNodes)
        .force('charge', forceManyBody().strength(strength))
        .force('center', forceCenter(width / 2, height / 2))
        .force('link', forceLink(links).id((d) => d.id).distance(140).strength(0.4));

    // Run a fixed number of ticks for deterministic-ish layout on mount
    for (let i = 0; i < iterations; i += 1) sim.tick();
    sim.stop();

    const pos = {};
    simNodes.forEach((n) => {
        pos[n.id] = { x: n.x || 0, y: n.y || 0 };
    });

    return nodes.map((n) => ({
        ...n,
        position: pos[n.id] || n.position || { x: 0, y: 0 },
        positionAbsolute: pos[n.id] || n.position,
    }));
}
