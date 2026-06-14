import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/auth/useAuth';

const LOCAL_ANALYSIS_STORAGE_KEY_PREFIX = 'patientAnalyses';

const getLocalAnalysisStorageKey = (userId?: string | null) => {
  const normalizedUserId = String(userId || '').trim();
  return normalizedUserId
    ? `${LOCAL_ANALYSIS_STORAGE_KEY_PREFIX}:${normalizedUserId}`
    : LOCAL_ANALYSIS_STORAGE_KEY_PREFIX;
};

// Типы для анализов (можно расширить в зависимости от структуры данных)
interface AnalysisResult {
  id: string;
  type: string;
  date: string;
  results: Record<string, any>;
  recommendations?: string;
  [key: string]: any;
}

interface UsePatientAnalysisResult {
  analysis: AnalysisResult[] | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
  getAnalysisById: (id: string) => AnalysisResult | null;
  fetchAnalysisById: (id: string) => Promise<AnalysisResult | null>;
}

const readLocalAnalyses = (userId?: string | null): AnalysisResult[] => {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = localStorage.getItem(getLocalAnalysisStorageKey(userId));
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    const normalizedUserId = String(userId || '').trim();

    if (!Array.isArray(parsed)) {
      return [];
    }

    if (!normalizedUserId) {
      return parsed;
    }

    return parsed.filter((item) => {
      if (!item || typeof item !== 'object') {
        return false;
      }

      const ownerUserId = String(item.owner_user_id ?? '').trim();
      return !ownerUserId || ownerUserId === normalizedUserId;
    });
  } catch (error) {
    console.error('Ошибка чтения локальных анализов:', error);
    return [];
  }
};

