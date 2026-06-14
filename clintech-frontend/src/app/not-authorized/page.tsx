'use client'
import Link from 'next/link'
import MyButton from '@/components/ui/MyButton'
import { useAuth } from '@/context/AuthContext'

export default function NotAuthorized() {
    const { role, logout } = useAuth()

    return (
        <div className="min-h-screen bg-lightBg flex items-center justify-center px-4">
            <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
                <div className="mb-6">
                    <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">
                        Доступ запрещен
                    </h1>
                    <p className="text-gray-600">
                        У вас нет прав для доступа к этой странице
                    </p>
                    {role && (
                        <p className="text-sm text-gray-500 mt-2">
                            Ваша роль: <span className="font-medium">{role}</span>
                        </p>
                    )}
                </div>

                <div className="space-y-3">
                    <MyButton
                        className="w-full bg-primary hover:bg-primary/90 text-white"
                        onClick={() => window.history.back()}
                    >
                        Вернуться назад
                    </MyButton>

                    <Link href="/" className="block">
                        <MyButton className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700">
                            На главную
                        </MyButton>
                    </Link>

                    <MyButton
                        className="w-full bg-red-100 hover:bg-red-200 text-red-700"
                        onClick={logout}
                    >
                        Выйти из аккаунта
                    </MyButton>
                </div>
            </div>
        </div>
    )
} 