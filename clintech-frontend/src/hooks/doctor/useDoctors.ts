'use client'
import { useState, useEffect, useCallback } from 'react';
import { TDoctor } from '@/types/doctors';
import { useAuth } from '@/context/AuthContext';
import { useAuthenticatedFetch } from '@/hooks/auth/useAuthenticatedFetch';

interface UseDoctorsResult {
  doctors: TDoctor[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export const useDoctors = (): UseDoctorsResult => {
  const [doctors, setDoctors] = useState<TDoctor[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isLoggedIn } = useAuth();
  const authenticatedFetch = useAuthenticatedFetch();

  const fetchDoctors = useCallback(async () => {
    if (!isLoggedIn) {
      setDoctors([]);
      setLoading(false);
      setError(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await authenticatedFetch('/api/doctors', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Ошибка получения списка врачей: ${response.status} - ${response.statusText}`);
      }

      const data = await response.json();
      
      // Обрабатываем разные форматы ответа
      if (data.success && Array.isArray(data.data)) {
        setDoctors(data.data);
      } else if (Array.isArray(data.doctors)) {
        setDoctors(data.doctors);
      } else if (data.hasOwnProperty('doctors')) {
        setDoctors([]);
      } else if (Array.isArray(data)) {
        setDoctors(data);
      } else {
        throw new Error(data.message || data.error || 'Не удалось получить список врачей');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Неизвестная ошибка';
      setError(errorMessage);
      setDoctors([]);
    } finally {
      setLoading(false);
    }
  }, [isLoggedIn, authenticatedFetch]);

  useEffect(() => {
    fetchDoctors();
  }, [fetchDoctors]);

  const refetch = useCallback(() => {
    fetchDoctors();
  }, [fetchDoctors]);

  return { doctors, loading, error, refetch };
}; 