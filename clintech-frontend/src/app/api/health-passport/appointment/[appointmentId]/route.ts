import { NextRequest } from 'next/server';
import { getTokenFromCookies, createUnauthorizedResponse } from '@/utils/auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ appointmentId: string }> }) {
    try {
        const { appointmentId } = await params;
        const token = getTokenFromCookies(req);
        
        if (!token) {
            return createUnauthorizedResponse('Требуется авторизация');
        }

        if (!process.env.ANKETA_SERVICE) {
            return new Response(JSON.stringify({ error: 'ANKETA_SERVICE не настроен' }), { status: 500 });
        }

        const backendUrl = `${process.env.ANKETA_SERVICE}/health-passport/appointment/${appointmentId}`;

        const backendRes = await fetch(backendUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        if (backendRes.status === 404) {
            return new Response(JSON.stringify({ error: 'Паспорт здоровья не найден' }), { status: 404 });
        }

        const responseText = await backendRes.text();
        
        let data;
        try {
            data = JSON.parse(responseText);
        } catch {
            data = { error: 'Некорректный ответ от сервера' };
        }

        return new Response(JSON.stringify(data), {
            status: backendRes.status,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('GET /api/health-passport/appointment/[appointmentId] - Error:', error);
        return new Response(JSON.stringify({ 
            error: 'Ошибка сервера при получении паспорта здоровья',
            details: error instanceof Error ? error.message : 'Неизвестная ошибка'
        }), { status: 500 });
    }
} 