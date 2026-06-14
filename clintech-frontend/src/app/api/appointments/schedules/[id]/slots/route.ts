import { getTokenFromCookies, createUnauthorizedResponse } from '@/utils/auth';

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const resolvedParams = await params;
        const token = getTokenFromCookies(req);
        
        if (!token) {
            return createUnauthorizedResponse('Требуется авторизация');
        }

        if (!resolvedParams.id) {
            return new Response(JSON.stringify({ error: 'Schedule ID обязателен' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // ✅ Используем CALENDAR_SERVICE для всех schedule endpoints
        const backendRes = await fetch(`${process.env.CALENDAR_SERVICE}/appointments/schedules/${resolvedParams.id}/slots`, {
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
        return new Response(JSON.stringify({ error: e.message || 'Ошибка сервера при удалении слотов расписания' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const resolvedParams = await params;
        const token = getTokenFromCookies(req);
        
        if (!token) {
            return createUnauthorizedResponse('Требуется авторизация');
        }

        if (!resolvedParams.id) {
            return new Response(JSON.stringify({ error: 'Schedule ID обязателен' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const { searchParams } = new URL(req.url);
        const date = searchParams.get('date');

        let url = `${process.env.CALENDAR_SERVICE}/appointments/schedules/${resolvedParams.id}/slots`;
        if (date) {
            url += `?date=${encodeURIComponent(date)}`;
        }

        const backendRes = await fetch(url, {
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
        return new Response(JSON.stringify({ error: e.message || 'Ошибка сервера при получении слотов расписания' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const resolvedParams = await params;
        const token = getTokenFromCookies(req);
        
        if (!token) {
            return createUnauthorizedResponse('Требуется авторизация');
        }

        if (!resolvedParams.id) {
            return new Response(JSON.stringify({ error: 'Schedule ID обязателен' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const body = await req.json();

        const backendRes = await fetch(`${process.env.CALENDAR_SERVICE}/appointments/schedules/${resolvedParams.id}/slots`, {
            method: 'POST',
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
        return new Response(JSON.stringify({ error: e.message || 'Ошибка сервера при создании слота' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
} 