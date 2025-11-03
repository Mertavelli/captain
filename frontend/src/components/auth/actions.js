'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createClient } from '@/utils/supabase/server'

export async function login(formData) {
    const supabase = await createClient()

    const email = formData.get('email')
    const password = formData.get('password')

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
        redirect('/error')
    }

    revalidatePath('/pages/dashboard', 'layout')
    redirect('/pages/dashboard')
}

export async function signup(prevState, formData) {
    const supabase = await createClient()

    const email = formData.get('email')
    const password = formData.get('password')
    const firstName = formData.get('first_name')
    const lastName = formData.get('last_name')
    const displayName = `${firstName} ${lastName}`.trim()

    const { error, data } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: { display_name: displayName }
        }
    })

    if (error) {
        // statt redirect: Fehler zurückgeben
        return { error: error.message }
    }

    // wenn Supabase bestätigt, aber z. B. E-Mail-Verifizierung nötig ist
    if (!data.session) {
        return { success: false, message: 'Bitte bestätige deine E-Mail-Adresse.' }
    }

    // Erfolgsfall → redirect
    revalidatePath('/pages/dashboard', 'layout')
    redirect('/pages/dashboard')
}