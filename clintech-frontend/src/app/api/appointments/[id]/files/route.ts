import { NextRequest } from 'next/server';
import { getTokenFromCookies, createUnauthorizedResponse } from '@/utils/auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const token = getTokenFromCookies(req);
        if (!token) return createUnauthorizedResponse('Требуется авторизация');
        if (!process.env.FILE_SERVICE) {
            return new Response(JSON.stringify({ error: 'FILE_SERVICE не настроен' }), { status: 500 });
        }
        const backendUrl = `${process.env.GATEWAY}/appointments/${id}/files`;
        const backendRes = await fetch(backendUrl, {
            method: 'GET',
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

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const token = getTokenFromCookies(req);
        if (!token) return createUnauthorizedResponse('Требуется авторизация');
        if (!process.env.FILE_SERVICE) {
            return new Response(JSON.stringify({ error: 'FILE_SERVICE не настроен' }), { status: 500 });
        }
        const contentType = req.headers.get('content-type') || '';
        if (!contentType.includes('multipart/form-data')) {
            return new Response(JSON.stringify({ error: 'Неверный Content-Type' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        const formData = await req.formData();
        const file = formData.get('file') as File;
        const fileType = formData.get('type') as string; // Получаем тип файла
        
        if (!file) {
            return new Response(JSON.stringify({ error: 'Файл не найден' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        const proxyForm = new FormData();
        proxyForm.append('file', file, file.name);
        if (fileType) {
            proxyForm.append('type', fileType); // Передаем тип файла на бэкенд
        }
        const backendUrl = `${process.env.GATEWAY}/appointments/${id}/files`;
        const backendRes = await fetch(backendUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: proxyForm,
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