import { NextRequest } from 'next/server';
import { getTokenFromCookies, createUnauthorizedResponse } from '@/utils/auth';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string, fileId: string }> }) {
    try {
        const { id, fileId } = await params;
        const token = getTokenFromCookies(req);
        if (!token) return createUnauthorizedResponse('Требуется авторизация');
        if (!process.env.FILE_SERVICE) {
            return new Response(JSON.stringify({ error: 'FILE_SERVICE не настроен' }), { status: 500 });
        }
        const backendUrl = `${process.env.GATEWAY}/appointments/${id}/files/${fileId}`;
        const backendRes = await fetch(backendUrl, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        }); 
        const responseText = await backendRes.text();
        let data;
        try {
            data = JSON.parse(responseText);
        } catch {
            data = { error: 'Некорректный ответ от файлового сервиса' };
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