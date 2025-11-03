"use client";
import { useState, useEffect } from "react";
import SearchFilter from "@/components/SearchFilter";
import SortByDropdown from "@/components/SortByDropdown";
import Avatar from "./sidebar/Avatar";
import CaptainsLog from "./CaptainsLog";
import { createClient } from "@/utils/supabase/client";
import { colorFromString } from "@/helpers/helpers";
import { AvatarCircles } from "./magicui/avatar-circles";
import Link from "next/link";

export default function CaptainsGrid() {
    const [sortBy, setSortBy] = useState("dateCreated");
    const [captains, setCaptains] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showAll, setShowAll] = useState(false);
    const [searchText, setSearchText] = useState("");
    const [userDisplayName, setUserDisplayName] = useState("");
    const supabase = createClient();

    useEffect(() => {
        const fetchCaptains = async () => {
            setLoading(true);
            const { data: captainsData, error: captainsError } = await supabase
                .from("captains")
                .select("*")
                .order("created_at", { ascending: false });

            if (captainsError) {
                setError(captainsError.message);
                setLoading(false);
                return;
            }
            setCaptains(captainsData);
            setLoading(false);
        };

        fetchCaptains();

        // ---- Supabase Realtime Subscription ----
        const channel = supabase
            .channel('captains-changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'captains' },
                payload => {
                    // Du kannst hier direkt neu fetchen oder smarter updaten!
                    fetchCaptains();
                }
            )
            .subscribe();

        // Cleanup beim Unmount!
        return () => {
            channel.unsubscribe();
        };
        // eslint-disable-next-line
    }, []);


    // Display Name des eingeloggten Users laden
    useEffect(() => {
        const fetchUserName = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            const displayName = session?.user?.user_metadata?.display_name
                || session?.user?.user_metadata?.full_name
                || session?.user?.email?.split("@")[0]
                || "";
            setUserDisplayName(displayName);
        };
        fetchUserName();
    }, []);

    // Helper für Sortierung und Suche
    function getSortedCaptains() {
        let filtered = captains;
        if (searchText.trim()) {
            filtered = filtered.filter(c =>
                (c.name ?? "").toLowerCase().includes(searchText.trim().toLowerCase())
            );
        }
        if (sortBy === "alphabetical") {
            return [...filtered].sort((a, b) =>
                (a.name ?? "").localeCompare(b.name ?? "", "de", { sensitivity: "base" })
            );
        }
        return [...filtered].sort(
            (a, b) => new Date(b.created_at) - new Date(a.created_at)
        );
    }

    const sortedCaptains = getSortedCaptains();
    const captainsToShow = showAll ? sortedCaptains : sortedCaptains.slice(0, 8);


    return (
        <div className="widget flex flex-col gap-4">
            {/* Header */}
            <div className="flex flex-col gap-4">
                <h1 className="heading">Your Captains</h1>
                <div className="flex items-center justify-between">
                    <div className="flex items-center max-w-sm gap-2">
                        <SearchFilter
                            placeholder="Search captains..."
                            value={searchText}
                            onChange={setSearchText}
                        />
                        <SortByDropdown
                            value={sortBy}
                            onChange={setSortBy}
                        />
                    </div>
                    {/* View All Button */}
                    {captains.length > 8 && !showAll && (
                        <button
                            className="font-semibold cursor-pointer text-xs ml-auto px-3 py-1 rounded hover:bg-accent/20 text-gray-600 transition-all"
                            onClick={() => setShowAll(true)}
                        >
                            View All
                        </button>
                    )}
                    {captains.length > 8 && showAll && (
                        <button
                            className="font-semibold cursor-pointer text-xs ml-auto px-3 py-1 rounded hover:bg-accent/20 text-gray-600 transition-all"
                            onClick={() => setShowAll(false)}
                        >
                            Show Less
                        </button>
                    )}
                </div>
            </div>

            {captainsToShow.length === 0 ? (
                <p className="text-gray-500 text-sm text-center">You have no captains yet.</p>
            ) : (
                <div className="grid grid-cols-4 gap-4">
                    {captainsToShow.map((captain) => {
                        // AvatarCircles vorbereiten – pro Tool ein Image
                        const toolAvatars = (captain.connections || []).map(conn => ({
                            imageUrl: `/logos/${conn}.png`,
                        }));

                        return (
                            <Link href={`/captains/${captain.id}`} key={captain.id} className="flex flex-col gap-2">
                                <div
                                    className="w-full h-[9rem] rounded-md bg-border border border-border relative overflow-hidden flex items-center justify-center cursor-pointer"
                                >
                                    <img src={"/agent-avatar.png"} className="w-55 mt-5" />
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Avatar name={userDisplayName} />
                                        <div>
                                            <p className="font-medium text-xs">{captain.name}</p>
                                            <p className="text-gray-500 text-[0.7rem]">
                                                {captain.role}
                                            </p>
                                            <p className="text-gray-400 text-[0.7rem] truncate max-w-[160px]">
                                                {captain.description}
                                            </p>
                                        </div>
                                    </div>
                                    {/* AvatarCircles für verbundene Tools */}
                                    <AvatarCircles people={toolAvatars} numPeople={toolAvatars.length} />
                                </div>
                            </Link>
                        );
                    })}
                </div>
            )}

            <div className="mt-8">
                <CaptainsLog />
            </div>
        </div>
    );
}
