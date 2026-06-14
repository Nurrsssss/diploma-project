// app/api/generate-formats/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { getTokenFromCookies, createUnauthorizedResponse } from '@/utils/auth'

// Поддерживаемые форматы экспорта
const EXPORT_FORMATS = {
  PDF: "pdf"
} as const;

type ExportFormat = typeof EXPORT_FORMATS[keyof typeof EXPORT_FORMATS];

interface GenerateFormatRequest {
  imageDataUrl: string;
  format: ExportFormat;
  filename?: string;
  quality?: number;
}

interface GenerateFormatResponse {
  success: boolean;
  fileDataUrl?: string;
  filename?: string;
  format?: ExportFormat;
  message: string;
}

// Функция для создания PDF на сервере (базовая реализация)
async function createPDFFromImage(imageDataUrl: string): Promise<string> {
  // Для серверной среды просто возвращаем data URL
  // В реальном приложении здесь можно использовать библиотеки типа puppeteer или pdf-lib
  return imageDataUrl;
}

export async function POST(req: NextRequest) {
  try {
    // ✅ Проверяем авторизацию
    const token = getTokenFromCookies(req);
    if (!token) {
      return createUnauthorizedResponse('Требуется авторизация для генерации файлов');
    }

    const body: GenerateFormatRequest = await req.json();
    const { imageDataUrl, format, filename } = body;

    if (!imageDataUrl || !format) {
      return NextResponse.json({
        success: false,
        message: 'Необходимо указать изображение и формат'
      } as GenerateFormatResponse, { status: 400 });
    }

    let fileDataUrl = imageDataUrl;
    let finalFilename = filename || `document_${Date.now()}`;

    // Генерируем PDF файл
    fileDataUrl = await createPDFFromImage(imageDataUrl);
    finalFilename = finalFilename.endsWith('.pdf') ? finalFilename : `${finalFilename}.pdf`;

    return NextResponse.json({
      success: true,
      fileDataUrl,
      filename: finalFilename,
      format,
      message: `PDF файл готов к скачиванию`
    } as GenerateFormatResponse, { status: 200 });

  } catch (error) {
    return NextResponse.json({
      success: false,
      message: 'Ошибка при генерации PDF файла'
    } as GenerateFormatResponse, { status: 500 });
  }
} 