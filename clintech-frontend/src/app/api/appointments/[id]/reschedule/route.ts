/*
Перенос записи на новую дату/время
POST /appointments/{appointmentID}/reschedule
Только для врача
*/

import { NextRequest } from 'next/server';
import { getTokenFromCookies, createUnauthorizedResponse } from '@/utils/auth';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        
        // Получаем токен из cookies
        const token = getTokenFromCookies(req);
        if (!token) {
            return createUnauthorizedResponse('Требуется авторизация');
        }

        if (!id) {
            return new Response(JSON.stringify({ error: 'ID записи обязателен' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Получаем данные для переноса
        const body = await req.json();

        // Отправляем запрос на backend через GATEWAY
        const gateway = process.env.GATEWAY || 'http://185.125.46.62:8800';
        const backendRes = await fetch(`${gateway}/appointments/${id}/reschedule`, {
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
        return new Response(JSON.stringify({ 
            error: e.message || 'Ошибка сервера при переносе записи' 
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}