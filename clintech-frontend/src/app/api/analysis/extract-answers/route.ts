import { NextRequest } from 'next/server';
import { getTokenFromCookies, createUnauthorizedResponse } from '@/utils/auth';

export async function POST(req: NextRequest) {
    try {
        const token = getTokenFromCookies(req);
        
        if (!token) {
            return createUnauthorizedResponse('Требуется авторизация');
        }

        if (!process.env.ANKETA_SERVICE) {
            return new Response(JSON.stringify({ error: 'ANKETA_SERVICE не настроен' }), { status: 500 });
        }

        const body = await req.json();
        const { dialogue, lang } = body;

        if (!dialogue) {
            return new Response(JSON.stringify({ 
                error: 'Missing required field: dialogue' 
            }), { status: 400 });
        }

        const url = `${process.env.ANKETA_SERVICE}/analysis/extract-answers`;

        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                dialogue,
                lang: lang || 'ru'
            })
        });

        const responseText = await res.text();
        let data;
        try {
            data = JSON.parse(responseText);
        } catch {
            data = { error: 'Некорректный ответ от сервера' };
        }

        return new Response(JSON.stringify(data), {
            status: res.status,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('POST /api/analysis/extract-answers - Error:', error);
        return new Response(JSON.stringify({ 
            error: 'Ошибка сервера при извлечении ответов из транскрипции',
            details: error instanceof Error ? error.message : 'Неизвестная ошибка'
        }), { status: 500 });
    }
}
