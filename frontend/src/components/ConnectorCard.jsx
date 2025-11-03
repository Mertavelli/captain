'use client'

import React from 'react'
export default function ConnectorCard({ logoSrc, title, email, onConfigure }) {

    return (
        <div className="flex items-center justify-between border border-border rounded-md p-4 w-full bg-white">
            {/* Left: Logo + Text */}
            <div className="flex items-center gap-4">
                <img src={logoSrc} alt={`${title} logo`} className="w-7 h-7 object-contain" />

                <div className="flex flex-col">
                    <span className="text-xs font-medium text-gray-900">{title}</span>
                    <span className="text-[0.7rem] text-gray-500">{email}</span>
                </div>
            </div>

            {/* Right: Configure Button */}
            <button
                onClick={onConfigure}
                className="text-xs text-white bg-black px-3 py-1.5 rounded-full hover:bg-gray-800 transition cursor-pointer"
            >
                Connect
            </button>
        </div>
    )
}
