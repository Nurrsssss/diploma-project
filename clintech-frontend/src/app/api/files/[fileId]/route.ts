import { NextRequest } from 'next/server';
import { getTokenFromCookies, createUnauthorizedResponse } from '@/utils/auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ fileId: string }> }) {
    try {
        const { fileId } = await params;
        const token = getTokenFromCookies(req);
        
        if (!token) {
            return createUnauthorizedResponse('Требуется авторизация');
        }

        if (!process.env.GATEWAY) {
            return new Response(JSON.stringify({ error: 'GATEWAY не настроен' }), { status: 500 });
        }

        // Используем правильный путь для получения информации о файле
        const backendUrl = `${process.env.GATEWAY}/files/${fileId}`;

        const backendRes = await fetch(backendUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        if (backendRes.status === 404) {
            return new Response(JSON.stringify({ error: 'Файл не найден' }), { status: 404 });
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
        console.error('GET /api/files/[fileId] - Error:', error);
        return new Response(JSON.stringify({ 
            error: 'Ошибка сервера при получении файла',
            details: error instanceof Error ? error.message : 'Неизвестная ошибка'
        }), { status: 500 });
    }
}