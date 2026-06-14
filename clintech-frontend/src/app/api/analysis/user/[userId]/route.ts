import { NextRequest } from "next/server";
import { getTokenFromCookies, createUnauthorizedResponse } from '@/utils/auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ userId?: string }> }) {
    try {
        // ✅ Используем унифицированную авторизацию через cookies
        const token = getTokenFromCookies(req);
        if (!token) {
            return createUnauthorizedResponse('Требуется авторизация');
        }
        
        const { userId } = await params

        if (!userId) {
            return new Response(JSON.stringify({ error: 'Doctor ID is required' }), { status: 400 })
        }

        if (!process.env.ANKETA_SERVICE) {
            return new Response(JSON.stringify({ error: 'ANKETA_SERVICE не настроен' }), { status: 500 })
        }

        const backendUrl = `${process.env.ANKETA_SERVICE}/analysis/user/${userId}`;

        const backendRes = await fetch(backendUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        })

        const responseText = await backendRes.text();
        let data;

        try {
            data = JSON.parse(responseText);
        } catch (parseError) {
            const status = backendRes.status >= 400 ? backendRes.status : 500;
            return new Response(JSON.stringify({ error: 'Некорректный JSON-ответ от бэкенд-сервиса' }), {
                status: status,
                headers: { 'Content-Type': 'application/json' }
            });
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