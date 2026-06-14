/*
Предпросмотр файла (для изображений и документов)
GET /files/{id}/preview
Файл отображается в браузере вместо скачивания
*/

import { NextRequest } from 'next/server';
import { getTokenFromCookies, createUnauthorizedResponse } from '@/utils/auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ fileId: string }> }) {
    try {
        const { fileId } = await params;
        
        // Получаем токен из cookies
        const token = getTokenFromCookies(req);
        if (!token) {
            return createUnauthorizedResponse('Требуется авторизация');
        }

        if (!fileId) {
            return new Response(JSON.stringify({ error: 'ID файла обязателен' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Отправляем запрос на backend через GATEWAY
        const gateway = process.env.GATEWAY || 'http://185.125.46.62:8800';

        // 1) Получаем метаданные файла, чтобы корректно определить Content-Type и имя
        let metaContentType: string | null = null;
        let originalName: string | null = null;
        try {
            const metaRes = await fetch(`${gateway}/files/${fileId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            if (metaRes.ok) {
                const meta = await metaRes.json();
                metaContentType = meta?.content_type || meta?.mime_type || null;
                originalName = meta?.original_name || meta?.name || null;
            }
        } catch {
            // Метаданные недоступны — не критично
        }

        // 2) Пытаемся получить поток предпросмотра; если недоступно — используем download
        const tryUrls = [
            `${gateway}/files/${fileId}/preview`,
            `${gateway}/files/${fileId}/download`
        ];
        let dataRes: Response | null = null;
        for (const url of tryUrls) {
            const r = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
            if (r.ok) {
                dataRes = r;
                break;
            }
        }

        if (!dataRes) {
            return new Response(JSON.stringify({ error: 'Не удалось получить файл для предпросмотра' }), {
                status: 502,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // 3) Определяем корректный Content-Type
        let contentType = metaContentType || dataRes.headers.get('content-type') || '';
        if (!contentType || contentType === 'application/octet-stream') {
            // Пытаемся угадать по имени файла
            const name = (originalName || '').toLowerCase();
            if (name.endsWith('.pdf')) contentType = 'application/pdf';
            else if (name.endsWith('.png')) contentType = 'image/png';
            else if (name.endsWith('.jpg') || name.endsWith('.jpeg')) contentType = 'image/jpeg';
            else if (name.endsWith('.gif')) contentType = 'image/gif';
            else if (name.endsWith('.webp')) contentType = 'image/webp';
            else if (name.endsWith('.svg')) contentType = 'image/svg+xml';
            else if (name.endsWith('.txt')) contentType = 'text/plain; charset=utf-8';
            else contentType = 'application/pdf';
        }

        const contentLength = dataRes.headers.get('content-length');
        const fileData = await dataRes.arrayBuffer();

        // Heuristic: if content looks like HTML, force text/html for inline rendering
        try {
            const sniffLen = Math.min(fileData.byteLength, 2048);
            const head = new Uint8Array(fileData.slice(0, sniffLen));
            const text = new TextDecoder('utf-8').decode(head);
            const looksHtml = text.trimStart().startsWith('<') && /<html|<head|<meta|<table|<div|<!DOCTYPE/i.test(text);
            if (looksHtml) {
                contentType = 'text/html; charset=utf-8';
            }
        } catch {
            // ignore sniff errors
        }

        const headers = new Headers({
            'Content-Type': contentType,
            'Content-Disposition': `inline${originalName ? `; filename="${encodeURIComponent(originalName)}"` : ''}`,
            'Cache-Control': 'public, max-age=3600',
        });
        if (contentLength) headers.set('Content-Length', contentLength);

        return new Response(fileData, { status: 200, headers });
    } catch (e: any) {
        console.error('Ошибка при предпросмотре файла:', e);
        return new Response(JSON.stringify({ 
            error: e.message || 'Ошибка сервера при предпросмотре файла' 
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
