import { useState, useCallback } from 'react';

export interface IAuthSession {
    isLoggedIn: boolean;
    role: string | null;
    user_id: string | null;
    email: string | null;
}

interface IUseAuthSessionReturn {
    session: IAuthSession;
    loading: boolean;
    error: string | null;
    initialized: boolean;
    validateSession: () => Promise<boolean>;
    clearSession: () => void;
    clearError: () => void;
    setSession: (session: IAuthSession) => void;
}

export const useAuthSession = (): IUseAuthSessionReturn => {
    const [session, setSession] = useState<IAuthSession>({
        isLoggedIn: false,
        role: null,
        user_id: null,
        email: null,
    });
    const [loading, setLoading] = useState<boolean>(false);
    const [initialized, setInitialized] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    const clearSession = useCallback(() => {
        setSession({
            isLoggedIn: false,
            role: null,
            user_id: null,
            email: null,
        });
        setError(null);
        setInitialized(true); // Считаем что инициализация завершена даже при очистке
    }, []);

    const validateSession = useCallback(async (): Promise<boolean> => {
        try {
            setLoading(true);
            setError(null);

            // Шаг 1: Валидируем токен
            const validateResponse = await fetch('/api/auth/validate', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!validateResponse.ok) {
                clearSession();
                return false;
            }

            const validateData = await validateResponse.json();
            
            if (!validateData.user_id) {
                clearSession();
                return false;
            }

            // Используем данные напрямую из валидации
            if (validateData.user_id && validateData.role) {
                setSession({
                    isLoggedIn: true,
                    role: validateData.role,
                    user_id: validateData.user_id,
                    email: validateData.email || validateData.phone || '', // используем email или phone
                });
                return true;
            } else {
                clearSession();
                return false;
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Ошибка проверки сессии';
            setError(errorMessage);
            clearSession();
            return false;
        } finally {
            setLoading(false);
            setInitialized(true); // Инициализация завершена независимо от результата
        }
    }, [clearSession]);

    const setSessionPublic = useCallback((newSession: IAuthSession) => {
        setSession(newSession);
        setInitialized(true);
    }, []);

    return {
        session,
        loading,
        error,
        initialized,
        validateSession,
        clearSession,
        clearError,
        setSession: setSessionPublic,
    };
}; 