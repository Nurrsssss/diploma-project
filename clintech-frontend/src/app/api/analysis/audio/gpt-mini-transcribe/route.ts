import { NextRequest } from 'next/server';

// Конфигурация для больших файлов
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10000mb',
    },
    responseLimit: false,
  }, 
};

export async function POST(req: NextRequest) {
    try {
        // Check if ANKETA_SERVICE is configured
        if (!process.env.ANKETA_SERVICE) {
            console.error('ANKETA_SERVICE environment variable is not set');
            return new Response(JSON.stringify({
                error: 'ANKETA_SERVICE не настроен',
                message: 'Переменная окружения ANKETA_SERVICE не определена'
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const formData = await req.formData();
        const audioFile = formData.get('audio') as File;
        const language = formData.get('language') as string || 'ru';

        if (!audioFile) {
            return new Response(JSON.stringify({ error: 'No audio file provided' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Проверяем размер файла (максимум 50MB)
        const maxSize = 10000 * 1024 * 1024; // 50MB
        if (audioFile.size > maxSize) {
            return new Response(JSON.stringify({ 
                error: 'Файл слишком большой. Максимальный размер: 1000MB' 
            }), {
                status: 413,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const externalFormData = new FormData();
        externalFormData.append('audio', audioFile);
        if (language) {
            externalFormData.append('language', language);
        }

        const backendUrl = `${process.env.ANKETA_SERVICE}/audio/gpt-transcribe`;

        const response = await fetch(backendUrl, {
            method: 'POST',
            body: externalFormData,
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Backend service error: ${response.status}`, errorText);
            return new Response(JSON.stringify({
                error: `Backend service error: ${response.status}`,
                details: errorText,
                backendUrl
            }), {
                status: response.status,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const data = await response.json();

        return new Response(JSON.stringify(data), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error: any) {
        console.error('GPT Mini transcription error:', error);
        return new Response(JSON.stringify({ 
            error: error.message || 'Transcription failed',
            details: 'Check server logs for more information',
            backendUrl: process.env.ANKETA_SERVICE ? `${process.env.ANKETA_SERVICE}/audio/gpt-mini-transcribe` : 'ANKETA_SERVICE not set'
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
} 