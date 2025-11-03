'use client'

import { useEffect, useState } from "react"
import { createClient } from "@/utils/supabase/client"
import Avatar from "./sidebar/Avatar"
import Link from "next/link"

export default function Navbar() {
    const supabase = createClient()
    const [user, setUser] = useState(null)

    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            setUser(user)
        }
        getUser()
    }, [])

    // Username: display_name > full_name > Email
    const userName = user?.user_metadata?.display_name
        || user?.user_metadata?.full_name
        || user?.email
        || ""

    // Nur das erste Wort (vor dem ersten Leerzeichen) anzeigen
    const firstName = userName.split(" ")[0]

    return (
        <div className="flex justify-center py-4 sticky top-0 z-50 bg-[#F9FAFB]">
            <div className="flex items-center justify-between text-xs font-medium w-full max-w-[90rem] px-6">
                <div className="flex items-center gap-6">
                    <Link href={"/pages/dashboard"}>
                        <img src="/logo-dark.png" className="w-25 mr-4" />
                    </Link>

                    {/*                     <Link href={"/pages/pricing"}>Pricing</Link>
                    <Link href={"/pages/learn"}>Learn</Link> */}
                </div>


                <div className="flex items-center gap-6">
                    {/* Avatar */}
                    <div className="flex items-center gap-2">
                        <Avatar name={userName} />
                        <p>{firstName}'s Captains</p>
                    </div>

                    <button
                        onClick={() => supabase.auth.signOut()}
                        className="text-xs text-white bg-black px-3 py-1.5 rounded-full hover:bg-gray-800 transition cursor-pointer"
                    >
                        Sign out
                    </button>
                </div>
            </div>
        </div>
    )
}
