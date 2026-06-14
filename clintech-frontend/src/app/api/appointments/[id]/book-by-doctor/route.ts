/*
    Запись пациента врачом на прием
    Бронирование свободного слота для указанного пациента (врачом).
*/

import { getTokenFromCookies, createUnauthorizedResponse } from '@/utils/auth';

export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const token = getTokenFromCookies(req);
        
        if (!token) {
            return createUnauthorizedResponse('Требуется авторизация');
        }

        const { id } = await params;

        if (!id) {
            return new Response(JSON.stringify({ error: 'ID слота обязателен' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const body = await req.text();

        const gateway = process.env.GATEWAY || 'http://185.125.46.62:8800';
        const backendUrl = `${gateway}/appointments/${id}/book-by-doctor`;

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
            data = { error: 'Некорректный ответ от сервера' };
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
