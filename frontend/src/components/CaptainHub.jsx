'use client'

import { useState } from 'react'
import { AnimatedList } from '@/components/magicui/animated-list'
import { mockBlockerData } from '@/helpers/mockData'
import CaptainLottie from './CaptainLottie'

export default function CaptainHub({ blockerLoading }) {
    const [showNotes, setShowNotes] = useState(false)

    return (
        <div className='absolute top-8 right-8 flex flex-col items-end gap-2'>
            {/* Captain Animation als Button */}
            <button onClick={() => setShowNotes(prev => !prev)} className="relative cursor-pointer">
                <CaptainLottie blockerLoading={blockerLoading} />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
            </button>

            {/* Animierte Notes */}
            {showNotes && (
                <AnimatedList>
                    {mockBlockerData.captain_notes.map((note, i) => {
                        const Icon = note.icon
                        return (
                            <div
                                key={i}
                                className="flex gap-2 items-start border p-3 rounded-md bg-white shadow-sm w-[260px]"
                            >
                                <Icon
                                    className={`w-5 h-5 mt-1 ${note.type === 'critical'
                                        ? 'text-red-600'
                                        : note.type === 'warning'
                                            ? 'text-orange-500'
                                            : 'text-blue-500'
                                        }`}
                                />
                                <div className="flex-1">
                                    <div className="flex justify-between text-sm font-semibold text-gray-800">
                                        <span>{note.title}</span>
                                        <span className="text-xs text-gray-400 font-normal ml-2">
                                            · {note.timestamp}
                                        </span>
                                    </div>
                                    <div className="text-xs text-gray-500 mt-0.5">{note.description}</div>
                                </div>
                            </div>
                        )
                    })}
                </AnimatedList>
            )}
        </div>
    )
}
