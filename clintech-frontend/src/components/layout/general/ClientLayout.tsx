'use client'
import React, { useState } from 'react'
import { usePathname } from 'next/navigation';
import Header from '@/components/layout/header/Header';
import Loader from '../../ui/Loader';
import ChunkErrorHandler from '@/components/errors/ChunkErrorHandler';
import { ErrorBoundary } from '@/components/errors/ErrorBoundary';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
    const [loading, setLoading] = useState(false);

    const path = usePathname();

    if (loading) {
        return <Loader />;
    }

    return (
        <ErrorBoundary>
            <ChunkErrorHandler />
            <div className="flex flex-col min-h-screen">
                {path !== '/register' && path !== '/login' && <Header />}


                <main className="flex-1">

                    {children}
                </main>
            </div>
        </ErrorBoundary>
    )
}



