'use client'

import React, { useState, useEffect, useRef } from 'react'
import { renderMessage } from '@/helpers/helpers'
import { ArrowUp, Lightbulb } from 'lucide-react'
import { motion } from 'framer-motion'
import Cookies from 'js-cookie'
import { createClient } from '@/utils/supabase/client'
import { AssistantHeader } from '@/helpers/helpers'
import { MessageSquareOff } from "lucide-react"

export default function Chat({ captain, captainLoading, chatLoading, setChatLoading, messages, setMessages }) {
    const [input, setInput] = useState("")
    const messagesEndRef = useRef(null)
    const textareaRef = useRef(null)            // ⬅️ neu
    const supabase = createClient()

    const assistantHasOutput =
        chatLoading &&
        messages.length > 0 &&
        messages[messages.length - 1]?.role === 'system' &&
        (messages[messages.length - 1]?.content ?? '').trim().length > 0

    // zentrales Auto-Resize
    const autoResize = () => {
        const el = textareaRef.current
        if (!el) return
        el.style.height = 'auto'
        el.style.height = el.scrollHeight + 'px'
    }

    // nach jeder Input-Änderung Höhe neu berechnen (auch nach setInput(""))
    useEffect(() => {
        autoResize()
    }, [input])

    // optional: beim Mount eine Grundhöhe setzen
    useEffect(() => {
        autoResize()
    }, [])

    const handleSubmit = async () => {
        if (!input.trim()) return

        const newMessage = { role: 'user', content: input.trim() }
        const updatedMessages = [...messages, newMessage]
        setMessages(updatedMessages)
        setInput("")            // ⬅️ leert das Feld; useEffect sorgt fürs Schrumpfen
        setChatLoading(true)

        const { data: { session } } = await supabase.auth.getSession()
        const user = session?.user

        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: updatedMessages,
                    captain: {
                        id: captain?.id,
                        name: captain?.name,
                        role: captain?.role,
                        description: captain?.description,
                        connections: captain?.connections,
                        jira_project_key: captain?.jira_project_key
                    },
                    user: { id: user?.id }
                }),
            })

            if (!response.body) throw new Error("Kein Body")

            const reader = response.body.getReader()
            const decoder = new TextDecoder("utf-8")
            let done = false
            let accumulated = ""

            setMessages(prev => [...prev, { role: 'system', content: "" }])

            while (!done) {
                const { value, done: doneReading } = await reader.read()
                done = doneReading
                const chunk = decoder.decode(value)
                accumulated += chunk

                setMessages(prev => {
                    const newMessages = [...prev]
                    const last = newMessages[newMessages.length - 1]
                    if (last.role === 'system') {
                        last.content = accumulated
                    }
                    return [...newMessages]
                })
            }
        } catch (err) {
            console.error("Fehler beim Streamen:", err)
        } finally {
            setChatLoading(false)
        }
    }

    // Cookie beim Laden auslesen (nur für diesen Captain)
    useEffect(() => {
        if (!captain?.id) return
        const stored = Cookies.get(`chat_messages_captain_${captain.id}`)
        if (stored) {
            try {
                const parsed = JSON.parse(stored)
                if (Array.isArray(parsed)) setMessages(parsed)
            } catch (err) {
                console.error("Cookie konnte nicht geparst werden:", err)
            }
        }
    }, [captain?.id])

    // Cookie bei Änderung speichern (für den aktiven Captain)
    useEffect(() => {
        if (!captain?.id) return
        Cookies.set(`chat_messages_captain_${captain.id}`, JSON.stringify(messages), { expires: 1 })
    }, [messages, captain?.id])

    // Scroll zur neusten Nachricht
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
        }
    }, [messages])

    const isAnimating = captainLoading
    const statusText = captainLoading ? "Loading Captain..." : (captain?.role ?? "")

    const handleClearChat = () => {
        if (captain?.id) {
            Cookies.remove(`chat_messages_captain_${captain.id}`)
            setMessages([])
        }
    }

    return (
        <div className='bg-white p-2.5 h-screen flex flex-col w-full'>
            <div className="flex flex-col flex-grow overflow-hidden">
                {/* Header */}
                <div className='flex items-center gap-2 mb-4 justify-between'>
                    <div className="flex items-center gap-2">
                        <img src='/emblem-dark.svg' className='w-6' />
                        <div>
                            <p className="text-sm font-semibold">{captain?.name}</p>
                            {isAnimating ? (
                                <motion.p
                                    className="text-[0.7rem] whitespace-nowrap"
                                    animate={{ color: ['#9CA3AF', '#6B7280', '#9CA3AF'] }}
                                    transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                                >
                                    {statusText}
                                </motion.p>
                            ) : (
                                <p className="text-[0.7rem] text-gray-500 whitespace-nowrap">{statusText}</p>
                            )}
                        </div>
                    </div>
                    <button onClick={handleClearChat}>
                        <MessageSquareOff size={20} className='text-gray-500 cursor-pointer' />
                    </button>
                </div>

                {/* Messages */}
                <div className="flex flex-col gap-4 overflow-y-auto pr-2 flex-grow pb-10 relative">
                    {messages?.map((msg, index) => (
                        <React.Fragment key={index}>
                            {renderMessage(captain.name, msg, index === messages.length - 1, chatLoading)}
                        </React.Fragment>
                    ))}

                    {chatLoading && !assistantHasOutput && (
                        <div className="flex flex-col gap-2">
                            <AssistantHeader isLoading={true} />
                            <div className="ml-5 mt-2 text-gray-400 text-[0.7rem] flex items-center gap-1">
                                <Lightbulb size={15} />
                                <motion.p
                                    animate={{ opacity: [0.3, 1, 0.3] }}
                                    transition={{ duration: 2.0, repeat: Infinity }}
                                    className="text-gray-600 font-semibold"
                                >
                                    Thinking…
                                </motion.p>
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* Input */}
            <div className='bg-accent/10 rounded-xl p-2 w-full border border-border mt-2'>
                <textarea
                    ref={textareaRef}                              // ⬅️ neu
                    className="w-full focus:outline-none focus:ring-0 text-sm mb-8 placeholder:text-gray-500 resize-none overflow-hidden leading-snug"
                    placeholder={`Ask ${captain?.name}...`}
                    rows={1}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}      // state steuert Inhalt
                    onInput={autoResize}                            // beim Tippen wachsen
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            handleSubmit()
                        }
                    }}
                />

                {/* Buttons */}
                <div className='flex items-center justify-end'>
                    <div onClick={handleSubmit} className='text-white bg-accent rounded-full w-5 h-5 cursor-pointer flex items-center justify-center'>
                        <ArrowUp size={14} />
                    </div>
                </div>
            </div>
        </div>
    )
}
