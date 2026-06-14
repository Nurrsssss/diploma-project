import { useState, useCallback } from 'react';
import { useAuthenticatedFetch } from '../auth/useAuthenticatedFetch';

interface UseVoiceTranscriptionReturn {
    isTranscribing: boolean;
    error: string | null;
    transcribeAudio: (audioBlob: Blob) => Promise<string | null>;
    clearError: () => void;
}

export const useVoiceTranscription = (): UseVoiceTranscriptionReturn => {
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const authenticatedFetch = useAuthenticatedFetch();

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    const transcribeAudio = useCallback(async (audioBlob: Blob): Promise<string | null> => {
        try {
            setIsTranscribing(true);
            setError(null);

            // Проверяем размер аудио файла
            if (audioBlob.size < 1000) {
                console.warn('⚠️ Audio file too small:', audioBlob.size, 'bytes');
                throw new Error('Аудио запись слишком короткая');
            }

            const maxSize = 4 * 1024 * 1024 * 1024; // 4GB для длинных аудиозаписей
            if (audioBlob.size > maxSize) {
                throw new Error('Аудио запись слишком длинная. Максимальный размер файла: 4GB');
            }

            const formData = new FormData();
            formData.append('audio', audioBlob, 'recording.webm');

            const response = await authenticatedFetch('/api/analysis/audio/whisper', {
                method: 'POST',
                body: formData,
                headers: {
                    // Не устанавливаем Content-Type для FormData, браузер сам установит с boundary
                }
            });

            if (!response.ok) {
                // Пытаемся получить детали ошибки
                let errorDetails;
                try {
                    errorDetails = await response.json();
                    console.error('❌ API Error Details:', errorDetails);
                } catch {
                    errorDetails = await response.text();
                    console.error('❌ API Error Text:', errorDetails);
                }
                
                throw new Error(`Ошибка сервера транскрипции (${response.status})`);
            }

            const data = await response.json();
            
            let transcriptionText: string | null = null;
            
            // Проверяем различные возможные форматы ответа
            if (data.transcription) {
                transcriptionText = data.transcription;
            } else if (data.text) {
                transcriptionText = data.text;
            } else if (data.result) {
                transcriptionText = data.result;
            } else if (typeof data === 'string') {
                transcriptionText = data;
            } else {
                throw new Error('Формат ответа сервера не распознан');
            }

            // Проверяем качество транскрипции
            if (!transcriptionText || transcriptionText.trim().length === 0) {
                return null; // Возвращаем null для пустой транскрипции
            }

            // Убираем лишние пробелы и проверяем минимальную длину
            const cleanText = transcriptionText.trim();
            if (cleanText.length < 2) {
                return null;
            }

            return cleanText;

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Неизвестная ошибка при транскрипции';
            setError(errorMessage);
            return null;
        } finally {
            setIsTranscribing(false);
        }
    }, [authenticatedFetch]);

    return {
        isTranscribing,
        error,
        transcribeAudio,
        clearError
    };
}; 