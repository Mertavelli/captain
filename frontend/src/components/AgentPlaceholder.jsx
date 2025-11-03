

export default function AgentPlaceholder({ captain }) {
    return (
        <div className="flex flex-col items-center justify-center w-full h-full border border-border rounded-md bg-white p-8 gap-4">
            <img src="/agent-avatar.png" alt="Agent Avatar" className="w-20 h-20 rounded-full" />
            <h2 className="text-2xl font-bold">{captain?.name}</h2>
            <p className="text-accent font-medium">{captain?.role}</p>
            {captain?.description && (
                <p className="text-gray-500 text-center max-w-md">{captain?.description}</p>
            )}
            {/* Optional: Tools/Connections anzeigen */}
            {Array.isArray(captain?.connections) && captain?.connections.length > 0 && (
                <div className="flex gap-2 mt-2">
                    {captain?.connections.map((tool) => (
                        <img
                            key={tool}
                            src={`/logos/${tool}.png`}
                            alt={tool}
                            className="w-8 h-8 rounded-full bg-white border"
                            title={tool}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}