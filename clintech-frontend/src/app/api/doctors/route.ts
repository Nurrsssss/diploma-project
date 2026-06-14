/*
    Получение списка врачей
    Возвращает список врачей.
*/

import { getTokenFromCookies, createUnauthorizedResponse } from '@/utils/auth';

export async function GET(req: Request) {
    try {
        const token = getTokenFromCookies(req);
        
        if (!token) {
            return createUnauthorizedResponse();
        }

        const backendRes = await fetch(`${process.env.SPECIALIST_SERVICE}/api/doctors`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
        });

        let data;
        try {
            data = await backendRes.json();
        } catch {
            data = { error: 'Некорректный ответ от сервера авторизации' };
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

/*
    Создание нового врача
    Возвращает созданного врача.
*/

export async function POST(req: Request) {
    try {
        const token = getTokenFromCookies(req);
        
        if (!token) {
            return createUnauthorizedResponse();
        }

        // Получаем данные из тела запроса
        const body = await req.json();

        const backendRes = await fetch(`${process.env.SPECIALIST_SERVICE}/api/doctors`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(body)
        });

        let data;
        try {
            data = await backendRes.json();
        } catch {
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