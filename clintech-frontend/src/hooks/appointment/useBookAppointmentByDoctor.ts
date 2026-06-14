'use client';

import { useState } from 'react';
import { useAuthenticatedFetch } from '@/hooks/auth/useAuthenticatedFetch';

interface BookAppointmentByDoctorParams {
  appointmentId: string;
  patientId: string;

  channel?: 'cabinet' | 'home' | 'online' | 'lab';
  cabinetNumber?: number;

  appointmentType?: 'offline' | 'online';
  patientNotes?: string;
  anketaId?: string;

  // ✅ новые поля
  serviceId?: string;

  // если хочешь прокидывать (не обязательно)
  doctorUserId?: string;

  // ✅ для бронирования диапазона
  durationMinutes?: number; // например 30
  blocks?: number; // например 2 (если 1 блок = 15 минут)

  // на будущее, если добавишь кабинеты/ресурсы
  resourceId?: string;
}

interface UseBookAppointmentByDoctorResult {
  bookAppointment: (params: BookAppointmentByDoctorParams) => Promise<any>;
  loading: boolean;
  error: string | null;
}

export const useBookAppointmentByDoctor = (): UseBookAppointmentByDoctorResult => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const authenticatedFetch = useAuthenticatedFetch();

  const bookAppointment = async (params: BookAppointmentByDoctorParams) => {
    try {
      setLoading(true);
      setError(null);

      const body: any = {
        patient_id: params.patientId,
      };

      if (params.appointmentType) body.appointment_type = params.appointmentType;
      if (params.patientNotes) body.patient_notes = params.patientNotes;
      if (params.anketaId) body.anketa_id = params.anketaId;

      if (params.channel) body.channel = params.channel;
      if (typeof params.cabinetNumber === 'number') body.cabinet_number = params.cabinetNumber;

      // ✅ новые поля
      if (params.serviceId) body.service_id = params.serviceId;

      // не обязательно, но можно оставить
      if (params.doctorUserId) body.doctor_user_id = params.doctorUserId;

      // ✅ бронирование диапазона
      if (typeof params.durationMinutes === 'number' && params.durationMinutes > 0) {
        body.duration_minutes = params.durationMinutes;
      }
      if (typeof params.blocks === 'number' && params.blocks > 0) {
        body.blocks = params.blocks;
      }

      if (params.resourceId) body.resource_id = params.resourceId;

      const response = await authenticatedFetch(`/api/appointments/${params.appointmentId}/book-by-doctor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const json = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(json?.message || json?.error || `Ошибка записи: ${response.status}`);
      }

      return json?.success ? json?.data : json;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Неизвестная ошибка';
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { bookAppointment, loading, error };
};