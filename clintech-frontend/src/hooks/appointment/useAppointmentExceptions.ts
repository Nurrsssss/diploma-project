import { useState, useCallback } from 'react';

export interface AppointmentException {
  id: string;
  doctor_id: string;
  date: string;
  type: 'day_off' | 'custom_hours' | 'closed_hours';
  reason: string;
  custom_start_time?: string;
  custom_end_time?: string;
  start?: string;
  end?: string;
  created_at: string;
}

export interface CreateExceptionData {
  type: 'day_off' | 'custom_hours' | 'closed_hours';
  date?: string;
  start?: string;
  end?: string;
  custom_start_time?: string;
  custom_end_time?: string;
  reason: string;
  doctor_user_id?: string; // ✅ важно для reception
}

export interface UseAppointmentExceptionsReturn {
  exceptions: AppointmentException[];
  loading: boolean;
  error: string | null;

  fetchExceptions: (startDate?: string, endDate?: string, doctorUserId?: string) => Promise<void>;
  createException: (data: CreateExceptionData, doctorUserId?: string) => Promise<boolean>;
  deleteException: (id: string, doctorUserId?: string) => Promise<boolean>;
  clearError: () => void;
}

export const useAppointmentExceptions = (): UseAppointmentExceptionsReturn => {
  const [exceptions, setExceptions] = useState<AppointmentException[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const fetchExceptions = useCallback(async (startDate?: string, endDate?: string, doctorUserId?: string) => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (startDate) params.set('start_date', startDate);
      if (endDate) params.set('end_date', endDate);
      if (doctorUserId) params.set('doctor_user_id', doctorUserId); // ✅

      const response = await fetch(`/api/appointments/exceptions?${params.toString()}`, {
        method: 'GET',
        credentials: 'include',
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setExceptions(data.data || []);
      } else {
        setError(data.error || 'Ошибка при получении закрытий');
      }
    } catch {
      setError('Ошибка соединения с сервером');
    } finally {
      setLoading(false);
    }
  }, []);

  const createException = useCallback(async (data: CreateExceptionData, doctorUserId?: string): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      const payload: CreateExceptionData = { ...data };

      // ✅ для reception всегда передаем doctor_user_id
      if (doctorUserId) payload.doctor_user_id = doctorUserId;

      const response = await fetch('/api/appointments/exceptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        return true;
      } else {
        setError(result.error || 'Ошибка при создании закрытия');
        return false;
      }
    } catch {
      setError('Ошибка соединения с сервером');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteException = useCallback(async (id: string, doctorUserId?: string): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (doctorUserId) params.set('doctor_user_id', doctorUserId);

      const url = params.toString()
        ? `/api/appointments/exceptions/${id}?${params.toString()}`
        : `/api/appointments/exceptions/${id}`;

      const response = await fetch(url, {
        method: 'DELETE',
        credentials: 'include',
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setExceptions((prev) => prev.filter((e) => e.id !== id));
        return true;
      } else {
        setError(data.error || 'Ошибка при удалении закрытия');
        return false;
      }
    } catch {
      setError('Ошибка соединения с сервером');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    exceptions,
    loading,
    error,
    fetchExceptions,
    createException,
    deleteException,
    clearError,
  };
};
