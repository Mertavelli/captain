import Modal from "../Modal";

export default function ChannelsModal({
    open, channels, activeChannels, setActiveChannels, onClose, onSubmit, slackConnected
}) {
    if (!open) return null;
    return (
        <Modal>
            <div className="w-full max-w-sm mx-auto bg-white rounded-xl shadow-2xl p-6 flex flex-col gap-3 z-50">
                <h2 className="text-lg font-semibold">Communication Channels</h2>
                <p className="text-sm text-gray-600">
                    Please also invite Captain to the channels directly in Slack, then enable the ones you want here.
                </p>
                <div className="flex flex-col gap-1">
                    {!slackConnected ? (
                        <div className="text-red-500 text-xs font-semibold py-2">
                            Please connect Slack first to select a channel.
                        </div>
                    ) : channels.length === 0 ? (
                        <div className="text-gray-400 text-xs italic">
                            No channels found.
                        </div>
                    ) : (
                        channels.map((c) => (
                            <label
                                key={c.id}
                                className="flex items-center gap-3 px-2 py-2 rounded-md border border-border bg-gray-50 hover:bg-gray-100 transition group cursor-pointer"
                            >
                                <input
                                    type="checkbox"
                                    checked={activeChannels.includes(c.id)}
                                    onChange={() => setActiveChannels(prev =>
                                        prev.includes(c.id)
                                            ? prev.filter(id => id !== c.id)
                                            : [...prev, c.id]
                                    )}
                                    className="accent-black w-4 h-4 rounded border-border transition"
                                />
                                <span className="text-sm font-medium text-gray-700 group-hover:text-black">{c.name}</span>
                            </label>
                        ))
                    )}
                </div>
                <div className="flex justify-end gap-2 mt-4">
                    <button
                        onClick={onClose}
                        className="px-4 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm cursor-pointer"
                    >Close</button>
                    <button
                        onClick={onSubmit}
                        className="px-4 py-1 rounded bg-accent hover:brightness-95 text-white text-sm shadow cursor-pointer"
                        disabled={!slackConnected}
                    >Accept</button>
                </div>
            </div>
        </Modal>
    );
}
