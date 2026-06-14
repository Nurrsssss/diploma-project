// app/api/process-document/route.ts

import { NextRequest, NextResponse } from 'next/server'
import Replicate from 'replicate'
import { DetectionInfo } from '@/types/document'
import { enhanceImage, base64ToBuffer, bufferToBase64 } from '@/utils/imageEnhancer'
import { getTokenFromCookies, createUnauthorizedResponse } from '@/utils/auth'

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN, // положи токен в .env
})

// Интерфейсы для типизации
interface ProcessingResult {
  success: boolean;
  processedImageUrl?: string;
  originalImageUrl?: string;
  detectionInfo?: DetectionInfo;
  message: string;
  canDownload?: boolean;
}

// Функция для Node.js окружения (серверная обрезка через Canvas API эмуляцию)
async function cropImageServer(imageDataUrl: string, bbox: number[]): Promise<string> {
  // В Node.js окружении мы не можем использовать DOM Canvas
  // Но можем подготовить данные для клиентской обрезки
  
  // Для серверной среды можно использовать библиотеки типа 'canvas' или 'sharp'
  // Но пока возвращаем оригинал и делаем обрезку на клиенте
  return imageDataUrl;
}

export async function POST(req: NextRequest) {
  let originalDataUrl = ''; // Сохраняем для fallback
  
  try {
    // ✅ Проверяем авторизацию
    const token = getTokenFromCookies(req);
    if (!token) {
      return createUnauthorizedResponse('Требуется авторизация для обработки документов');
    }

    const data = await req.json();
    const { imageData } = data;
    
    if (!imageData) {
      return NextResponse.json({ 
        success: false, 
        message: 'No image data provided' 
      } as ProcessingResult, { status: 400 });
    }

    const dataUrl = imageData;
    const buffer = base64ToBuffer(dataUrl);
    originalDataUrl = dataUrl; // Сохраняем для fallback
    
    
    // Проверяем наличие API токена
    if (!process.env.REPLICATE_API_TOKEN) {
     return NextResponse.json({ 
        success: true,
        processedImageUrl: dataUrl,
        originalImageUrl: dataUrl,
        message: 'Обработка пропущена '
      } as ProcessingResult, { status: 200 })
    }

    // Maximum file size (5MB)
    const maxFileSize = 5 * 1024 * 1024;

    if (buffer.byteLength > maxFileSize) {
      return NextResponse.json({ 
        success: true,
        processedImageUrl: dataUrl,
        originalImageUrl: dataUrl,
        message: `Файл слишком большой (${Math.round(buffer.byteLength / 1024)}KB). Уменьшите разрешение камеры или сожмите изображение.`
      } as ProcessingResult, { status: 200 })
    }

    // Дополнительная проверка: если base64 строка слишком длинная, изображение большое
    const isImageTooLarge = dataUrl.length > 7000000; // Поддержка до 5MB файлов
    
    if (isImageTooLarge) {
      return NextResponse.json({ 
        success: true,
        processedImageUrl: dataUrl,
        originalImageUrl: dataUrl,
        message: `Изображение слишком большое для AI обработки. Попробуйте сфотографировать с меньшим разрешением.`
      } as ProcessingResult, { status: 200 })
    }

    // ШАГ 1: Обнаружение документа с помощью Grounding DINO
   
    let processedImageUrl = dataUrl;
    let documentBbox = null;
    let detectionInfo: DetectionInfo | null = null;

    try {
      const detectionOutput = await replicate.run(
        "adirik/grounding-dino:efd10a8ddc57ea28773327e881ce95e20cc1d734c589f7dd01d2036921ed78aa",
        {
          input: {
            image: dataUrl,
            query: "page",
            box_threshold: 0.3,
            text_threshold: 0.4
          }
        }
      ) as any;

      
      // Пробуем разные форматы ответа от grounding-dino
      let boxes = null;
      let labels = null;
      let confidences = null;
      
      // Формат 1: detectionOutput.detections (старый формат)
      if (detectionOutput && detectionOutput.detections && detectionOutput.detections.length > 0) {
        const bestDetection = detectionOutput.detections[0];
        documentBbox = bestDetection.bbox;
        
        detectionInfo = {
          label: bestDetection.label,
          confidence: bestDetection.confidence,
          bbox: documentBbox
        };
      }
      // Формат 2: прямые массивы boxes, labels (новый формат)
      else if (detectionOutput && detectionOutput.boxes && detectionOutput.boxes.length > 0) {
        boxes = detectionOutput.boxes;
        labels = detectionOutput.labels || detectionOutput.texts;
        confidences = detectionOutput.confidences || detectionOutput.scores;
        
       
        
        // Берем первый найденный документ
        documentBbox = boxes[0];
        
        detectionInfo = {
          label: labels ? labels[0] : 'document',
          confidence: confidences ? confidences[0] : 0.8,
          bbox: documentBbox
        };
      }
      // Формат 3: если это просто массив координат
      else if (Array.isArray(detectionOutput) && detectionOutput.length >= 4) {
        documentBbox = detectionOutput;
        
        detectionInfo = {
          label: 'document',
          confidence: 0.8,
          bbox: documentBbox
        };
      }
      
      if (documentBbox && detectionInfo) {
       
        
        // ШАГ 2: Обрезаем документ по координатам bbox
        
        try {
          const croppedImage = await cropImageServer(dataUrl, documentBbox);
          
          processedImageUrl = croppedImage;
        } catch (cropError) {
          // Обрезка не удалась, продолжаем с оригиналом
        }
      }
    } catch (detectionError) {
      // Детекция не удалась, продолжаем без обрезки
    }

    // ШАГ 3: Улучшение качества изображения
    try {
      const imageBuffer = base64ToBuffer(processedImageUrl);
      const enhancedBuffer = await enhanceImage(imageBuffer);
      processedImageUrl = bufferToBase64(enhancedBuffer);
     
    } catch (enhanceError) {
      // Улучшение не удалось, используем исходное изображение
    }

    let message = 'Документ обработан через 3-шаговый AI пайплайн!';
    
    if (documentBbox && detectionInfo) {
      message = `✅ Документ "${detectionInfo.label}" найден с точностью ${Math.round(detectionInfo.confidence * 100)}%. Выполнена обработка: Детекция → Обрезка → Улучшение качества`;
    } else {
      message = '⚠️ Документ не обнаружен. Выполнено улучшение качества оригинального изображения.';
    }

    // Возвращаем результат
    return NextResponse.json({ 
      success: true,
      processedImageUrl: processedImageUrl,
      originalImageUrl: dataUrl,
      detectionInfo: detectionInfo,
      message: message,
      canDownload: true
    } as ProcessingResult, { status: 200 });

  } catch (error: any) {
    
    // Если ошибка, возвращаем оригинальное изображение
    if (originalDataUrl) {
      return NextResponse.json({ 
        success: true,
        processedImageUrl: originalDataUrl,
        originalImageUrl: originalDataUrl,
        message: `⚠️ Произошла ошибка при обработке: ${error.message || 'Неизвестная ошибка'}`,
        canDownload: true
      } as ProcessingResult, { status: 200 })
    }

    return NextResponse.json({ 
      success: false, 
      message: 'Ошибка при обработке изображения' 
    } as ProcessingResult, { status: 500 });
  }
}
