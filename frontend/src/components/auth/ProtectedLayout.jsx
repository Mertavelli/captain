'use client'
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import useAuth from '@/hooks/useAuth';

export default function ProtectedLayout({ children }) {
    const { user, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && !user) {
            router.push('/');
        }
    }, [user, loading]);

    if (loading || !user) return null;

    return <>{children}</>;
}
