'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import Section from './Section';
import ChannelsModal from './ChannelsModal';

export default function Sidebar() {
    const { captainId } = useParams();
    const supabase = createClient();

    // Fehler / Status
    const [errorMsg, setErrorMsg] = useState('');

    // Stakeholders
    const [projectMembers, setProjectMembers] = useState([]);
    const [pmLoading, setPmLoading] = useState(false);

    // Channels (am Captain gespeichert)
    const [projectChannels, setProjectChannels] = useState([]);    // z. B. ["C123","C456"]
    const [allSlackChannels, setAllSlackChannels] = useState([]);  // [{id,name}]
    const [channelsLoading, setChannelsLoading] = useState(false);

    // Modal-State
    const [isChannelsModalOpen, setIsChannelsModalOpen] = useState(false);
    const [activeChannels, setActiveChannels] = useState([]); // im Modal sichtbare Auswahl

    // 1) Captain → Channels laden
    useEffect(() => {
        if (!captainId) {
            setProjectChannels([]);
            return;
        }
        (async () => {
            try {
                const { data, error } = await supabase
                    .from('captains')
                    .select('channels')
                    .eq('id', captainId)
                    .single();

                if (error) throw error;
                const arr = Array.isArray(data?.channels) ? data.channels : [];
                setProjectChannels(arr);
            } catch (e) {
                console.error('Captain-Channels laden fehlgeschlagen:', e);
                setProjectChannels([]);
                setErrorMsg('Channels konnten nicht geladen werden.');
            }
        })();
    }, [captainId, supabase]);

    // 2) Stakeholders (über captain_id)
    useEffect(() => {
        if (!captainId) {
            setProjectMembers([]);
            return;
        }
        (async () => {
            try {
                setPmLoading(true);
                const { data, error } = await supabase
                    .from('project_members')
                    .select('id, role, is_stakeholder, person:people(*)')
                    .eq('captain_id', captainId);

                if (error) throw error;
                setProjectMembers(Array.isArray(data) ? data : []);
            } catch (e) {
                console.error('Members laden fehlgeschlagen:', e);
                setProjectMembers([]);
                setErrorMsg('Stakeholders konnten nicht geladen werden.');
            } finally {
                setPmLoading(false);
            }
        })();
    }, [captainId, supabase]);

    // 3) Alle Slack-Channels (für Namensauflösung)
    useEffect(() => {
        (async () => {
            try {
                setChannelsLoading(true);
                const { data: { session } } = await supabase.auth.getSession();
                const jwt = session?.access_token;
                if (!jwt) throw new Error('no session');

                const resp = await fetch(
                    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/getSlackChannels`,
                    { headers: { Authorization: `Bearer ${jwt}` } }
                );
                let json = {};
                try { json = await resp.json(); } catch { json = {}; }

                const channels = Array.isArray(json?.channels)
                    ? json.channels.map((c) => ({ id: c.id, name: c.name }))
                    : [];
                setAllSlackChannels(channels);
            } catch (e) {
                console.error('Slack-Channels laden fehlgeschlagen:', e);
                setAllSlackChannels([]);
            } finally {
                setChannelsLoading(false);
            }
        })();
    }, [supabase]);

    // --- Ableitungen ---
    const stakeholders = projectMembers
        .filter((m) => m.is_stakeholder)
        .map((m) => ({
            id: m.id,
            name:
                `${m.person?.first_name ?? ''} ${m.person?.last_name ?? ''}`.trim() ||
                m.person?.email ||
                'Unbekannt',
            key: m.role || m.person?.email || '',
        }));

    const displayedChannels = projectChannels
        .map((id) => allSlackChannels.find((c) => c.id === id))
        .filter(Boolean)
        .map((c) => ({ id: c.id, name: c.name, key: c.id }));

    // --- Modal-Steuerung ---
    const handleOpenChannelsModal = () => {
        setActiveChannels(projectChannels); // aktuelle Auswahl übernehmen
        setIsChannelsModalOpen(true);
    };

    // Persistiert Channels sofort bei jeder Änderung (optimistic)
    const persistChannels = async (nextIds) => {
        try {
            const clean = Array.from(new Set((nextIds || []).filter(Boolean)));
            const { error } = await supabase
                .from('captains')
                .update({ channels: clean })
                .eq('id', captainId);
            if (error) throw error;
        } catch (e) {
            console.error('Konnte Channels nicht speichern:', e);
            setErrorMsg('Konnte Channels nicht speichern.');
        }
    };

    // Wrapper, den wir an das Modal geben: identische API wie React-Setter,
    // speichert aber *sofort* in DB und spiegelt in projectChannels wider.
    const setActiveChannelsAndSave = (updater) => {
        setActiveChannels((prev) => {
            const next = typeof updater === 'function' ? updater(prev) : updater;
            const clean = Array.from(new Set((next || []).filter(Boolean)));
            // UI sofort aktualisieren
            setProjectChannels(clean);
            // DB persistieren (ohne await, Fehler werden geloggt)
            persistChannels(clean);
            return clean;
        });
    };

    // Accept schließt nur das Modal (alles ist bereits gespeichert)
    const handleAcceptChannels = () => setIsChannelsModalOpen(false);

    return (
        <div className="bg-white w-full h-full flex flex-col p-4">
            <div className="mb-4 text-sm text-red-500">{errorMsg}</div>

            <div className="flex-1 overflow-y-auto relative space-y-6">
                {/* Stakeholders */} {/* Auskommentieren ging nicht anders */}
                {false && (
                    <div>
                        <Section
                            title="Stakeholders"
                            list={stakeholders}
                            handleClick={() => { /* no-op */ }}
                            onAdd={() => { /* no-op */ }}
                        />
                        {pmLoading && <div className="text-xs text-gray-400 mt-2">Loading…</div>}
                        {!captainId && (
                            <div className="text-xs text-gray-400 mt-2">
                                Kein Captain im Kontext.
                            </div>
                        )}
                    </div>
                )}


                {/* Channels */}
                <div>
                    <Section
                        title="Channels"
                        list={displayedChannels}
                        handleClick={() => { /* no-op */ }}
                        onAdd={handleOpenChannelsModal}
                    />
                    {(channelsLoading || !captainId) && (
                        <div className="text-xs text-gray-400 mt-2">
                            {channelsLoading ? 'Loading…' : 'Kein Captain ausgewählt.'}
                        </div>
                    )}
                </div>
            </div>

            {/* Channels Modal */}
            <ChannelsModal
                open={isChannelsModalOpen}
                channels={allSlackChannels}              // [{id,name}]
                activeChannels={activeChannels}          // ["C123", ...]
                setActiveChannels={setActiveChannelsAndSave} // <<— speichert sofort
                onClose={() => setIsChannelsModalOpen(false)}
                onSubmit={handleAcceptChannels}          // schließt nur
                slackConnected={Boolean(allSlackChannels?.length)}
            />
        </div>
    );
}
