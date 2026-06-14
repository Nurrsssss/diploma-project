import { NextRequest } from 'next/server';
import { getTokenFromCookies, createUnauthorizedResponse } from '@/utils/auth';

interface Params {
    fileId: string;
}

export async function GET(req: NextRequest, { params }: { params: Promise<Params> }) {
    try {
        const resolvedParams = await params;
        const { fileId } = resolvedParams;

        // ✅ Используем HttpOnly cookies вместо Authorization header
        const token = getTokenFromCookies(req);
        if (!token) {
            return createUnauthorizedResponse();
        }

        const backendUrl = `${process.env.FILE_SERVICE}/files/${fileId}/download`;

        const backendRes = await fetch(backendUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            },
        });

        if (!backendRes.ok) {
            const errorData = await backendRes.json().catch(() => null);
            return new Response(JSON.stringify({
                error: 'Файл не найден',
                details: errorData?.error || `HTTP ${backendRes.status}`
            }), {
                status: backendRes.status,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Передаем файл как есть
        const fileBuffer = await backendRes.arrayBuffer();
        const contentType = backendRes.headers.get('Content-Type') || 'application/octet-stream';
        const contentDisposition = backendRes.headers.get('Content-Disposition');

        const headers: Record<string, string> = {
            'Content-Type': contentType,
        };

        if (contentDisposition) {
            headers['Content-Disposition'] = contentDisposition;
        }

        return new Response(fileBuffer, {
            status: 200,
            headers
        });
    } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message || 'Ошибка сервера' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
} 