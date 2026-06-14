import { getTokenFromCookies, createUnauthorizedResponse } from '@/utils/auth';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const resolvedParams = await params;
        const token = getTokenFromCookies(req);
        if (!token) {
            return createUnauthorizedResponse();
        }

        const backendRes = await fetch(`${process.env.CALENDAR_SERVICE}/appointments/schedules/${resolvedParams.id}/toggle`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!backendRes.ok) {
            const errorText = await backendRes.text();
            return new Response(JSON.stringify({ 
                error: `Backend error: ${backendRes.status} - ${errorText}` 
            }), {
                status: backendRes.status,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const data = await backendRes.json();
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