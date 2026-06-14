import { NextRequest } from 'next/server';
import { getTokenFromCookies, createUnauthorizedResponse } from '@/utils/auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ filename: string }> }) {
    const token = getTokenFromCookies(req);
    if (!token) return createUnauthorizedResponse();
    
    const { filename } = await params;
    
    if (!process.env.ANKETA_SERVICE) {
        return new Response(JSON.stringify({ error: 'ANKETA_SERVICE не настроен' }), { status: 500 });
    }
    
    try {
        const url = `${process.env.ANKETA_SERVICE}/uploads/${filename}`;
        
        const res = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!res.ok) {
            const errorText = await res.text();
            console.error('Backend error response:', errorText);
            return new Response(JSON.stringify({ error: 'Ошибка при скачивании файла', details: errorText }), { 
                status: res.status,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        const fileBuffer = await res.arrayBuffer();
        const contentType = res.headers.get('content-type') || 'application/pdf';
        
        return new Response(fileBuffer, {
            status: 200,
            headers: {
                'Content-Type': contentType,
                'Content-Disposition': 'attachment; filename="file.pdf"',
                'Cache-Control': 'no-cache'
            }
        });
    } catch (error) {
        console.error('File download error:', error);
        return new Response(JSON.stringify({ error: 'Ошибка сервера при скачивании файла' }), { status: 500 });
    }
} 