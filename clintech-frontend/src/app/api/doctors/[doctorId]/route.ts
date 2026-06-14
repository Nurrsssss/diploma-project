import { NextRequest } from "next/server"
import { getTokenFromCookies, createUnauthorizedResponse } from '@/utils/auth';

/*
    Получение информации о враче по его doctorId
    Возвращает информацию о враче.
*/


export async function GET(req: NextRequest, { params }: { params: Promise<{ doctorId?: string }> }) {
    try {
        const token = getTokenFromCookies(req);
        const { doctorId } = await params
        
        if (!token) {
            return createUnauthorizedResponse();
        }

        if (!doctorId) {
            return new Response(JSON.stringify({ error: 'Doctor ID is required' }), { status: 400 })
        }

        if (!process.env.SPECIALIST_SERVICE) {
            return new Response(JSON.stringify({ error: 'SPECIALIST_SERVICE не настроен' }), { status: 500 })
        }

        const backendUrl = `${process.env.SPECIALIST_SERVICE}/api/doctors/${doctorId}`;

        const backendRes = await fetch(backendUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        })

        let data;
        try {
            data = await backendRes.json();
        } catch (parseError) {
            const textResponse = await backendRes.text()
            data = { error: 'Некорректный ответ от сервера авторизации' };
        }

        return new Response(JSON.stringify(data), {
            status: backendRes.status,
            headers: { 'Content-Type': 'application/json' }
        })
    } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message || 'Ошибка сервера' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        })
    }
}

/*
    Обновление информации о враче по его doctorId
    Возвращает обновленную информацию о враче.
*/

export async function PUT(req: NextRequest, { params }: { params: Promise<{ doctorId?: string }> }) {
    try {
        const token = getTokenFromCookies(req);
        const { doctorId } = await params
        
        if (!token) {
            return createUnauthorizedResponse();
        }

        if (!doctorId) {
            return new Response(JSON.stringify({ error: 'Doctor ID is required' }), { status: 400 })
        }

        // Получаем данные из тела запроса
        const body = await req.json();

        const backendRes = await fetch(`${process.env.SPECIALIST_SERVICE}/api/doctors/${doctorId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(body)
        })

        let data;
        try {
            data = await backendRes.json();
        } catch (parseError) {
            data = { error: 'Некорректный ответ от сервера' };
        }

        return new Response(JSON.stringify(data), {
            status: backendRes.status,
            headers: { 'Content-Type': 'application/json' }
        })
    } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message || 'Ошибка сервера' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        })
    }
}

/*
    Удаление врача по его doctorId
    Возвращает удаленного врача.
*/

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ doctorId?: string }> }) {
    try {
        const token = getTokenFromCookies(req);
        const { doctorId } = await params
        
        if (!token) {
            return createUnauthorizedResponse();
        }

        if (!doctorId) {
            return new Response(JSON.stringify({ error: 'Doctor ID is required' }), { status: 400 })
        }

        const backendRes = await fetch(`${process.env.SPECIALIST_SERVICE}/api/doctors/${doctorId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        })

        let data;
        try {
            data = await backendRes.json();
        } catch (parseError) {
            data = { error: 'Некорректный ответ от сервера' };
        }

        return new Response(JSON.stringify(data), {
            status: backendRes.status,
            headers: { 'Content-Type': 'application/json' }
        })
    } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message || 'Ошибка сервера' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        })
    }
}
