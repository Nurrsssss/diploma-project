/*
Создание пациента врачом без OTP верификации
Только для авторизованных врачей
*/

import { getTokenFromCookies, createUnauthorizedResponse } from '@/utils/auth';

export async function POST(req: Request) {
    console.log('🔵 [API /api/auth/register-patient-by-doctor] POST запрос получен');
    
    try {
        const token = getTokenFromCookies(req);
        
        if (!token) {
            console.log('❌ [API /api/auth/register-patient-by-doctor] Токен не найден');
            return createUnauthorizedResponse();
        }

        const body = await req.json();
        console.log('🔵 [API /api/auth/register-patient-by-doctor] Тело запроса:', { 
            phone: body.phone,
            first_name: body.first_name,
            last_name: body.last_name 
        });

        const gateway = process.env.GATEWAY || 'http://185.125.46.62:8800';
        const targetUrl = `${gateway}/auth/register-patient-by-doctor`;
        
        console.log('🔵 [API /api/auth/register-patient-by-doctor] Отправка запроса:', targetUrl);
        
        const backendRes = await fetch(targetUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(body),
        });

        console.log('🔵 [API /api/auth/register-patient-by-doctor] Ответ от бэкенда:', backendRes.status);

        let data;
        try {
            data = await backendRes.json();
            console.log('🔵 [API /api/auth/register-patient-by-doctor] Данные получены:', data.success ? 'успех' : 'ошибка');
        } catch {
            console.log('❌ [API /api/auth/register-patient-by-doctor] Ошибка парсинга JSON');
            data = { success: false, error: 'Некорректный ответ от сервера' };
        }

        return new Response(JSON.stringify(data), {
            status: backendRes.status,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (e: any) {
        console.error('❌ [API /api/auth/register-patient-by-doctor] Ошибка:', e);
        return new Response(JSON.stringify({ 
            success: false,
            error: 'INTERNAL_ERROR',
            message: e.message || 'Ошибка сервера' 
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

