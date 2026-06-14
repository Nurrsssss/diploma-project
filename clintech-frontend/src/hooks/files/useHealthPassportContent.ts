import { useState, useCallback } from 'react';
import { useAuthenticatedFetch } from '@/hooks/auth/useAuthenticatedFetch';

export interface HealthPassportContent {
  patient: {
    id: string;
    first_name: string;
    middle_name?: string;
    last_name: string;
    birth_date: string;
    age: number;
    gender: string;
    iin?: string;
    phone?: string;
    email?: string;
    address?: string;
    height?: number;
    weight?: number;
    bmi?: number;
    chronic_diseases?: string[];
    allergies?: string[];
    diets?: string[];
  };
  doctor: {
    id: string;
    first_name: string;
    middle_name?: string;
    last_name: string;
    roles: string[];
    email?: string;
    phone?: string;
    description?: string;
  };
  complaints: string;
  medical_history: string;
  chronic_diseases: string;
  family_history: string;
  medications: string;
  lifestyle: string;
  diets_allergies: string;
  diagnoses: string;
  files_analysis: string;
  observation_plan: string;
  general_conclusion: string;
  generated_at: string;
}

interface UseHealthPassportContentReturn {
  content: HealthPassportContent | null;
  loading: boolean;
  error: string | null;
  updateContent: (passportId: string, updates: Partial<HealthPassportContent>) => Promise<boolean>;
  fetchContent: (passportId: string) => Promise<boolean>;
  clearError: () => void;
}

export const useHealthPassportContent = (): UseHealthPassportContentReturn => {
  const [content, setContent] = useState<HealthPassportContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const authenticatedFetch = useAuthenticatedFetch();

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const fetchContent = useCallback(async (passportId: string): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      const response = await authenticatedFetch(`/api/health-passport/${passportId}/content`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`Ошибка получения содержимого паспорта: ${response.status}`);
      }

      const data = await response.json();
      // API возвращает объект с полем content, извлекаем его
      setContent(data);
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Ошибка при получении содержимого паспорта здоровья';
      console.error('useHealthPassportContent: Error:', err);
      setError(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, [authenticatedFetch]);

  const updateContent = useCallback(async (passportId: string, updates: Partial<HealthPassportContent>): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      const response = await authenticatedFetch(`/api/health-passport/${passportId}/content`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        throw new Error(`Ошибка обновления паспорта: ${response.status}`);
      }

      const updatedData = await response.json();
      // API возвращает объект с полем content, извлекаем его
      setContent(updatedData.content);
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Ошибка при обновлении паспорта здоровья';
      console.error('useHealthPassportContent: Update error:', err);
      setError(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, [authenticatedFetch]);

  return {
    content,
    loading,
    error,
    updateContent,
    fetchContent,
    clearError
  };
}; 