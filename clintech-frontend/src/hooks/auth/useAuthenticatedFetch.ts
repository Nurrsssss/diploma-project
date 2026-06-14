import { useCallback } from 'react';

export const useAuthenticatedFetch = () => {
    const authenticatedFetch = useCallback(async (
        input: RequestInfo | URL,
        init?: RequestInit
    ): Promise<Response> => {
        // ✅ Получаем токен из cookies (если доступен в браузере)
        let token: string | null = null;
        if (typeof document !== 'undefined') {
            // В браузере пытаемся получить токен из cookies
            const cookies = document.cookie.split(';');
            const authCookie = cookies.find(cookie => cookie.trim().startsWith('auth_token='));
            if (authCookie) {
                token = authCookie.split('=')[1];
            }
        }

        // ✅ Формируем заголовки
        const headers: Record<string, string> = {
            ...((init?.headers as Record<string, string>) || {}),
        };

        // ✅ Добавляем Authorization заголовок если есть токен
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        // ✅ Только добавляем Content-Type если он не передан и body не FormData
        if (!headers['Content-Type'] && !(init?.body instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
        }

        // ✅ Объединяем заголовки и включаем credentials
        const requestInit: RequestInit = {
            ...init,
            headers,
            credentials: 'include', // Важно! Включаем cookies
        };

        return fetch(input, requestInit);
    }, []);

    return authenticatedFetch;
}; 