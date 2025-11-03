'use client'

import { useState, useEffect } from "react"
import { ChevronRight } from "lucide-react"
import { ShimmerButton } from "@/components/magicui/shimmer-button"
import { useRouter } from "next/navigation"
import { createClient } from "@/utils/supabase/client"
import { toast } from "sonner"
import { Trio } from 'ldrs/react'
import 'ldrs/react/Trio.css'
import Modal from "./Modal"
import Input from "./Input"
import ConnectorCard from "./ConnectorCard"
import { CONNECTORS } from "@/app/connectors"

export default function Hero() {
    const router = useRouter()
    const supabase = createClient()


    const [showModal, setShowModal] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [captainName, setCaptainName] = useState('')
    const [role, setRole] = useState('IT Project Manager');
    const [description, setDescription] = useState('')
    const [selectedConnectors, setSelectedConnectors] = useState([])
    const [jiraEmail, setJiraEmail] = useState(null)
    const [slackEmail, setSlackEmail] = useState(null)

    // Optionen & Auswahl-State (JSON-sauber)
    const [optionsByConnector, setOptionsByConnector] = useState({})
    const [selectedOptionByConnector, setSelectedOptionByConnector] = useState({})
    const [loadingOptions, setLoadingOptions] = useState({})
    const [optionsError, setOptionsError] = useState({})

    // Hilfsfunktion: aktuell ausgewählten Jira-Projekt-Key holen (Single-Select)
    function getSelectedJiraProjectKey() {
        const selectedId = selectedOptionByConnector["jira"]
        if (!selectedId) return null
        const opts = optionsByConnector["jira"] || []
        const hit = opts.find(o => o.id === selectedId)
        return (hit && (hit.subtitle || (hit.data && hit.data.key))) || null
    }

    // JWT Helper
    async function getJwt() {
        const { data: { session } } = await supabase.auth.getSession()
        const jwt = session && session.access_token
        if (!jwt) throw new Error("No session")
        return jwt
    }

    // Connector aktivieren/deaktivieren + ggf. Optionen laden (normalisiert)
    const handleToggleConnector = async (id) => {
        const willSelect = !selectedConnectors.includes(id)

        // sofort UI-Checkbox updaten
        setSelectedConnectors(prev =>
            willSelect ? [...prev, id] : prev.filter(c => c !== id)
        )

        // nur beim Aktivieren laden (und nur, wenn selectable & Loader vorhanden & noch nicht geladen)
        if (willSelect) {
            const connector = CONNECTORS.find(c => c.id === id)
            const isSelectable = connector && connector.selectable
            const hasLoader = connector && typeof connector.optionsLoader === "function"

            if (isSelectable && hasLoader && !optionsByConnector[id]) {
                try {
                    setLoadingOptions(p => ({ ...p, [id]: true }))
                    setOptionsError(p => ({ ...p, [id]: null }))

                    const raw = await connector.optionsLoader(getJwt)

                    // JSON-saubere, flache Optionen bauen (keine rohen Jira-Objekte)
                    const opts = (raw || []).map(p => ({
                        id: String(p.id ?? p.key ?? p.projectId ?? p.uid ?? Math.random().toString(36).slice(2)),
                        label: p.name ?? p.label ?? "Unnamed",
                        subtitle: p.key ?? p.subtitle ?? null,
                        iconUrl: (p.avatarUrls && p.avatarUrls["16x16"]) || p.iconUrl || null,
                        data: { key: p.key ?? null }, // klein & flach halten
                    }))

                    setOptionsByConnector(p => ({ ...p, [id]: opts }))

                    // Initial: keine Vorauswahl
                    setSelectedOptionByConnector(p => ({ ...p, [id]: null }))
                } catch (e) {
                    setOptionsError(p => ({ ...p, [id]: e?.message || "Failed to load options" }))
                    setOptionsByConnector(p => ({ ...p, [id]: [] }))
                } finally {
                    setLoadingOptions(p => ({ ...p, [id]: false }))
                }
            }
        } else {
            // Beim Deaktivieren die zugehörige Auswahl & Optionen optional aufräumen
            setSelectedOptionByConnector(p => {
                const clone = { ...p }
                delete clone[id]
                return clone
            })
            // Optionen kann man behalten (für erneutes Aktivieren) oder löschen – hier lassen wir sie stehen.
        }
    }

    // Single-Select Setter (String statt Set)
    const selectSingleOption = (connectorId, optionId) => {
        setSelectedOptionByConnector(prev => ({ ...prev, [connectorId]: optionId }))
    }

    const handleCreateCaptain = async () => {
        setIsLoading(true)

        try {
            const effectiveRole = (role ?? '').trim() || 'IT Project Manager';

            if (!captainName || !role) {
                toast.error("Please fill out all required fields.")
                return
            }

            const { data: { user }, error: userErr } = await supabase.auth.getUser()
            if (userErr) console.error("[CreateCaptain] getUser error:", userErr)
            if (!user?.id) {
                toast.error("You must be logged in.")
                console.warn("[CreateCaptain] no user session")
                return
            }

            // Jira: genau 1 Projekt notwendig, wenn Jira gewählt ist
            let projectKey = null
            if (selectedConnectors.includes("jira")) {
                projectKey = getSelectedJiraProjectKey()
                console.log("[CreateCaptain] selected Jira projectKey:", projectKey)
                if (!projectKey) {
                    toast.error("Please select exactly one Jira project.")
                    return
                }
            }

            const payload = {
                name: captainName,
                role: effectiveRole,
                description,
                connections: selectedConnectors,
                jira_project_key: projectKey, // nur der Key
                user_id: user.id,
            }

            const { data, error } = await supabase
                .from('captains')
                .insert([payload])
                .select()

            if (error) {
                console.error("[CreateCaptain] insert error:", error)
                toast.error(error.message || "Failed to create Captain.")
                return
            }

            const newCaptain = data?.[0]

            // Erstellen der Webhook für das eine projekt
            if (payload.connections.includes("jira") && payload.jira_project_key) {
                try {
                    const { data: { session } } = await supabase.auth.getSession()
                    const jwt = session?.access_token
                    if (!jwt) throw new Error("No session token")
                    const res = await fetch(
                        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-jira-webhook`,
                        {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                "Authorization": `Bearer ${jwt}`,
                            },
                            body: JSON.stringify({
                                captainId: newCaptain.id,             // optional
                                projectKey: payload.jira_project_key, // so erwartet die Function es
                            }),
                        }
                    )

                    let body = null
                    try { body = await res.json() } catch { /* ignore */ }
                    console.log("BODY: ", body)
                    if (!res.ok) {
                        console.error("[CreateCaptain] webhook failed:", body)
                        toast.error("Webhook creation failed")
                    } else {
                        console.log("[CreateCaptain] webhook ok:", body)
                        toast.success("Jira webhook created!")
                    }
                } catch (e) {
                    console.error("[CreateCaptain] webhook error:", e)
                    toast.error(e?.message || "Could not trigger webhook creation")
                }
            }

            // Reset UI
            setShowModal(false)
            setCaptainName("")
            setRole("")
            setDescription("")
            setSelectedConnectors([])
            setOptionsByConnector({})
            setSelectedOptionByConnector({})
            setLoadingOptions({})
            setOptionsError({})

            router.push(`/captains/${newCaptain.id}`)

        } catch (err) {
            console.error("[CreateCaptain] unexpected error:", err)
            toast.error(err?.message || "Unexpected error.")
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        const supabase = createClient()
        const fetchEmails = async () => {
            // Jira Email
            const { data: jiraData } = await supabase
                .from('jira_connections')
                .select('email')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle()
            setJiraEmail(jiraData?.email || null)

            // Slack Email
            const { data: slackData } = await supabase
                .from('slack_connections')
                .select('email')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle()
            setSlackEmail(slackData?.email || null)
        }
        fetchEmails()
    }, [])

    return (
        <div className="flex flex-col items-center justify-center relative">
            <div className="flex items-center">
                <img src="/logo-dark.png" className="w-60 mr-2.5" alt="Logo" />
                <h1 className="font-semibold text-5xl leading-tight">takes the wheel</h1>
            </div>
            <p className="text-gray-500 text-sm">Manage Captains – AI Agents that take action</p>
            <div onClick={() => setShowModal(true)} className="mt-8 cursor-pointer">
                <ShimmerButton>
                    <div className="flex items-center gap-2">
                        <p>Create Captain</p>
                        <ChevronRight size={20} />
                    </div>
                </ShimmerButton>
            </div>

            {/* Modal */}
            {showModal && (
                <Modal>
                    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
                        <div className="bg-white rounded-xl p-6 w-[90%] max-w-md relative pointer-events-auto flex flex-col gap-4">
                            <h2 className="text-xl font-semibold mb-2">Create New Captain</h2>

                            <Input
                                label="Captain Name"
                                type="text"
                                value={captainName}
                                onChange={setCaptainName}
                            />

                            <Input
                                label="Role"
                                type="text"
                                className="text-gray-600 cursor-not-allowed"
                                disabled
                                value={role}
                            />


                            <div className="flex flex-col gap-1">
                                <label className="text-xs text-gray-600 font-medium">Description</label>
                                <textarea
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    placeholder="Short description (optional)"
                                    rows={3}
                                    className="w-full rounded border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent resize-none transition"
                                />
                            </div>

                            {/* Connectors: Scrollable List mit Checkboxen */}
                            <div>
                                <label className="text-xs text-gray-500">Connectors</label>
                                <div className="max-h-40 overflow-y-auto flex flex-col gap-2 pr-1">
                                    {CONNECTORS.map((connector) => {
                                        // Dynamisch die Email aus dem State holen
                                        let connectorEmail = ""
                                        let isConnected = false
                                        if (connector.id === "jira") {
                                            connectorEmail = jiraEmail || "Not connected"
                                            isConnected = !!jiraEmail
                                        }
                                        if (connector.id === "slack") {
                                            connectorEmail = slackEmail || "Not connected"
                                            isConnected = !!slackEmail
                                        }

                                        const isChecked = selectedConnectors.includes(connector.id)
                                        const selectable = connector.selectable
                                        const opts = optionsByConnector[connector.id] || []
                                        const isLoadingOpts = !!loadingOptions[connector.id]
                                        const loadErr = optionsError[connector.id]
                                        const selId = selectedOptionByConnector[connector.id] || null

                                        return (
                                            <div key={connector.id} className="flex flex-col gap-2">
                                                {/* Hauptzeile */}
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="checkbox"
                                                        checked={isChecked}
                                                        onChange={() => handleToggleConnector(connector.id)}
                                                        disabled={!isConnected}
                                                        className={`w-4 h-4 accent-accent ${isConnected ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}
                                                    />
                                                    <ConnectorCard
                                                        logoSrc={connector.logoSrc}
                                                        title={connector.title}
                                                        email={connectorEmail}
                                                        onConfigure={connector.onConfigure}
                                                    />
                                                </div>

                                                {/* Unterliste: nur wenn ausgewählt + verbunden + selectable */}
                                                {isChecked && isConnected && selectable && (
                                                    <div className="ml-8 mb-2">
                                                        {isLoadingOpts ? (
                                                            <p className="text-xs text-gray-500">Loading…</p>
                                                        ) : loadErr ? (
                                                            <p className="text-xs text-red-500">{loadErr}</p>
                                                        ) : opts.length === 0 ? (
                                                            <p className="text-xs text-gray-400">No items available.</p>
                                                        ) : (
                                                            <div className="flex flex-col gap-1">
                                                                {opts.map((opt) => {
                                                                    const checked = selId === opt.id
                                                                    return (
                                                                        <label key={opt.id} className="flex items-center gap-2 text-sm">
                                                                            <input
                                                                                type="radio"
                                                                                name={`opt-${connector.id}`}
                                                                                checked={checked}
                                                                                onChange={() => selectSingleOption(connector.id, opt.id)}
                                                                                className="w-4 h-4 accent-accent"
                                                                            />
                                                                            {opt.iconUrl && (
                                                                                <img src={opt.iconUrl} className="w-4 h-4 rounded" alt="" />
                                                                            )}
                                                                            <span className="font-medium">{opt.label}</span>
                                                                            {opt.subtitle && (
                                                                                <span className="text-gray-500 ml-1">({opt.subtitle})</span>
                                                                            )}
                                                                        </label>
                                                                    )
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>

                            <div className="flex justify-end gap-2">
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="px-4 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleCreateCaptain}
                                    disabled={isLoading}
                                    className="px-4 py-1 rounded bg-accent hover:brightness-90 text-white text-sm shadow cursor-pointer"
                                >
                                    {isLoading ? (
                                        <Trio size="20" speed="1.3" color="white" />
                                    ) : (
                                        <p>Create</p>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    )
}
