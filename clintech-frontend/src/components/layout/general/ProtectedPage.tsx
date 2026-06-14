'use client'
import { useAuth } from '@/context/AuthContext';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react'
import Loader from '@/components/ui/Loader';

export default function ProtectedPage({
    allowedRoles = [],
    children
}: {
    allowedRoles?: string[],
    children: React.ReactNode
}) {
    const { role, isLoggedIn, hydrated, loading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
const normalizedRole = String(role || '').trim().toLowerCase();
const normalizedAllowed = allowedRoles.map(r => String(r).trim().toLowerCase());
    if (pathname === '/404' || pathname.includes('not-found')) {
        return <>{children}</>;
    }
    
    useEffect(() => {
        if (!hydrated) {
            return;
        }
        
        if (loading) {
            return;
        }
        
        if (!isLoggedIn) {
            router.replace('/login');
        } else if (allowedRoles.length && !normalizedAllowed.includes(normalizedRole)) {
  console.log('❌ NOT AUTHORIZED redirect', {
    pathname,
    role,
    normalizedRole,
    allowedRoles,
    normalizedAllowed,
  });
  router.replace('/not-authorized');
}
    }, [role, isLoggedIn, router, allowedRoles, hydrated, loading, pathname]);

    if (!hydrated || loading) {
        return <Loader />;
    }

    if (!isLoggedIn) {
        return null;
    }

    if (allowedRoles.length && !normalizedAllowed.includes(normalizedRole)) {
  return null;
}

    return <>{children}</>;
}