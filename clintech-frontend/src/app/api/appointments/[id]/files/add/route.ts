import { NextRequest } from 'next/server';
import { getTokenFromCookies, createUnauthorizedResponse } from '@/utils/auth';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id: appointmentId } = await params;
        
        // Проверяем авторизацию
        const token = getTokenFromCookies(req);
        if (!token) {
            return createUnauthorizedResponse('Требуется авторизация');
        }

        if (!appointmentId) {
            return new Response(
                JSON.stringify({ error: 'ID записи обязателен' }), 
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Получаем данные из тела запроса
        const body = await req.json();
        
        console.log('POST /api/appointments/[id]/files/add - appointmentId:', appointmentId);
        console.log('POST /api/appointments/[id]/files/add - body:', body);

        // Отправляем запрос на бэкенд
        const gateway = process.env.GATEWAY || 'http://185.125.46.62:8800';
        const backendRes = await fetch(`${gateway}/appointments/${appointmentId}/files/add`, {
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

        console.log('Backend response status:', backendRes.status);
        console.log('Backend response data:', data);

        return new Response(JSON.stringify(data), { 
            status: backendRes.status, 
            headers: { 'Content-Type': 'application/json' } 
        });

    } catch (e: any) {
        console.error('Ошибка при привязке файлов к приему:', e);
        return new Response(
            JSON.stringify({ error: e.message || 'Ошибка сервера при привязке файлов к приему' }), 
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}
