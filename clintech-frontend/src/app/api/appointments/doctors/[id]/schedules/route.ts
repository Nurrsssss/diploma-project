/*
    Получение расписаний врача по ID (для врачей/админов)
    Возвращает все расписания указанного врача.
*/

import { getTokenFromCookies, createUnauthorizedResponse } from '@/utils/auth';

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const token = getTokenFromCookies(req);
        
        if (!token) {
            return createUnauthorizedResponse();
        }

        const { id } = await params;

        const gateway = process.env.GATEWAY || 'http://185.125.46.62:8800';
        const backendRes = await fetch(`${gateway}/appointments/doctors/${id}/schedules`, {
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
