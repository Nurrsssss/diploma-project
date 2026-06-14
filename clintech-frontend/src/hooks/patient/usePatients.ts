'use client'
import { useState, useEffect, useCallback } from 'react';
import { TPatient } from '@/types/patient';
import { useAuth } from '@/context/AuthContext';
import { useAuthenticatedFetch } from '@/hooks/auth/useAuthenticatedFetch';

interface UsePatientsResult {
  patients: TPatient[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export const usePatients = (): UsePatientsResult => {
  const [patients, setPatients] = useState<TPatient[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isLoggedIn } = useAuth();
  const authenticatedFetch = useAuthenticatedFetch();

  const fetchPatients = useCallback(async () => {
    if (!isLoggedIn) {
      setPatients([]);
      setLoading(false);
      setError(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await authenticatedFetch('/api/patients', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Ошибка получения списка пациентов: ${response.status} - ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success && Array.isArray(data.data)) {
        setPatients(data.data);
      } else if (Array.isArray(data.patients)) {
        setPatients(data.patients);
      } else if (Array.isArray(data)) {
        setPatients(data);
      } else {
        throw new Error(data.message || data.error || 'Не удалось получить список пациентов');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Неизвестная ошибка';
      setError(errorMessage);
      setPatients([]);
    } finally {
      setLoading(false);
    }
  }, [isLoggedIn, authenticatedFetch]);

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  const refetch = useCallback(() => {
    fetchPatients();
  }, [fetchPatients]);

  return { patients, loading, error, refetch };
};
