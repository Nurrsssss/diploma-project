import { useState, useCallback } from 'react';
import { useAuthenticatedFetch } from '../auth/useAuthenticatedFetch';

interface DetectionInfo {
    label: string;
    confidence: number;
    bbox: number[];
}

interface ProcessDocumentResult {
    success: boolean;
    message?: string;
    originalImageUrl?: string;
    processedImageUrl?: string;
    detectionInfo?: DetectionInfo;
}

interface UseDocumentProcessorReturn {
    isProcessing: boolean;
    error: string | null;
    progress: number;
    currentStep: string;
    processDocument: (imageData: string) => Promise<ProcessDocumentResult | null>;
    downloadImage: (imageUrl: string) => Promise<string | null>;
    clearError: () => void;
    reset: () => void;
}

export const useDocumentProcessor = (): UseDocumentProcessorReturn => {
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [progress, setProgress] = useState(0);
    const [currentStep, setCurrentStep] = useState('');
    const authenticatedFetch = useAuthenticatedFetch();

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    const reset = useCallback(() => {
        setIsProcessing(false);
        setError(null);
        setProgress(0);
        setCurrentStep('');
    }, []);

    const downloadImage = useCallback(async (imageUrl: string): Promise<string | null> => {
        try {
            const response = await authenticatedFetch(imageUrl, {
                method: 'GET'
            });

            if (!response.ok) {
                throw new Error(`Ошибка загрузки изображения: ${response.status}`);
            }

            const blob = await response.blob();
            return new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.readAsDataURL(blob);
            });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Ошибка загрузки изображения';
            setError(errorMessage);
            console.error('Download error:', err);
            return null;
        }
    }, [authenticatedFetch]);

    const processDocument = useCallback(async (imageData: string): Promise<ProcessDocumentResult | null> => {
        try {
            setIsProcessing(true);
            setError(null);
            setProgress(0);
            setCurrentStep('Обработка документа...');

            setProgress(30);

            const response = await authenticatedFetch('/api/process-document', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    imageData
                }),
            });

            setProgress(60);

            if (!response.ok) {
                throw new Error(`Ошибка обработки документа: ${response.status}`);
            }

            const result = await response.json();
            
            setProgress(90);
            setCurrentStep('Завершение...');

            const processedResult: ProcessDocumentResult = {
                success: true,
                message: result.message,
                originalImageUrl: result.originalImageUrl,
                processedImageUrl: result.processedImageUrl,
                detectionInfo: result.detectionInfo
            };

            setProgress(100);
            setCurrentStep('Готово!');

            return processedResult;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Ошибка обработки документа';
            setError(errorMessage);
            console.error('Document processing error:', err);
            return null;
        } finally {
            setTimeout(() => {
                setIsProcessing(false);
            }, 500);
        }
    }, [authenticatedFetch]);

    return {
        isProcessing,
        error,
        progress,
        currentStep,
        processDocument,
        downloadImage,
        clearError,
        reset
    };
}; 