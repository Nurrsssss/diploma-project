/*
    Получение списка пациентов
    Возвращает список всех пациентов.
*/

import { getTokenFromCookies, createUnauthorizedResponse } from '@/utils/auth';

export async function GET(req: Request) {
    console.log('🔵 [API /api/patients] GET запрос получен');
    
    try {
        const token = getTokenFromCookies(req);
        
        if (!token) {
            console.log('❌ [API /api/patients] Токен не найден');
            return createUnauthorizedResponse();
        }

        const patientService = process.env.PATIENT_SERVICE || 'http://185.125.46.62:8804';
        const targetUrl = `${patientService}/patients`;
        
        console.log('🔵 [API /api/patients] Отправка запроса:', targetUrl);
        console.log('🔵 [API /api/patients] Patient Service:', patientService);
        
        const backendRes = await fetch(targetUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
        });

        console.log('🔵 [API /api/patients] Ответ от бэкенда:', backendRes.status);

        let data;
        try {
            data = await backendRes.json();
            console.log('🔵 [API /api/patients] Данные получены:', Array.isArray(data) ? `массив из ${data.length} элементов` : typeof data);
        } catch {
            console.log('❌ [API /api/patients] Ошибка парсинга JSON');
            data = { error: 'Некорректный ответ от сервера' };
        }

        return new Response(JSON.stringify(data), {
            status: backendRes.status,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (e: any) {
        console.error('❌ [API /api/patients] Ошибка:', e.message);
        return new Response(JSON.stringify({ error: e.message || 'Ошибка сервера' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
