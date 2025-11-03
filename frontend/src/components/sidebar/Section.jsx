import Avatar from './Avatar';
import { MessageSquareShare } from "lucide-react";

export default function Section({ title, list, onAdd, handleClick }) {
    return (
        <div>
            <div className="flex items-center justify-between mb-2 sticky top-0 z-10 bg-white border-b border-gray-100 py-2">
                <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
                {onAdd && (
                    <button
                        onClick={onAdd}
                        className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-600 cursor-pointer"
                    >+ Add</button>
                )}
            </div>
            <ul>
                {list.length === 0 && (
                    <li className="text-xs text-gray-400">No entries</li>
                )}
                {list.map((entry) => (
                    <li key={entry.id}>
                        <button
                            onClick={() => handleClick(entry)}
                            className={`w-full p-1 flex items-center gap-2 rounded transition-all cursor-pointer 
                                ${entry.isActive ? 'bg-accent/20 border border-accent text-accent' : 'hover:bg-gray-100'}
                            `}
                        >
                            <MessageSquareShare size={20} className='text-gray-500' />
                            <div className="text-start">
                                <div className="text-sm font-medium">
                                    {entry?.name || ""}
                                </div>
                                <div className="text-[0.7rem] text-gray-500">
                                    {entry?.key || ""}
                                </div>
                            </div>
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
}
