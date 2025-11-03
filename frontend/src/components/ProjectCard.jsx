'use client'

import Link from 'next/link'
import { Briefcase, Calendar } from 'lucide-react'

export default function ProjectCard({ project }) {
    return (
        <Link
            href={`/pages/${project.id}`}
            className="bg-white border border-border rounded-2xl p-4 hover:border-accent/75 transition-all flex flex-col justify-between h-full"
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Briefcase size={16} className="text-gray-400" />
                    <span className="font-medium">Projekt</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                    <Calendar size={14} />
                    <span>{project.createdAt || '–'}</span>
                </div>
            </div>

            {/* Title & Description */}
            <div className="mb-4">
                <h2 className="text-xl font-semibold text-gray-900">{project.name}</h2>
                <p className="text-gray-700 mt-2 text-sm leading-relaxed line-clamp-3">{project.description}</p>
            </div>

            {/* Footer */}
            <div className="flex justify-between items-center mt-auto pt-2 border-t border-gray-100">
                <span className="text-xs text-gray-400">{project.status || 'Aktiv'}</span>
                <span className="text-sm text-accent font-medium">Zum Projekt &rarr;</span>
            </div>
        </Link>
    )
}
