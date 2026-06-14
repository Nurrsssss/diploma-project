'use client'
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useAuthenticatedFetch } from '../auth/useAuthenticatedFetch';

const LOCAL_ANALYSIS_STORAGE_KEY_PREFIX = 'patientAnalyses';

const getLocalAnalysisStorageKey = (userId?: string | null) => {
  const normalizedUserId = String(userId || '').trim();
  return normalizedUserId
    ? `${LOCAL_ANALYSIS_STORAGE_KEY_PREFIX}:${normalizedUserId}`
    : LOCAL_ANALYSIS_STORAGE_KEY_PREFIX;
};

// Тип для анкеты пациента
export interface PatientQuestionnaire {
  id: string;
  user_id: string;
  created_at: string;
  answers: Record<string, any>;
  recommendations?: string;
  files: string[];
  health_passport_pdf?: string;
  health_survey_pdf?: string;
  transcription_text?: string;
  owner_user_id?: string | null;
}

const readLocalQuestionnaires = (userId?: string | null): PatientQuestionnaire[] => {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = localStorage.getItem(getLocalAnalysisStorageKey(userId));
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    const normalizedUserId = String(userId || '').trim();

    return parsed.filter((item) => {
      if (!item || typeof item !== 'object') {
        return false;
      }

      const ownerUserId = String(item.owner_user_id ?? '').trim();
      return !normalizedUserId || !ownerUserId || ownerUserId === normalizedUserId;
    });
  } catch (error) {
    console.error('Ошибка чтения локальных анкет:', error);
    return [];
  }
};

interface UseQuestionnairesResult {
  questionnaires: PatientQuestionnaire[] | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export const useQuestionnaires = (patientUserId?: string | null): UseQuestionnairesResult => {
  const [questionnaires, setQuestionnaires] = useState<PatientQuestionnaire[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { session } = useAuth();
  const authenticatedFetch = useAuthenticatedFetch();

  const fetchQuestionnaires = useCallback(async () => {
    // Проверяем авторизацию
    if (!session?.isLoggedIn) {
      setQuestionnaires([]);
      setLoading(false);
      setError(null);
      return;
    }

    // Получаем роль пользователя
    const role = session?.role;
    let url: string | null = null;

    if (role === 'patient') {
      url = '/api/analysis/my';
    } else if (role === 'doctor' || role === 'reception') {
      if (patientUserId) {
        url = `/api/doctor/analysis/${patientUserId}`;
      } else {
        setQuestionnaires([]);
        setLoading(false);
        setError(null);
        return;
      }
    } else {
      // Неизвестная роль или не определена
      setQuestionnaires([]);
      setLoading(false);
      setError(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await authenticatedFetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        if (role === 'patient' || role === 'doctor' || role === 'reception') {
          const localQuestionnaires = readLocalQuestionnaires(
            role === 'patient' ? session?.user_id : patientUserId
          );
          if (localQuestionnaires.length > 0) {
            setQuestionnaires(localQuestionnaires);
            setError(null);
            return;
          }
        }

        throw new Error(
          errorData.error ||
          `Ошибка получения анкет: ${response.status} - ${response.statusText}`
        );
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      // Если данные корректны, сохраняем их
      if (Array.isArray(data)) {
        const localQuestionnaires = role === 'patient'
          ? readLocalQuestionnaires(session?.user_id)
          : (role === 'doctor' || role === 'reception')
            ? readLocalQuestionnaires(patientUserId)
          : [];
        const remoteIds = new Set(data.map((item: PatientQuestionnaire) => item.id));
        const merged = [
          ...localQuestionnaires.filter((item) => !remoteIds.has(item.id)),
          ...data,
        ];
        setQuestionnaires(merged);
      } else {
        const localQuestionnaires = role === 'patient'
          ? readLocalQuestionnaires(session?.user_id)
          : (role === 'doctor' || role === 'reception')
            ? readLocalQuestionnaires(patientUserId)
          : [];
        setQuestionnaires(localQuestionnaires);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Неизвестная ошибка при загрузке анкет';
      const localQuestionnaires = role === 'patient'
        ? readLocalQuestionnaires(session?.user_id)
        : (role === 'doctor' || role === 'reception')
          ? readLocalQuestionnaires(patientUserId)
        : [];
      setError(localQuestionnaires.length > 0 ? null : errorMessage);
      setQuestionnaires(localQuestionnaires);
    } finally {
      setLoading(false);
    }
  }, [authenticatedFetch, patientUserId, session?.isLoggedIn, session?.role, session?.user_id]);

  useEffect(() => {
    fetchQuestionnaires();
  }, [fetchQuestionnaires]);

  const refetch = useCallback(() => {
    fetchQuestionnaires();
  }, [fetchQuestionnaires]);

  return {
    questionnaires,
    loading,
    error,
    refetch
  };
}; 