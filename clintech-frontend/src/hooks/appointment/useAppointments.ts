import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/hooks/auth/useAuth';
import { useAuthenticatedFetch } from '../auth/useAuthenticatedFetch';
import { TAppointment, TUpdateAppointmentRequest } from '@/types/appointments';

interface BookingData {
  appointmentType: 'online' | 'offline';
  patientNotes?: string;
  anketaId?: string | null; // Опционально - можно записаться без анкеты
}

interface UseAppointmentsResult {
  appointments: TAppointment[];
  loading: boolean;
  error: string | null;
  isBooking: boolean;
  refetch: () => void;
  cancelAppointment: (appointmentId: string) => Promise<boolean>;
  bookAppointment: (slotId: string, data: BookingData) => Promise<boolean>;
  updateAppointment: (appointmentId: string, data: TUpdateAppointmentRequest) => Promise<boolean>;
}

interface AppointmentFilters {
  date?: string;
  startTime?: string;
  endTime?: string;
  status?: string;
}

export const useAppointments = (filters?: AppointmentFilters): UseAppointmentsResult => {
  const [appointments, setAppointments] = useState<TAppointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isBooking, setIsBooking] = useState(false);
  const { session } = useAuth();
  const authenticatedFetch = useAuthenticatedFetch();

  // Мемоизируем параметры запроса, чтобы избежать лишних пересозданий
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (filters?.date) {
      params.append('date', filters.date);
    }
    if (filters?.startTime) {
      params.append('start_date', filters.startTime);
    }
    if (filters?.endTime) {
      params.append('end_date', filters.endTime);
    }
    if (filters?.status) {
      params.append('status', filters.status);
    }
    return params.toString();
  }, [filters?.date, filters?.startTime, filters?.endTime, filters?.status]);

  const fetchAppointments = useCallback(async () => {
    if (!session?.isLoggedIn) {
      setAppointments([]);
      setLoading(false);
      setError(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Строим URL с параметрами фильтрации
      let url = '/api/appointments';
      if (queryParams) {
        url += `?${queryParams}`;
      }

      const response = await authenticatedFetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Ошибка получения записей: ${response.status}`);
      }

      const data = await response.json();

      // ✅ Проверяем структуру ответа и устанавливаем данные
      if (Array.isArray(data)) {
        setAppointments(data);
      } else if (data.success && Array.isArray(data.data)) {
        setAppointments(data.data);
      } else if (data.data && Array.isArray(data.data)) {
        setAppointments(data.data);
      } else {
        throw new Error(data.message || 'Не удалось получить записи');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Неизвестная ошибка при загрузке записей';
      setError(errorMessage);
      setAppointments([]);
      console.error('Ошибка загрузки записей:', err);
    } finally {
      setLoading(false);
    }
  }, [session?.isLoggedIn, authenticatedFetch, queryParams]);

  const cancelAppointment = useCallback(async (appointmentId: string): Promise<boolean> => {
    if (!session?.isLoggedIn) {
      setError('Нет авторизации');
      return false;
    }

    try {
      setError(null);

      const response = await authenticatedFetch(`/api/appointments/${appointmentId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Ошибка отмены записи: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        // Обновляем локальное состояние
        setAppointments(prev =>
          prev.map(appointment =>
            appointment.id === appointmentId
              ? { ...appointment, status: 'cancelled' as const }
              : appointment
          )
        );
        return true;
      } else {
        throw new Error(data.message || 'Не удалось отменить запись');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Неизвестная ошибка при отмене записи';
      setError(errorMessage);
      return false;
    }
  }, [session?.isLoggedIn, authenticatedFetch]);

  const bookAppointment = useCallback(async (slotId: string, data: BookingData): Promise<boolean> => {
    if (!session?.isLoggedIn) {
      setError('Нет авторизации');
      return false;
    }

    try {
      setIsBooking(true);
      setError(null);

      const requestBody: any = {
        appointment_type: data.appointmentType,
        patient_notes: data.patientNotes || '',
      };
      
      // Отправляем anketa_id только если он указан
      if (data.anketaId) {
        requestBody.anketa_id = data.anketaId;
      }

      const response = await authenticatedFetch(`/api/appointments/${slotId}/book`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Ошибка бронирования записи: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        // ✅ После успешного бронирования обновляем список записей
        await fetchAppointments();
        return true;
      } else {
        throw new Error(result.message || 'Не удалось забронировать запись');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Неизвестная ошибка при бронировании записи';
      setError(errorMessage);
      return false;
    } finally {
      setIsBooking(false);
    }
  }, [session?.isLoggedIn, authenticatedFetch, fetchAppointments]);

  const updateAppointment = useCallback(async (appointmentId: string, data: TUpdateAppointmentRequest): Promise<boolean> => {
    if (!session?.isLoggedIn) {
      setError('Нет авторизации');
      return false;
    }

    try {
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
        // ✅ После успешного обновления обновляем список записей
        await fetchAppointments();
        return true;
      } else {
        throw new Error(result.message || 'Не удалось обновить запись');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Неизвестная ошибка при обновлении записи';
      setError(errorMessage);
      return false;
    }
  }, [session?.isLoggedIn, authenticatedFetch, fetchAppointments]);

  // ✅ Загружаем записи когда сессия инициализирована или фильтры изменились
  useEffect(() => {
    if (session?.isLoggedIn) {
      fetchAppointments();
    }
  }, [session?.isLoggedIn, fetchAppointments]);

  const refetch = useCallback(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  return {
    appointments,
    loading,
    error,
    isBooking,
    refetch,
    cancelAppointment,
    bookAppointment,
    updateAppointment
  };
}; 