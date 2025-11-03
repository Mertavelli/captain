'use client'
import { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { formatDateTime } from '@/helpers/helpers';
import { X } from 'lucide-react';
import ReactFlow, { Background, Controls, ReactFlowProvider } from 'reactflow';
import 'reactflow/dist/style.css';

export default function ActionCard({ action, onComplete }) {
    const [loading, setLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);

    const handleConfirm = async () => {
        setLoading(true);
        try {
            const res = await axios.post(action.endpoint, { taskId: action.id });
            toast.success(res.data.message || 'Aktion erfolgreich durchgeführt!');
            onComplete();
        } catch (err) {
            toast.error('Fehler bei der Ausführung.');
        } finally {
            setLoading(false);
            setShowModal(false);
        }
    };

    return (
        <>
            {/* Action Summary Card */}
            <div
                onClick={() => setShowModal(true)}
                className="bg-white border border-border rounded-xl p-6 cursor-pointer hover:border-accent/75 transition-all"
            >
                <div className="flex justify-between items-start mb-2">
                    <h2 className="text-lg font-semibold text-gray-900">{action.title}</h2>
                    <span className="text-xs text-gray-500 font-secondary">{formatDateTime(action.dateTime)}</span>
                </div>
                <p className="text-gray-700 mb-4 leading-relaxed text-start">{action.description}</p>
                <div className="flex gap-3 justify-end">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onComplete();
                        }}
                        className="px-4 py-2 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition cursor-pointer"
                    >
                        Verwerfen
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleConfirm();
                        }}
                        className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition cursor-pointer"
                    >
                        Genehmigen
                    </button>
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
                    <div className="relative bg-white border border-border rounded-xl w-full max-w-5xl p-8 shadow-xl">

                        {/* Close Icon */}
                        <button
                            onClick={() => setShowModal(false)}
                            className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 transition cursor-pointer"
                        >
                            <X size={22} />
                        </button>

                        {/* Meta Info */}
                        <div className="mb-6">
                            <h3 className="text-xl font-bold text-gray-900">{action.title}</h3>
                            <p className="text-sm text-gray-600">{action.description}</p>
                            <p className="text-xs text-gray-400 mt-1 text-end">{formatDateTime(action.dateTime)}</p>
                        </div>

                        {/* Workflow Diagram */}
                        <div className="h-[200px] rounded-lg border border-gray-200 overflow-hidden bg-gray-50">
                            <ReactFlowProvider>
                                <ReactFlow
                                    nodes={action.flowElements?.filter(e => !e.source) || []}
                                    edges={action.flowElements?.filter(e => e.source) || []}
                                    fitView
                                    proOptions={{ hideAttribution: true }}
                                    nodesDraggable={false}
                                    nodesConnectable={false}
                                    elementsSelectable={false}
                                    zoomOnScroll={false}
                                    panOnScroll={false}
                                    zoomOnDoubleClick={false}
                                    panOnDrag={false}
                                    minZoom={1.2}
                                    maxZoom={1.2}
                                />
                            </ReactFlowProvider>
                        </div>


                        {/* Action Buttons */}
                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onComplete();
                                }}
                                className="px-4 py-2 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition cursor-pointer"
                            >
                                Verwerfen
                            </button>
                            <button
                                onClick={handleConfirm}
                                className={`px-4 py-2 text-sm text-white rounded-lg transition ${loading ? 'bg-gray-500' : 'bg-gray-900 hover:bg-gray-800 cursor-pointer'
                                    }`}
                                disabled={loading}
                            >
                                {loading ? 'Ausführen…' : 'Bestätigen'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
