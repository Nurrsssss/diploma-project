import { NextRequest } from 'next/server';
import { getTokenFromCookies, createUnauthorizedResponse } from '@/utils/auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const token = getTokenFromCookies(req);
        
        if (!token) {
            return createUnauthorizedResponse('Требуется авторизация');
        }

        if (!process.env.ANKETA_SERVICE) {
            return new Response(JSON.stringify({ error: 'ANKETA_SERVICE не настроен' }), { status: 500 });
        }

        const url = `${process.env.ANKETA_SERVICE}/health-passport/${id}/content`;

        const res = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
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
        console.error('GET /api/health-passport/[id]/content - Error:', error);
        return new Response(JSON.stringify({ 
            error: 'Ошибка сервера при получении содержимого паспорта здоровья',
            details: error instanceof Error ? error.message : 'Неизвестная ошибка'
        }), { status: 500 });
    }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const token = getTokenFromCookies(req);
        
        if (!token) {
            return createUnauthorizedResponse('Требуется авторизация');
        }

        if (!process.env.ANKETA_SERVICE) {
            return new Response(JSON.stringify({ error: 'ANKETA_SERVICE не настроен' }), { status: 500 });
        }

        const body = await req.json();
        const url = `${process.env.ANKETA_SERVICE}/health-passport/${id}/content`;

        const res = await fetch(url, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(body)
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
        console.error('PUT /api/health-passport/[id]/content - Error:', error);
        return new Response(JSON.stringify({ 
            error: 'Ошибка сервера при обновлении содержимого паспорта здоровья',
            details: error instanceof Error ? error.message : 'Неизвестная ошибка'
        }), { status: 500 });
    }
} 