'use client';

import { createContext, useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { setCookie, deleteCookie } from 'cookies-next';

const client = createClient(); // <- wichtig!

const AuthContext = createContext(null);

const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Session bei Initialisierung holen
        client.auth.getSession().then(({ data }) => {
            const token = data?.session?.access_token || null;

            if (token) setCookie('session', token);
            else deleteCookie('session');

            setUser(data?.session?.user || null);
            setLoading(false);
        });

        // Auth-Änderungen beobachten
        const { data: listener } = client.auth.onAuthStateChange((event, session) => {
            const token = session?.access_token || null;

            if (token) setCookie('session', token);
            else deleteCookie('session');

            setUser(session?.user || null);
        });

        return () => {
            listener.subscription.unsubscribe();
        };
    }, []);

    return (
        <AuthContext.Provider value={{ user, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export { AuthContext, AuthProvider };
