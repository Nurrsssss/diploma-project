import { getTokenFromCookies, createUnauthorizedResponse } from '@/utils/auth';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        // ✅ Получаем токен из HttpOnly cookie
        const token = getTokenFromCookies(req);
        if (!token) {
            return createUnauthorizedResponse('Требуется авторизация');
        }

        const { id } = await params;

        if (!id) {
            return new Response(JSON.stringify({ error: 'ID слота обязателен' }), { status: 400 })
        }

        if (!process.env.CALENDAR_SERVICE) {
            return new Response(JSON.stringify({ error: 'CALENDAR_SERVICE не настроен' }), { status: 500 })
        }

        // Читаем body запроса
        const body = await req.text();
        
        // Бронируем запись
        const backendUrl = `${process.env.CALENDAR_SERVICE}/appointments/${id}/book`;

        const backendRes = await fetch(backendUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body
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