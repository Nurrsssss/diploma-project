import { getTokenFromCookies, createUnauthorizedResponse } from '@/utils/auth';

export async function GET(req: Request) {
    try {
        // ✅ Получаем токен из HttpOnly cookie
        const token = getTokenFromCookies(req);
        if (!token) {
            return createUnauthorizedResponse('Требуется авторизация');
        }

        if (!process.env.CALENDAR_SERVICE) {
            return new Response(JSON.stringify({ error: 'CALENDAR_SERVICE не настроен' }), { status: 500 })
        }

        // Получаем параметры запроса для фильтрации
        const url = new URL(req.url);
        const date = url.searchParams.get('date');
        const startTime = url.searchParams.get('start_time');
        const endTime = url.searchParams.get('end_time');
        const status = url.searchParams.get('status');

        // Формируем URL для backend - backend определит роль пользователя из токена
        let backendUrl = `${process.env.CALENDAR_SERVICE}/appointments`;
        const queryParams = new URLSearchParams();
        
        if (date) {
            queryParams.append('date', date);
        }
        if (startTime) {
            queryParams.append('start_time', startTime);
        }
        if (endTime) {
            queryParams.append('end_time', endTime);
        }
        if (status) {
            queryParams.append('status', status);
        }
        
        if (queryParams.toString()) {
            backendUrl += `?${queryParams.toString()}`;
        }

        const backendRes = await fetch(backendUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        let data;
        try {
            data = await backendRes.json();
        } catch (parseError) {
            data = { error: 'Некорректный ответ от сервера календаря' };
        }

        return new Response(JSON.stringify(data), {
            status: backendRes.status,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message || 'Ошибка сервера' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}    