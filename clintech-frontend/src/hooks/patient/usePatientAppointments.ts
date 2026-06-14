import { useState, useEffect } from 'react';
import { useAuthenticatedFetch } from '@/hooks/auth/useAuthenticatedFetch';

export interface PatientAppointment {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  title?: string;
  appointment_type?: string;
  doctor_id: string;
  doctor_user_id?: string;
  doctor_name?: string;
}

interface UsePatientAppointmentsResult {
  appointments: PatientAppointment[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export const usePatientAppointments = (): UsePatientAppointmentsResult => {
  const [appointments, setAppointments] = useState<PatientAppointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const authenticatedFetch = useAuthenticatedFetch();

  const load = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await authenticatedFetch('/api/appointments/my', {
        method: 'GET',
      });

      if (!res.ok) {
        throw new Error(`Ошибка загрузки приёмов: ${res.status}`);
      }

      const data = await res.json();

      const list: any[] = Array.isArray(data) ? data : data.data || [];
      setAppointments(
        list.map((item) => ({
          id: String(item.id ?? item.appointment_id ?? ''),
          start_time: item.start_time,
          end_time: item.end_time,
          status: item.status,
          title: item.title,
          appointment_type: item.appointment_type,
            doctor_id: String(item.doctor_id ?? ''),
            doctor_user_id: item.doctor_user_id ? String(item.doctor_user_id) : undefined,
          doctor_name: item.doctor_name || item.doctor_full_name,
        })),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить приёмы');
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { appointments, loading, error, refetch: load };
};

