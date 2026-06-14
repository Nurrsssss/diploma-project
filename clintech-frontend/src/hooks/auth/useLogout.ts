import { useState, useCallback } from 'react';

interface IUseLogoutReturn {
    logout: () => Promise<boolean>;
    loading: boolean;
    error: string | null;
}

export const useLogout = (): IUseLogoutReturn => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const logout = useCallback(async (): Promise<boolean> => {
        try {
            setLoading(true);
            setError(null);

            const response = await fetch('/api/auth/logout', {
                method: 'POST',
                credentials: 'include', // Включаем cookies для удаления
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (response.ok) {
                // Токен удален на сервере и из HttpOnly cookie
                return true;
            } else {
                setError('Ошибка при выходе из системы');
                return false;
            }
        } catch (err) {
            setError('Ошибка соединения при выходе');
            return false;
        } finally {
            setLoading(false);
        }
    }, []);

    return {
        logout,
        loading,
        error,
    };
}; 