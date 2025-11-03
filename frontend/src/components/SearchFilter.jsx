'use client'

import React from "react"
import { Search } from "lucide-react"

export default function SearchFilter({ placeholder, value, onChange }) {
    return (
        <div className="border border-border focus-within:border-gray-700 flex items-center text-xs gap-1 px-2 p-1 rounded-md w-full transition-colors shadow-xs">
            <Search size={15} />
            <input
                className="w-full outline-none"
                placeholder={placeholder}
                value={value}
                onChange={e => onChange(e.target.value)}
            />
        </div>
    )
}
