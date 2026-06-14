import { NextRequest } from 'next/server';
import { getTokenFromCookies, createUnauthorizedResponse } from '@/utils/auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string, fileId: string }> }) {
    try {
        const { id, fileId } = await params;
        const token = getTokenFromCookies(req);
        if (!token) return createUnauthorizedResponse('Требуется авторизация');
        if (!process.env.FILE_SERVICE) {
            return new Response(JSON.stringify({ error: 'FILE_SERVICE не настроен' }), { status: 500 });
        }
        const backendUrl = `${process.env.GATEWAY}/appointments/${id}/files/${fileId}/download`;
        const backendRes = await fetch(backendUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
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
