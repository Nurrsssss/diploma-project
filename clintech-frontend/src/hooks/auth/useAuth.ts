import { useEffect, useCallback } from 'react';
import { useAuthSession, IAuthSession } from './useAuthSession';
import { useLogin, ILoginCredentials, ILoginResult } from './useLogin';
import { useLogout } from './useLogout';

interface UseAuthReturn {
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
    
    // Состояние инициализации
    hydrated: boolean;
}

export const useAuth = (): UseAuthReturn => {
    const { 
        session, 
        loading: sessionLoading, 
        error: sessionError,
        initialized,
        validateSession, 
        clearSession,
        setSession,
        clearError: clearSessionError 
    } = useAuthSession();
    
    const { 
        login: performLogin, 
        loading: loginLoading, 
        error: loginError,
        clearError: clearLoginError 
    } = useLogin();
    
    const { 
        logout: performLogout, 
        loading: logoutLoading, 
        error: logoutError 
    } = useLogout();

    // Объединяем все ошибки
    const error = sessionError || loginError || logoutError;
    const loading = sessionLoading || loginLoading || logoutLoading;

    // Очистка всех ошибок
    const clearError = useCallback(() => {
        clearSessionError();
        clearLoginError();
    }, [clearSessionError, clearLoginError]);

    // Усиленный login с установкой сессии
    const login = useCallback(async (credentials: ILoginCredentials): Promise<ILoginResult> => {
        const result = await performLogin(credentials);
        
        if (result.success && result.role && result.user_id) {
            // После успешного логина устанавливаем сессию напрямую
            setSession({
                isLoggedIn: true,
                role: result.role,
                user_id: result.user_id,
                email: credentials.phone || '', // используем телефон как email для совместимости
            });
        }
        
        return result;
    }, [performLogin, setSession]);

    // Усиленный logout с очисткой сессии
    const logout = useCallback(async (): Promise<void> => {
        const success = await performLogout();
        // Очищаем локальную сессию независимо от результата
        clearSession();
    }, [performLogout, clearSession]);

    // Инициализация при загрузке приложения
    useEffect(() => {
        // Проверяем сессию при загрузке
        validateSession();
    }, [validateSession]);

    return {
        // Состояние сессии
        session,
        isLoggedIn: session.isLoggedIn,
        role: session.role,
        user_id: session.user_id,
        email: session.email,
        
        // Методы
        login,
        logout,
        validateSession,
        
        // Состояние
        loading,
        error,
        clearError,
        
        // Готовность (для SSR совместимости)
        hydrated: initialized,
    };
}; 