import { useCallback, useState } from 'react';

export type AppointmentType = 'online' | 'offline' | 'both';

export interface AvailableSlot {
  id: string;
  start_time: string; // ISO
  end_time: string;   // ISO
  duration_minutes: number;
  title?: string;
  appointment_type: AppointmentType;
  status?: 'available' | 'booked' | 'cancelled'; // Статус слота
}

export interface RescheduleAppointmentData {
  target_slot_id: string;
  reason?: string;
}

export function useAppointmentReschedule() {
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [rescheduleLoading, setRescheduleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  /**
   * ВАЖНО: сюда передаём ИМЕННО users.id врача (doctorUserId),
   * URL -> /api/doctors/{doctorUserId}/available-slots (как в useDoctorAvailableSlots)
   */
  const fetchAvailableSlots = useCallback(async (doctorUserId: string, date: string) => {
    setLoading(true);
    setError(null);
    try {
      // Используем тот же эндпоинт, что и в useDoctorAvailableSlots
      const url = `/api/doctors/${doctorUserId}/available-slots?date=${encodeURIComponent(date)}&include_all=1&include_booked=1&include_cancelled=1`;
      // eslint-disable-next-line no-console
      console.log('[useAppointmentReschedule] GET', url);

      const res = await fetch(url, { credentials: 'include' });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }

      // Поддержка разных форм ответа
      // Структура ответа: { success: true, data: { slots: [...] } }
      let rawSlots: any[] = [];
      
      if (Array.isArray(data)) {
        rawSlots = data;
      } else if (Array.isArray(data?.data?.slots)) {
        rawSlots = data.data.slots;  // Основной случай: data.data.slots
      } else if (Array.isArray(data?.data)) {
        rawSlots = data.data;
      } else if (Array.isArray(data?.available_slots)) {
        rawSlots = data.available_slots;
      } else if (Array.isArray(data?.slots)) {
        rawSlots = data.slots;
      }

      // eslint-disable-next-line no-console
      console.log('[useAppointmentReschedule] Raw response:', data);
      // eslint-disable-next-line no-console
      console.log('[useAppointmentReschedule] Raw slots:', rawSlots.length, rawSlots);

      // Фильтруем только доступные слоты (status === 'available')
      // Также показываем слоты без статуса (для обратной совместимости)
      const availableSlots = rawSlots.filter(slot => 
        !slot.status || slot.status === 'available'
      );

      // eslint-disable-next-line no-console
      console.log('[useAppointmentReschedule] Filtered available slots:', availableSlots.length, availableSlots);

      setAvailableSlots(availableSlots);
    } catch (e: any) {
      setAvailableSlots([]);
      setError(e?.message || 'Не удалось получить слоты');
    } finally {
      setLoading(false);
    }
  }, []);

  const rescheduleAppointment = useCallback(
    async (appointmentId: string, payload: RescheduleAppointmentData) => {
      setRescheduleLoading(true);
      setError(null);
      try {
        const url = `/api/appointments/${appointmentId}/reschedule`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload)
        });

        const result = await res.json().catch(() => null);
        if (!res.ok) {
          const msg =
            result?.error ||
            (res.status === 400 && 'Некорректные данные для переноса записи') ||
            (res.status === 403 && 'Недостаточно прав для переноса записи') ||
            (res.status === 404 && 'Запись или слот не найден') ||
            (res.status === 409 && 'Выбранный слот уже занят') ||
            `HTTP ${res.status}`;
          throw new Error(msg);
        }
        return true;
      } catch (e: any) {
        setError(e?.message || 'Ошибка переноса');
        return false;
      } finally {
        setRescheduleLoading(false);
      }
    },
    []
  );

  return {
    availableSlots,
    loading,
    rescheduleLoading,
    error,
    fetchAvailableSlots,
    rescheduleAppointment,
    clearError
  };
}
