import { useState, useCallback } from 'react';
import { useAuthenticatedFetch } from '../auth/useAuthenticatedFetch';

export interface GenerateRecommendationsData {
  appointment_id: string;
  doctor_id: string;
  lang: string;
  transcription_text: string;
}

interface RecommendationsResult {
  file_id: string;
  download_url?: string;
}

interface UsePatientRecommendationsReturn {
  isGenerating: boolean;
  error: string | null;
  generateRecommendations: (data: GenerateRecommendationsData) => Promise<string | null>;
  clearError: () => void;
}

export const usePatientRecommendations = (): UsePatientRecommendationsReturn => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const authenticatedFetch = useAuthenticatedFetch();

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const downloadRecommendationsFile = useCallback(
    async (result: RecommendationsResult) => {
      const downloadUrl = result.download_url
        ? `/api${result.download_url}`
        : `/api/patient-recommendations/${result.file_id}/download`;

      const fileResponse = await authenticatedFetch(downloadUrl, { method: 'GET' });
      if (!fileResponse.ok) {
        throw new Error(`Не удалось скачать файл рекомендаций: ${fileResponse.status}`);
      }

      const fileBlob = await fileResponse.blob();

      const contentDisposition = fileResponse.headers.get('Content-Disposition');
      let fileName = `Рекомендации_пациенту_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.docx`;
      if (contentDisposition) {
        const fileNameMatch = contentDisposition.match(/filename="?([^";]+)"?/);
        if (fileNameMatch && fileNameMatch[1]) {
          fileName = decodeURIComponent(fileNameMatch[1]);
        }
      }

      const objUrl = URL.createObjectURL(fileBlob);
      const link = document.createElement('a');
      link.href = objUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(objUrl);
      }, 100);
    },
    [authenticatedFetch],
  );

  const generateRecommendations = useCallback(
    async (data: GenerateRecommendationsData): Promise<string | null> => {
      try {
        setIsGenerating(true);
        setError(null);

        const response = await authenticatedFetch('/api/patient-recommendations/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          const errorText = await response.text();
          let errorMessage = `Ошибка генерации рекомендаций: ${response.status}`;
          try {
            const errorData = JSON.parse(errorText);
            if (errorData.error) {
              errorMessage = errorData.error;
            }
            if (errorData.message) {
              errorMessage += ` - ${errorData.message}`;
            }
          } catch {
            errorMessage += ` - ${errorText}`;
          }
          throw new Error(errorMessage);
        }

        const result: RecommendationsResult = await response.json();
        await downloadRecommendationsFile(result);

        return null;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Ошибка при генерации рекомендаций для пациента';
        console.error('usePatientRecommendations: Generation error:', err);
        setError(errorMessage);
        return errorMessage;
      } finally {
        setIsGenerating(false);
      }
    },
    [authenticatedFetch, downloadRecommendationsFile],
  );

  return {
    isGenerating,
    error,
    generateRecommendations,
    clearError,
  };
};