export const usePatientAnalysis = (): UsePatientAnalysisResult => {
  const [analysis, setAnalysis] = useState<AnalysisResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { session, validateSession, hydrated } = useAuth();

  const fetchAnalysis = useCallback(async () => {
    if (!hydrated) {
      console.log('Ждем полной инициализации сессии перед запросом анализов');
      return;
    }

    if (!session?.isLoggedIn) {
      setAnalysis(null);
      setLoading(false);
      setError('Пользователь не авторизован');
      return;
    }

    // Дополнительная проверка: убеждаемся что у нас есть user_id (полная сессия)
    if (!session?.user_id) {
      console.warn('Сессия неполная, отсутствует user_id, пропускаем запрос анализов');
      setAnalysis([]);
      setLoading(false);
      return;
    }

    // ✅ Проверяем, что пользователь является пациентом
    if (session.role !== 'patient') {
      setAnalysis(null);
      setLoading(false);
      setError(`Доступ запрещен. Требуется роль patient, а у вас: ${session.role}`);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/analysis/my', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        // Если токен недействителен или истек - пытаемся обновить сессию
        if (response.status === 401 || 
            (errorData.error && errorData.error.includes('token'))) {
          console.warn('Токен недействителен, пытаемся обновить сессию:', errorData.error);
          
          // Пытаемся валидировать сессию заново
          const sessionValid = await validateSession();
          if (sessionValid) {
            // Если сессия обновилась успешно, пытаемся еще раз
            console.log('Сессия обновлена, повторяем запрос анализов');
            const retryResponse = await fetch('/api/analysis/my', {
              method: 'GET',
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json',
              }
            });
            
            if (retryResponse.ok) {
              const retryData = await retryResponse.json();
              if (Array.isArray(retryData)) {
                setAnalysis(retryData);
              } else if (retryData.data && Array.isArray(retryData.data)) {
                setAnalysis(retryData.data);
              } else if (retryData.success && Array.isArray(retryData.results)) {
                setAnalysis(retryData.results);
              } else {
                setAnalysis(retryData ? [retryData] : []);
              }
              return;
            }
          }
          
          // Если обновление не помогло - считаем что анкет нет
          console.warn('Не удалось обновить сессию, считаем что анкет нет');
          const localAnalyses = readLocalAnalyses(session?.user_id);
          setAnalysis(localAnalyses);
          return;
        }
        
        throw new Error(errorData.error || `Ошибка получения анализов: ${response.status}`);
      }

      const data = await response.json();

      // ✅ Проверяем структуру ответа и устанавливаем данные
      if (Array.isArray(data)) {
        const localAnalyses = readLocalAnalyses(session?.user_id);
        const remoteIds = new Set(data.map((item: AnalysisResult) => item.id));
        const merged = [...localAnalyses.filter((item) => !remoteIds.has(item.id)), ...data];
        setAnalysis(merged);
      } else if (data.data && Array.isArray(data.data)) {
        const localAnalyses = readLocalAnalyses(session?.user_id);
        const remoteIds = new Set(data.data.map((item: AnalysisResult) => item.id));
        const merged = [...localAnalyses.filter((item) => !remoteIds.has(item.id)), ...data.data];
        setAnalysis(merged);
      } else if (data.success && Array.isArray(data.results)) {
        const localAnalyses = readLocalAnalyses(session?.user_id);
        const remoteIds = new Set(data.results.map((item: AnalysisResult) => item.id));
        const merged = [...localAnalyses.filter((item) => !remoteIds.has(item.id)), ...data.results];
        setAnalysis(merged);
      } else {
        // Если данные в другом формате, пробуем их адаптировать
        const localAnalyses = readLocalAnalyses(session?.user_id);
        setAnalysis(data ? [...localAnalyses, data] : localAnalyses);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Неизвестная ошибка при загрузке анализов';
      const localAnalyses = readLocalAnalyses(session?.user_id);
      setError(localAnalyses.length > 0 ? null : errorMessage);
      setAnalysis(localAnalyses.length > 0 ? localAnalyses : null);
      console.error('Ошибка загрузки анализов:', err);
    } finally {
      setLoading(false);
    }
  }, [hydrated, session?.isLoggedIn, session?.role, session?.user_id]);

  // ✅ Загружаем анализы когда сессия ПОЛНОСТЬЮ инициализирована
  useEffect(() => {
    if (hydrated && session?.isLoggedIn && session?.role === 'patient' && session?.user_id) {
      console.log('Загружаем анализы: сессия полностью инициализирована с user_id');
      fetchAnalysis();
    } else {
      console.log('Ждем инициализации сессии:', { 
        hydrated, 
        isLoggedIn: session?.isLoggedIn, 
        role: session?.role,
        user_id: session?.user_id ? 'есть' : 'нет'
      });
    }
  }, [hydrated, session?.isLoggedIn, session?.role, session?.user_id, fetchAnalysis]);

  const refetch = useCallback(() => {
    fetchAnalysis();
  }, [fetchAnalysis]);

  // ✅ Получить анализ по ID из уже загруженных данных
  const getAnalysisById = useCallback((id: string): AnalysisResult | null => {
    if (!analysis || !Array.isArray(analysis)) {
      return null;
    }
    
    return analysis.find(item => item.id === id) || null;
  }, [analysis]);

  // ✅ Загрузить конкретный анализ по ID (если нужны самые свежие данные)
  const fetchAnalysisById = useCallback(async (id: string): Promise<AnalysisResult | null> => {
    if (!session?.isLoggedIn) {
      throw new Error('Пользователь не авторизован');
    }

    if (session.role !== 'patient') {
      throw new Error(`Доступ запрещен. Требуется роль patient, а у вас: ${session.role}`);
    }

    try {
      // Сначала пытаемся найти в уже загруженных данных
      const existingAnalysis = getAnalysisById(id);
      if (existingAnalysis) {
        return existingAnalysis;
      }

      // Если не найден, делаем запрос для получения свежих данных
      // Обновляем все анализы и ищем нужный
      await fetchAnalysis();
      return getAnalysisById(id);
    } catch (err) {
      console.error('Ошибка загрузки анализа по ID:', err);
      return null;
    }
  }, [session?.isLoggedIn, session?.role, getAnalysisById, fetchAnalysis]);

  return {
    analysis,
    loading,
    error,
    refetch,
    getAnalysisById,
    fetchAnalysisById,
  };
}; 