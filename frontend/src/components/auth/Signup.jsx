'use client'

import { useActionState } from 'react'
import { signup } from './actions'

const Signup = () => {
    const [state, formAction] = useActionState(signup, { error: null })

    return (
        <form action={formAction} className="space-y-4">
            {/* Vorname */}
            <div>
                <label htmlFor="first_name" className="block text-sm font-medium mb-1">
                    First name
                </label>
                <input
                    type="text"
                    id="first_name"
                    name="first_name"
                    required
                    className="w-full px-3 py-2 border rounded-md"
                />
            </div>

            {/* Nachname */}
            <div>
                <label htmlFor="last_name" className="block text-sm font-medium mb-1">
                    Last name
                </label>
                <input
                    type="text"
                    id="last_name"
                    name="last_name"
                    required
                    className="w-full px-3 py-2 border rounded-md"
                />
            </div>

            {/* E-Mail */}
            <div>
                <label htmlFor="email" className="block text-sm font-medium mb-1">
                    E-Mail
                </label>
                <input
                    type="email"
                    id="email"
                    name="email"
                    required
                    className="w-full px-3 py-2 border rounded-md"
                />
            </div>

            {/* Passwort + Fehlermeldung */}
            <div>
                <label htmlFor="password" className="block text-sm font-medium mb-1">
                    Passwort
                </label>
                <input
                    type="password"
                    id="password"
                    name="password"
                    required
                    className="w-full px-3 py-2 border rounded-md"
                />
                {state.error && (
                    <p className="mt-1 text-sm text-red-600">{state.error}</p>
                )}
            </div>

            <button
                type="submit"
                className="w-full bg-accent hover:bg-accent/90 text-white py-2 rounded-md"
            >
                Konto erstellen
            </button>
        </form>
    )
}

export default Signup
