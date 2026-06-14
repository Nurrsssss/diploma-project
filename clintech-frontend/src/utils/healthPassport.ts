/**
 * Нормализует download_url для использования на фронтенде
 * Если URL начинается с /health-passport/, добавляет префикс /api
 * 
 * @param downloadUrl - URL из ответа API (например, /health-passport/{id}/download)
 * @param fileId - ID файла для fallback на старый способ
 * @returns Нормализованный URL для использования на фронтенде
 */
export const normalizeHealthPassportDownloadUrl = (
    downloadUrl: string | undefined, 
    fileId: string | undefined
): string => {
    if (downloadUrl) {
        if (downloadUrl.startsWith('/health-passport/')) {
            return `/api${downloadUrl}`;
        } else if (downloadUrl.startsWith('/api/')) {
            return downloadUrl;
        } else {
            return downloadUrl;
        }
    }
    // Fallback на старый способ
    return fileId ? `/api/files/${fileId}/download` : '';
};

