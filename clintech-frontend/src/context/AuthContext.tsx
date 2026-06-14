'use client'
import React, { createContext, useContext, ReactNode } from 'react';
import { useAuth as useAuthHook } from '@/hooks/auth/useAuth';
import { ILoginCredentials, ILoginResult } from '@/hooks/auth/useLogin';
import { IAuthSession } from '@/hooks/auth/useAuthSession';

interface AuthContextType {
    // Состояние сессии
    session: IAuthSession;
    isLoggedIn: boolean;
    role: string | null;
    user_id: string | null;
    email: string | null;
    
    // Методы авторизации
    login: (credentials: ILoginCredentials) => Promise<ILoginResult>;
    logout: () => Promise<void>;
    validateSession: () => Promise<boolean>;
    
    // Состояние загрузки и ошибок
    loading: boolean;
    error: string | null;
    clearError: () => void;
    
    // Состояние инициализации (для SSR)
    hydrated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const auth = useAuthHook();

    return (
        <AuthContext.Provider value={auth}>
            {children}
        </AuthContext.Provider>
    );
}

// Основной хук для использования в компонентах
export function useAuthContext() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuthContext must be used within AuthProvider');
    }
    return context;
}

// Алиас для обратной совместимости со старым кодом
export const useAuth = useAuthContext; 