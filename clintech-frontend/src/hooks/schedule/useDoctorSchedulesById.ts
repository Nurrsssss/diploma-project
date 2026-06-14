'use client'
import { useState, useEffect, useCallback } from 'react';
import { TDoctorSchedule } from '@/types/doctorShedules';
import { useAuthenticatedFetch } from '@/hooks/auth/useAuthenticatedFetch';

interface UseDoctorSchedulesByIdResult {
  schedules: TDoctorSchedule[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export const useDoctorSchedulesById = (doctorId: string | null): UseDoctorSchedulesByIdResult => {
  const [schedules, setSchedules] = useState<TDoctorSchedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const authenticatedFetch = useAuthenticatedFetch();

  const fetchSchedules = useCallback(async () => {
    if (!doctorId) {
      setSchedules([]);
      setLoading(false);
      setError(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await authenticatedFetch(`/api/appointments/doctors/${doctorId}/schedules`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Ошибка получения расписаний: ${response.status} - ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success && Array.isArray(data.data)) {
        setSchedules(data.data);
      } else if (Array.isArray(data)) {
        setSchedules(data);
      } else {
        throw new Error(data.message || data.error || 'Не удалось получить расписания');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Неизвестная ошибка';
      setError(errorMessage);
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  }, [doctorId, authenticatedFetch]);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  const refetch = useCallback(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  return { schedules, loading, error, refetch };
};
