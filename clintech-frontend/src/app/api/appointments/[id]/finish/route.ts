import { NextRequest } from 'next/server';
import { getTokenFromCookies, createUnauthorizedResponse } from '@/utils/auth';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const token = getTokenFromCookies(req);
        
        if (!token) {
            return createUnauthorizedResponse('Требуется авторизация');
        }

        if (!process.env.CALENDAR_SERVICE) {
            return new Response(JSON.stringify({ error: 'CALENDAR_SERVICE не настроен' }), { status: 500 });
        }

        // Получаем данные из запроса
        const body = await req.json();
        const { doctor_notes, status } = body;

        // Подготавливаем данные для отправки на бэкенд
        const updateData: any = {
            status: status || 'completed' // Используем переданный статус или по умолчанию 'completed'
        };

        if (doctor_notes) {
            updateData.doctor_notes = doctor_notes;
        }

        // Бэкендер сам прикрепит паспорт и изменит статус

        const backendUrl = `${process.env.CALENDAR_SERVICE}/appointments/${id}`;
       
        const backendRes = await fetch(backendUrl, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(updateData)
        });


        const responseText = await backendRes.text();
        let data;
        try {
            data = JSON.parse(responseText);
        } catch {
            data = { error: 'Некорректный ответ от сервера' };
        }


        return new Response(JSON.stringify(data), {
            status: backendRes.status,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('PUT /api/appointments/[id]/finish - Error:', error);
        return new Response(JSON.stringify({ 
            error: 'Ошибка сервера при завершении приёма',
            details: error instanceof Error ? error.message : 'Неизвестная ошибка'
        }), { status: 500 });
    }
} 