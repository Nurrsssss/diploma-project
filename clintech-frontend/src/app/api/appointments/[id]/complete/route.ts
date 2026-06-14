/*
Завершение приема врачом
POST /appointments/{appointmentID}/complete
Только для роли doctor
*/

import { NextRequest } from 'next/server';
import { getTokenFromCookies, createUnauthorizedResponse } from '@/utils/auth';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        
        // Получаем токен из cookies
        const   token = getTokenFromCookies(req);
        if (!token) {
            return createUnauthorizedResponse('Требуется авторизация');
        }

        if (!id) {
            return new Response(JSON.stringify({ error: 'ID записи обязателен' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Получаем данные для завершения приема
        const body = await req.json();

        // Отправляем запрос на backend через GATEWAY
        const gateway = process.env.GATEWAY || 'http://185.125.46.62:8800';
        const backendRes = await fetch(`${gateway}/appointments/${id}/complete`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(body)
        });

        let data;
        try {
            data = await backendRes.json();
        } catch {
            data = { error: 'Некорректный ответ от сервера' };
        }

        if (!backendRes.ok) {
            console.error('Backend error при завершении приема:', data);
        }

        return new Response(JSON.stringify(data), {
            status: backendRes.status,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (e: any) {
        console.error('Ошибка при завершении приема:', e);
        return new Response(JSON.stringify({ 
            error: e.message || 'Ошибка сервера при завершении приема' 
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}