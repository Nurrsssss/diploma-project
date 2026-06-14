import { NextRequest } from 'next/server';
import { getTokenFromCookies, createUnauthorizedResponse } from '@/utils/auth';

export async function GET(req: NextRequest) {
    try {
        const token = getTokenFromCookies(req);
        
        if (!token) {
            return createUnauthorizedResponse('Требуется авторизация');
        }

        if (!process.env.ANKETA_SERVICE) {
            return new Response(JSON.stringify({ error: 'ANKETA_SERVICE не настроен' }), { status: 500 });
        }

        const analysisUrl = `${process.env.ANKETA_SERVICE}/analysis/my`;

        const analysisRes = await fetch(analysisUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        const responseText = await analysisRes.text();
        let data;
        try {
            data = JSON.parse(responseText);
        } catch {
            data = { error: 'Некорректный ответ от сервера' };
        }

        if (!analysisRes.ok) {
            // Логируем ошибку для дебага
            console.error(`ANKETA_SERVICE error ${analysisRes.status}:`, data);
            
            return new Response(JSON.stringify(data), {
                status: analysisRes.status,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        return new Response(JSON.stringify(data), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('GET /api/analysis/my - Error:', error);
        return new Response(JSON.stringify({ 
            error: 'Ошибка сервера при получении анализов',
            details: error instanceof Error ? error.message : 'Неизвестная ошибка'
        }), { status: 500 });
    }
} 