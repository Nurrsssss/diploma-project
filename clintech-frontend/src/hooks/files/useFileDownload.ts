import { useState, useCallback } from 'react';
import { useAuthenticatedFetch } from '../auth/useAuthenticatedFetch';

interface DownloadOptions {
    fileId: string;
    fileName?: string;
    defaultFileName?: string;
}

interface UseFileDownloadReturn {
    isDownloading: boolean;
    error: string | null;
    downloadFile: (options: DownloadOptions) => Promise<boolean>;
    downloadFromUrl: (url: string, fileName?: string) => Promise<boolean>;
    clearError: () => void;
}

export const useFileDownload = (): UseFileDownloadReturn => {
    const [isDownloading, setIsDownloading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const authenticatedFetch = useAuthenticatedFetch();

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    const downloadFile = useCallback(async (options: DownloadOptions): Promise<boolean> => {
        try {
            setIsDownloading(true);
            setError(null);

            const response = await authenticatedFetch(`/api/files/${options.fileId}/download`, {
                method: 'GET'
            });

            if (!response.ok) {
                throw new Error(`Ошибка скачивания файла: ${response.status} ${response.statusText}`);
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = options.fileName || options.defaultFileName || 'downloaded_file';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            window.URL.revokeObjectURL(url);
            return true;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Ошибка при скачивании файла';
            setError(errorMessage);
            console.error('File download error:', err);
            return false;
        } finally {
            setIsDownloading(false);
        }
    }, [authenticatedFetch]);

    const downloadFromUrl = useCallback(async (url: string, fileName?: string): Promise<boolean> => {
        try {
            setIsDownloading(true);
            setError(null);

            const response = await authenticatedFetch(url, {
                method: 'GET'
            });

            if (!response.ok) {
                throw new Error(`Ошибка скачивания файла: ${response.status} ${response.statusText}`);
            }

            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = fileName || 'downloaded_file';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            window.URL.revokeObjectURL(downloadUrl);
            return true;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Ошибка при скачивании файла';
            setError(errorMessage);
            console.error('File download error:', err);
            return false;
        } finally {
            setIsDownloading(false);
        }
    }, [authenticatedFetch]);

    return {
        isDownloading,
        error,
        downloadFile,
        downloadFromUrl,
        clearError
    };
}; 