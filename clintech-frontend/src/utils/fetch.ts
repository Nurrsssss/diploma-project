export async function fetchWithAuth(
    input: RequestInfo,
    init?: RequestInit
): Promise<Response> {
    // ✅ С HttpOnly cookies токен автоматически отправляется браузером
    // Нам не нужно вручную добавлять Authorization заголовок
    
    const headers = {
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
    };

    return fetch(input, {
        ...init,
        headers,
        credentials: 'include', // ✅ Важно! Включаем cookies в запросы
    });
}
