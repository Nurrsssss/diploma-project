import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, addAuthHeaderToRequest } from '@/utils/auth';

export async function GET(req: NextRequest) {
    // Check authentication
    const authError = await requireAuth(req);
    if (authError) return authError;

    try {
        const { searchParams } = new URL(req.url);
        const pdfPath = searchParams.get('path');

        if (!pdfPath) {
            return NextResponse.json(
                { error: 'Не указан путь к PDF файлу' },
                { status: 400 }
            );
        }

        // Прямой прокси-запрос к Go API для скачивания PDF
        const pdfUrl = `${process.env.ANKETA_SERVICE}${pdfPath}`;

        // Получаем PDF файл от файлового сервера с авторизацией
        const requestHeaders = await addAuthHeaderToRequest(req);
        const response = await fetch(pdfUrl, { headers: requestHeaders });

        if (!response.ok) {
            const errorText = await response.text();
            return NextResponse.json(
                { error: 'Не удалось получить PDF файл', details: errorText },
                { status: response.status }
            );
        }

        // Получаем содержимое файла как blob
        const pdfBuffer = await response.arrayBuffer();

        // Возвращаем PDF файл с правильными заголовками
        return new NextResponse(pdfBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': 'attachment; filename="health_survey.pdf"',
                'Cache-Control': 'no-cache',
            },
        });
    } catch (error) {
        console.error('Ошибка при загрузке PDF:', error);
        return NextResponse.json(
            { error: 'Внутренняя ошибка сервера' },
            { status: 500 }
        );
    }
} 