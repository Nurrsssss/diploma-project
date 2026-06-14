'use client'

import React from 'react'
import Link from 'next/link'
import { MdOutlinePerson } from 'react-icons/md'
import { FaSignOutAlt } from 'react-icons/fa'
import MyButton from '@/components/ui/MyButton'
import { IAuthSession } from '@/hooks/auth/useAuthSession'
import { useSidebar } from '@/hooks/auth/useSidebar'


export default function IsLoggedIn(
    { role, session }: { role: string, session: IAuthSession }
) {
    const { handleLogout } = useSidebar();

    return (
        <header className="hidden md:block border-b border-primary/10 bg-preDesign/95 py-5 shadow-soft backdrop-blur-sm">
            <nav className="container flex justify-between items-center">
                <div className="flex items-start gap-4">
                    <div
                        className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary p-2 shadow-soft transition hover:bg-primary/90">
                        <MdOutlinePerson className="text-4xl text-white" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold">
                            Добро пожаловать
                        </h1>
                        <p className="text-sm text-muted">Ваше путешествие к здоровью продолжается</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <MyButton className="bg-primary hover:bg-primary/90 py-2 px-4 text-white">
                        <Link href={`/`}>
                            {session?.email || 'Профиль'}
                        </Link>
                    </MyButton>
                    <MyButton
                        onClick={handleLogout}
                        className="flex items-center !shadow-none gap-2 py-2 px-4 text-gray-500 font-light hover:bg-gray-100"
                    >
                        <FaSignOutAlt />
                        Выйти
                    </MyButton>
                </div>
            </nav>
        </header>
    )
}
