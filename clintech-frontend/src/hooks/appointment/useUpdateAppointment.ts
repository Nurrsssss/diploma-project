import { useState, useCallback } from 'react';
import { useAuth } from '@/hooks/auth/useAuth';
import { useAuthenticatedFetch } from '@/hooks/auth/useAuthenticatedFetch';
import { TUpdateAppointmentRequest } from '@/types/appointments';

interface UseUpdateAppointmentReturn {
  isUpdating: boolean;
  error: string | null;
  updateAppointment: (appointmentId: string, data: TUpdateAppointmentRequest) => Promise<boolean>;
  clearError: () => void;
}

export const useUpdateAppointment = (): UseUpdateAppointmentReturn => {
  const { session } = useAuth();
  const authenticatedFetch = useAuthenticatedFetch();
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const updateAppointment = useCallback(async (appointmentId: string, data: TUpdateAppointmentRequest): Promise<boolean> => {
    if (!session?.isLoggedIn) {
      setError('Нет авторизации');
      return false;
    }

    try {
      setIsUpdating(true);
      setError(null);

      const response = await authenticatedFetch(`/api/appointments/${appointmentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Ошибка обновления записи: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        return true;
      } else {
        throw new Error(result.message || 'Не удалось обновить запись');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Неизвестная ошибка при обновлении записи';
      setError(errorMessage);
      return false;
    } finally {
      setIsUpdating(false);
    }
  }, [session?.isLoggedIn, authenticatedFetch]);

  return {
    isUpdating,
    error,
    updateAppointment,
    clearError
  };
}; 