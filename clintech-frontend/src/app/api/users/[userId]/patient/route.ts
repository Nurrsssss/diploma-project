/*
    Получение и обновление информации о пациенте по его userId
    GET - возвращает информацию о пациенте
    PUT - обновляет профиль пациента
*/

import { NextRequest, NextResponse } from "next/server";
import { getTokenFromCookies, createUnauthorizedResponse } from '@/utils/auth';
import { TPatient } from '@/types/patient';

export async function GET(request: NextRequest, context: { params: Promise<{ userId: string }> }) {
    try {
        const { userId } = await context.params;
        
        // ✅ Используем унифицированную авторизацию через cookies
        const token = getTokenFromCookies(request);
        if (!token) {
            return createUnauthorizedResponse('Требуется авторизация');
        }

        // ✅ Используем GATEWAY для пациентов
        const backendRes = await fetch(`${process.env.PATIENT_SERVICE}/users/${userId}/patient`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
        });

        let data;
        try {
            data = await backendRes.json();
        } catch {
            data = { error: 'Некорректный ответ от сервера' };
        }

        return NextResponse.json(data, { status: backendRes.status });
    } catch (error) {
        return NextResponse.json({ error: 'Ошибка сервера при получении данных пациента' }, { status: 500 });
    }
}

export async function PUT(
    req: NextRequest,
    context: { params: Promise<{ userId: string }> }
) {
    
    try {
        const { userId } = await context.params;

        if (!userId) {
            return NextResponse.json(
                { error: 'User ID обязателен' },
                { status: 400 }
            );
        }

        const token = getTokenFromCookies(req);
        if (!token) {
            return createUnauthorizedResponse('Требуется авторизация');
        }

        const body: Partial<TPatient> = await req.json();

        // Валидация данных
        if (body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
            return NextResponse.json(
                { error: 'Некорректный формат email' },
                { status: 400 }
            );
        }

        if (body.phone && !/^\+?[1-9]\d{1,14}$/.test(body.phone.replace(/\s+/g, ''))) {
            return NextResponse.json(
                { error: 'Некорректный формат номера телефона' },
                { status: 400 }
            );
        }

        if (body.iin && !/^\d{12}$/.test(body.iin)) {
            return NextResponse.json(
                { error: 'ИИН должен содержать 12 цифр' },
                { status: 400 }
            );
        }

        if (body.height && (body.height < 50 || body.height > 250)) {
            return NextResponse.json(
                { error: 'Рост должен быть от 50 до 250 см' },
                { status: 400 }
            );
        }

        if (body.weight && (body.weight < 20 || body.weight > 300)) {
            return NextResponse.json(
                { error: 'Вес должен быть от 20 до 300 кг' },
                { status: 400 }
            );
        }

        const backendUrl = `${process.env.PATIENT_SERVICE}/users/${userId}/patient`;

        const backendRes = await fetch(backendUrl, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(body)
        });

        let data;
        try {
            data = await backendRes.json();
        } catch (parseError) {
            return NextResponse.json(
                { error: 'Некорректный ответ от сервера' },
                { status: 502 }
            );
        }

        return NextResponse.json(data, { status: backendRes.status });

    } catch (error: any) {
        return NextResponse.json(
            { error: error.message || 'Внутренняя ошибка сервера' },
            { status: 500 }
        );
    }
}

