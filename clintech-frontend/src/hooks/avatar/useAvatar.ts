import { useState, useCallback } from 'react';
import { useAuthSession } from '../auth/useAuthSession';

interface AvatarResponse {
    success?: boolean;
    error?: string;
    message?: string;
    avatar_url?: string;
}

export const useAvatar = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const uploadAvatar = useCallback(async (file: File): Promise<AvatarResponse> => {
        setLoading(true);
        setError(null);

        try {
            const formData = new FormData();
            formData.append('avatar', file);

            const response = await fetch(`/api/users/avatar`, {
                method: 'POST',
                credentials: 'include',
                body: formData,
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Ошибка загрузки аватарки');
            }

            return data;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Неизвестная ошибка';
            setError(errorMessage);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    const deleteAvatar = useCallback(async (): Promise<AvatarResponse> => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`/api/users/avatar`, {
                method: 'DELETE',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Ошибка удаления аватарки');
            }

            return data;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Неизвестная ошибка';
            setError(errorMessage);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    return {
        uploadAvatar,
        deleteAvatar,
        loading,
        error,
        clearError,
    };
}; 