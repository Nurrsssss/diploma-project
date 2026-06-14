'use client'
import { useState } from 'react';
import { useAuthenticatedFetch } from '@/hooks/auth/useAuthenticatedFetch';

interface UseCancelAppointmentByDoctorResult {
  cancelAppointment: (appointmentId: string) => Promise<boolean>;
  loading: boolean;
  error: string | null;
}

export const useCancelAppointmentByDoctor = (): UseCancelAppointmentByDoctorResult => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const authenticatedFetch = useAuthenticatedFetch();

  const cancelAppointment = async (appointmentId: string): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      const response = await authenticatedFetch(
        `/api/appointments/${appointmentId}/cancel-by-doctor`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || `Ошибка отмены записи: ${response.status}`);
      }

      const data = await response.json();
      return data.success === true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Неизвестная ошибка';
      setError(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { cancelAppointment, loading, error };
};

