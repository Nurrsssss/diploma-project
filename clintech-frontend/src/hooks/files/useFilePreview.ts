import { useState, useCallback } from 'react';

export interface UseFilePreviewReturn {
    loading: boolean;
    error: string | null;
    previewUrl: string | null;
    openPreview: (fileId: string) => void;
    closePreview: () => void;
    clearError: () => void;
}

export const useFilePreview = (): UseFilePreviewReturn => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    const closePreview = useCallback(() => {
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
        }
        setPreviewUrl(null);
        setError(null);
    }, [previewUrl]);

    const openPreview = useCallback(async (fileId: string) => {
        try {
            setLoading(true);
            setError(null);
            
            // Закрываем предыдущий preview если есть
            if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
                setPreviewUrl(null);
            }

            const response = await fetch(`/api/files/${fileId}/preview`, {
                method: 'GET',
                credentials: 'include'
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Ошибка предпросмотра: ${response.status}`);
            }

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            setPreviewUrl(url);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Ошибка при предпросмотре файла';
            setError(errorMessage);
            console.error('Ошибка предпросмотра файла:', err);
        } finally {
            setLoading(false);
        }
    }, [previewUrl]);

    return {
        loading,
        error,
        previewUrl,
        openPreview,
        closePreview,
        clearError
    };
};
