import { getTokenFromCookies, createUnauthorizedResponse } from '@/utils/auth';

export async function GET(req: Request, { params }: { params: Promise<{ id: string; slotId: string }> }) {
    try {
        const resolvedParams = await params;
        const token = getTokenFromCookies(req);
        
        if (!token) {
            return createUnauthorizedResponse('Требуется авторизация');
        }

        if (!resolvedParams.id || !resolvedParams.slotId) {
            return new Response(JSON.stringify({ error: 'Schedule ID и Slot ID обязательны' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const backendRes = await fetch(`${process.env.CALENDAR_SERVICE}/appointments/schedules/${resolvedParams.id}/slots/${resolvedParams.slotId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        let data;
        try {
            data = await backendRes.json();
        } catch {
            data = { error: 'Некорректный ответ от сервера' };
        }

        return new Response(JSON.stringify(data), {
            status: backendRes.status,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message || 'Ошибка сервера при получении слота' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string; slotId: string }> }) {
    try {
        const resolvedParams = await params;
        const token = getTokenFromCookies(req);
        
        if (!token) {
            return createUnauthorizedResponse('Требуется авторизация');
        }

        if (!resolvedParams.id || !resolvedParams.slotId) {
            return new Response(JSON.stringify({ error: 'Schedule ID и Slot ID обязательны' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const body = await req.json();

        const backendRes = await fetch(`${process.env.CALENDAR_SERVICE}/appointments/schedules/${resolvedParams.id}/slots/${resolvedParams.slotId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        let data;
        try {
            data = await backendRes.json();
        } catch {
            data = { error: 'Некорректный ответ от сервера' };
        }

        return new Response(JSON.stringify(data), {
            status: backendRes.status,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message || 'Ошибка сервера при обновлении слота' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string; slotId: string }> }) {
    try {
        const resolvedParams = await params;
        const token = getTokenFromCookies(req);
        
        if (!token) {
            return createUnauthorizedResponse('Требуется авторизация');
        }

        if (!resolvedParams.id || !resolvedParams.slotId) {
            return new Response(JSON.stringify({ error: 'Schedule ID и Slot ID обязательны' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const backendRes = await fetch(`${process.env.CALENDAR_SERVICE}/appointments/schedules/${resolvedParams.id}/slots/${resolvedParams.slotId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        let data;
        try {
            data = await backendRes.json();
        } catch {
            data = { error: 'Некорректный ответ от сервера' };
        }

        return new Response(JSON.stringify(data), {
            status: backendRes.status,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message || 'Ошибка сервера при удалении слота' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
} 