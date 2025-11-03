'use client'

import React, { useState, useRef, useEffect } from "react"
import { ChevronDown } from "lucide-react"

export default function SortByDropdown({
    value,
    onChange,
    options = [
        { label: "Date created", value: "dateCreated" },
        { label: "Alphabetical", value: "alphabetical" },
    ],
}) {
    const [open, setOpen] = useState(false)
    const ref = useRef(null)

    const selectedOption = options.find((opt) => opt.value === value)

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (ref.current && !ref.current.contains(e.target)) {
                setOpen(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => {
            document.removeEventListener("mousedown", handleClickOutside)
        }
    }, [])

    return (
        <div ref={ref} className="relative w-full">
            <div
                className="border border-border focus-within:border-gray-700 px-2 flex items-center justify-between text-gray-500 text-xs p-1 rounded-md w-full transition-colors cursor-pointer shadow-xs"
                onClick={() => setOpen(!open)}
            >
                <span className="text-gray-900 dark:text-white">
                    {selectedOption?.label}
                </span>
                <ChevronDown size={15} />
            </div>

            {open && (
                <div className="absolute z-10 mt-1 w-full bg-white rounded-md shadow-sm border border-border">
                    {options.map((opt) => (
                        <div
                            key={opt.value}
                            onClick={() => {
                                onChange(opt.value)
                                setOpen(false)
                            }}
                            className="px-3 py-2 text-xs text-gray-900 hover:bg-gray-100 cursor-pointer"
                        >
                            {opt.label}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
