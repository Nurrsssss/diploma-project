import { useState, useCallback } from 'react';
import { useAuth } from '@/hooks/auth/useAuth';
import { useAuthenticatedFetch } from '@/hooks/auth/useAuthenticatedFetch';

interface UseLatestAnalysisReturn {
  loading: boolean;
  error: string | null;
  analysisId: string | null;
  fetchLatestAnalysis: () => Promise<string | null>;
  clearError: () => void;
}

export const useLatestAnalysis = (): UseLatestAnalysisReturn => {
  const { session, hydrated } = useAuth();
  const authenticatedFetch = useAuthenticatedFetch();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisId, setAnalysisId] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const fetchLatestAnalysis = useCallback(async (): Promise<string | null> => {
    if (!hydrated) {
      setError('Ждем инициализации сессии');
      return null;
    }

    if (!session?.isLoggedIn) {
      setError('Нет авторизации');
      return null;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await authenticatedFetch('/api/analysis/my', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Ошибка получения анкет: ${response.status}`);
      }

      const data = await response.json();

      // Получаем последнюю анкету
      if (Array.isArray(data) && data.length > 0) {
        const latestAnalysis = data[0]; // Предполагаем, что анкеты отсортированы по дате
        setAnalysisId(latestAnalysis.id);
        return latestAnalysis.id;
      } else {
        setError('Анкеты не найдены');
        return null;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Неизвестная ошибка при получении анкет';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, [hydrated, session?.isLoggedIn, authenticatedFetch]);

  return {
    loading,
    error,
    analysisId,
    fetchLatestAnalysis,
    clearError
  };
}; 