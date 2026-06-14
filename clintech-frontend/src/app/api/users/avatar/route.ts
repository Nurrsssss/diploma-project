/*
    Управление аватаркой пользователя
    POST - загрузка новой аватарки
    DELETE - удаление текущей аватарки
*/

import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromCookies, createUnauthorizedResponse } from '@/utils/auth';

export async function POST(req: NextRequest) {
    try {
        // ✅ Получаем токен из HttpOnly cookie
        const token = getTokenFromCookies(req);
        if (!token) {
            return createUnauthorizedResponse('Требуется авторизация');
        }

        // ✅ Проверяем Content-Type для multipart/form-data
        const contentType = req.headers.get("content-type") || "";
        if (!contentType.includes("multipart/form-data")) {
            return NextResponse.json({ error: "Неверный Content-Type. Ожидается multipart/form-data" }, {
                status: 400,
                headers: { "Content-Type": "application/json" },
            });
        }

        // ✅ Получаем файл из FormData
        const formData = await req.formData();
        const file = formData.get("avatar") as File;

        if (!file) {
            return NextResponse.json({ error: "Файл аватарки не найден" }, {
                status: 400,
                headers: { "Content-Type": "application/json" },
            });
        }

        // ✅ Проверяем тип файла (только JPEG/PNG)
        if (!['image/jpeg', 'image/png'].includes(file.type)) {
            return NextResponse.json({ error: "Файл должен быть в формате JPEG или PNG" }, {
                status: 400,
                headers: { "Content-Type": "application/json" },
            });
        }

        // ✅ Проверяем размер файла (максимум 3MB)
        if (file.size > 3 * 1024 * 1024) {
            return NextResponse.json({ error: "Размер файла не должен превышать 3MB" }, {
                status: 400,
                headers: { "Content-Type": "application/json" },
            });
        }

        // ✅ Проксируем файл на GATEWAY сервис
        const proxyForm = new FormData();
        proxyForm.append("avatar", file, file.name);

        const backendRes = await fetch(`${process.env.GATEWAY}/users/avatar`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                // Не указываем Content-Type! fetch сам выставит boundary для FormData
            },
            body: proxyForm,
        });

        let data;
        try {
            data = await backendRes.json();
        } catch {
            return NextResponse.json({ error: 'Некорректный ответ от сервера' }, { status: 500 });
        }

        // Если ответ не успешный, форматируем ошибку
        if (!backendRes.ok) {
            const errorMessage = data.message || data.error || 'Произошла ошибка при загрузке аватарки';
            return NextResponse.json({ 
                error: errorMessage,
                details: data 
            }, { 
                status: backendRes.status 
            });
        }

        return NextResponse.json(data, { status: 200 });

    } catch (e: any) {
        return NextResponse.json({ error: e.message || 'Ошибка сервера' }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        // ✅ Получаем токен из HttpOnly cookie
        const token = getTokenFromCookies(req);
        if (!token) {
            return createUnauthorizedResponse('Требуется авторизация');
        }

        // ✅ Отправляем DELETE запрос на GATEWAY сервис
        const backendRes = await fetch(`${process.env.GATEWAY}/users/avatar`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
        });

        let data;
        try {
            data = await backendRes.json();
        } catch {
            return NextResponse.json({ error: 'Некорректный ответ от сервера' }, { status: 500 });
        }

        // Если ответ не успешный, форматируем ошибку
        if (!backendRes.ok) {
            const errorMessage = data.message || data.error || 'Произошла ошибка при удалении аватарки';
            return NextResponse.json({ 
                error: errorMessage,
                details: data 
            }, { 
                status: backendRes.status 
            });
        }

        return NextResponse.json(data, { status: 200 });

    } catch (e: any) {
        return NextResponse.json({ error: e.message || 'Ошибка сервера' }, { status: 500 });
    }
} 