import { useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { TDoctorSchedule } from '@/types/doctorShedules';
import { TScheduleFormValues } from '@/types/calendar';
import { useAuthenticatedFetch } from '../auth/useAuthenticatedFetch';
import { extractApiError, processError } from '@/utils/errorUtils';

interface UseDoctorSchedulesResult {
  schedules: TDoctorSchedule[];
  loading: boolean;
  error: string | null;

  creating: boolean;
  updating: boolean;
  deleting: boolean;
  toggling: boolean;

  fetchSchedules: (specialistId?: string) => Promise<void>;

  createSchedule: (schedule: TScheduleFormValues, targetDoctorUserId?: string) => Promise<boolean>;
  updateSchedule: (scheduleId: string, schedule: TDoctorSchedule, targetDoctorUserId?: string) => Promise<boolean>;
  deleteSchedule: (scheduleId: string, targetDoctorUserId?: string) => Promise<boolean>;
  toggleSchedule: (scheduleId: string, targetDoctorUserId?: string) => Promise<boolean>;

  clearError: () => void;
  refetch: () => void;
}

export const useDoctorSchedules = (): UseDoctorSchedulesResult => {
  const { session, hydrated } = useAuth();
  const authenticatedFetch = useAuthenticatedFetch();

  const [schedules, setSchedules] = useState<TDoctorSchedule[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [lastSpecialistId, setLastSpecialistId] = useState<string | undefined>(undefined);

  const [creating, setCreating] = useState<boolean>(false);
  const [updating, setUpdating] = useState<boolean>(false);
  const [deleting, setDeleting] = useState<boolean>(false);
  const [toggling, setToggling] = useState<boolean>(false);

  const buildUrl = (base: string, targetDoctorUserId?: string) => {
    const params = new URLSearchParams();

    if (targetDoctorUserId) {
      // ✅ бэк может ожидать любой из вариантов
      params.set('doctor_user_id', targetDoctorUserId);
      params.set('specialist_id', targetDoctorUserId);
    }

    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  };

  const withTargetInBody = <T extends Record<string, any>>(body: T, targetDoctorUserId?: string): T => {
    if (!targetDoctorUserId) return body;
    return {
      ...body,
      doctor_user_id: targetDoctorUserId,
      specialist_id: targetDoctorUserId,
    };
  };

  const fetchSchedules = useCallback(
    async (specialistId?: string) => {
      if (!hydrated || !session?.user_id) {
        setLoading(false);
        setError(null);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        if (specialistId) setLastSpecialistId(specialistId);

        let url = '/api/appointments/schedules';
        if (specialistId) {
          url += `?specialist_id=${encodeURIComponent(specialistId)}`;
        }

        const response = await authenticatedFetch(url, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
          throw new Error(`Ошибка получения расписаний: ${response.status}`);
        }

        const data = await response.json();

        if (data.success && Array.isArray(data.data)) {
          setSchedules(data.data);
        } else {
          throw new Error(data.message || 'Не удалось получить расписания');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
        setSchedules([]);
      } finally {
        setLoading(false);
      }
    },
    [authenticatedFetch, session?.user_id, hydrated]
  );

  const createSchedule = useCallback(
    async (schedule: TScheduleFormValues, targetDoctorUserId?: string): Promise<boolean> => {
      if (!session?.user_id) {
        setError('Нет токена авторизации');
        return false;
      }

      try {
        setCreating(true);
        setError(null);

        const url = buildUrl('/api/appointments/schedules', targetDoctorUserId);
        const body = withTargetInBody(schedule as any, targetDoctorUserId);

        const response = await authenticatedFetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errorClone = response.clone();
          const errorData = await errorClone.json().catch(() => ({}));
          const apiMessage = typeof errorData?.error === 'string'
            ? errorData.error
            : typeof errorData?.message === 'string'
              ? errorData.message
              : await extractApiError(response.clone()).catch(() => '');

          if (errorData?.error?.includes('already exists')) {
            setError(
              'Обнаружены конфликтующие слоты. Выберите другой период или удалите существующие слоты перед созданием.'
            );
            return false;
          }

          const errorMessage = processError(response, {
            400: 'Некорректные данные. Проверьте заполнение формы.',
            401: 'Ошибка авторизации. Войдите заново.',
            403: apiMessage || errorData?.error || 'Недостаточно прав',
            500: 'Техническая ошибка сервера. Попробуйте позже.',
            default: 'Произошла ошибка при создании расписания',
          });
          setError(apiMessage && apiMessage !== `Ошибка ${response.status}` ? apiMessage : errorMessage);
          return false;
        }

        const data = await response.json();

        if (data.success) {
          await fetchSchedules(targetDoctorUserId || session?.user_id || lastSpecialistId);
          return true;
        }

        setError(data.message || 'Не удалось создать расписание');
        return false;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
        return false;
      } finally {
        setCreating(false);
      }
    },
    [authenticatedFetch, fetchSchedules, lastSpecialistId, session?.user_id]
  );

  const updateSchedule = useCallback(
    async (scheduleId: string, schedule: TDoctorSchedule, targetDoctorUserId?: string): Promise<boolean> => {
      if (!session?.user_id) {
        setError('Нет токена авторизации');
        return false;
      }

      try {
        setUpdating(true);
        setError(null);

        const url = buildUrl(`/api/appointments/schedules/${scheduleId}`, targetDoctorUserId);
        const body = withTargetInBody(schedule as any, targetDoctorUserId);

        const response = await authenticatedFetch(url, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errorClone = response.clone();
          const errorData = await errorClone.json().catch(() => ({}));
          const apiMessage = typeof errorData?.error === 'string'
            ? errorData.error
            : typeof errorData?.message === 'string'
              ? errorData.message
              : await extractApiError(response.clone()).catch(() => '');
          const errorMessage = processError(response, {
            400: 'Некорректные данные. Проверьте заполнение формы.',
            401: 'Ошибка авторизации. Войдите заново.',
            403: apiMessage || errorData?.error || 'Недостаточно прав',
            500: 'Техническая ошибка сервера. Попробуйте позже.',
            default: 'Произошла ошибка при обновлении расписания',
          });
          setError(apiMessage && apiMessage !== `Ошибка ${response.status}` ? apiMessage : errorMessage);
          return false;
        }

        const data = await response.json();
        if (data.success) {
          await fetchSchedules(targetDoctorUserId || session?.user_id || lastSpecialistId);
          return true;
        }

        setError(data.message || 'Не удалось обновить расписание');
        return false;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
        return false;
      } finally {
        setUpdating(false);
      }
    },
    [authenticatedFetch, fetchSchedules, lastSpecialistId, session?.user_id]
  );

  const deleteSchedule = useCallback(
    async (scheduleId: string, targetDoctorUserId?: string): Promise<boolean> => {
      if (!session?.user_id) {
        setError('Нет токена авторизации');
        return false;
      }

      try {
        setDeleting(true);
        setError(null);

        const url = buildUrl(`/api/appointments/schedules/${scheduleId}`, targetDoctorUserId);

        const response = await authenticatedFetch(url, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          setError(errorData?.error || `Ошибка удаления расписания: ${response.status}`);
          return false;
        }

        const data = await response.json();
        if (!data.success) {
          setError(data.message || 'Не удалось удалить расписание');
          return false;
        }

        await fetchSchedules(targetDoctorUserId || session?.user_id || lastSpecialistId);
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
        return false;
      } finally {
        setDeleting(false);
      }
    },
    [authenticatedFetch, fetchSchedules, lastSpecialistId, session?.user_id]
  );

  const toggleSchedule = useCallback(
    async (scheduleId: string, targetDoctorUserId?: string): Promise<boolean> => {
      if (!session?.user_id) {
        setError('Нет токена авторизации');
        return false;
      }

      try {
        setToggling(true);
        setError(null);

        const url = buildUrl(`/api/appointments/schedules/${scheduleId}/toggle`, targetDoctorUserId);

        const response = await authenticatedFetch(url, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          setError(errorData?.error || `Ошибка переключения: ${response.status}`);
          return false;
        }

        const data = await response.json();
        if (data.success) {
          await fetchSchedules(targetDoctorUserId || session?.user_id || lastSpecialistId);
          return true;
        }

        setError(data.message || 'Не удалось переключить расписание');
        return false;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
        return false;
      } finally {
        setToggling(false);
      }
    },
    [authenticatedFetch, fetchSchedules, lastSpecialistId, session?.user_id]
  );

  const refetch = useCallback(() => {
    if (lastSpecialistId) fetchSchedules(lastSpecialistId);
  }, [fetchSchedules, lastSpecialistId]);

  const clearError = useCallback(() => setError(null), []);

  return {
    schedules,
    loading,
    error,

    creating,
    updating,
    deleting,
    toggling,

    fetchSchedules,
    createSchedule,
    updateSchedule,
    deleteSchedule,
    toggleSchedule,

    clearError,
    refetch,
  };
};
