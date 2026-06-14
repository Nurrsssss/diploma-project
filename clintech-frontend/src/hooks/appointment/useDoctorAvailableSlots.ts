'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuthenticatedFetch } from '@/hooks/auth/useAuthenticatedFetch';

export type SlotStatus = 'available' | 'booked' | 'blocked' | 'cancelled';

export interface DoctorSlot {
  id: string; // slot id
  appointment_id?: string; // appointment id для booked

  // ✅ ВАЖНО: кому принадлежит слот (чтобы ограничивать действия)
  doctor_user_id?: string;

  start_time: string;
  end_time: string;
  duration_minutes: number;
  status: SlotStatus;
  appointment_type?: 'online' | 'offline' | 'both';
  title?: string;
  patient_id?: string;
  booked_at?: string;

  start_hhmm: string;
  end_hhmm: string;

  patient?: {
    id: string;
    user_id: string;
    first_name?: string;
    last_name?: string;
    middle_name?: string;
    email?: string;
    phone?: string;
  } | null;
}

interface UseSlotsOptions {
  date: string;
  includeAll?: boolean; // ✅ смысл: показывать слоты всех врачей
  includeBooked?: boolean;
  includeCancelled?: boolean;
}

interface UseSlotsResult {
  slots: DoctorSlot[];
  loading: boolean;
  error: string | null;
  schedule?: any;
  period?: any;
  summary?: { total_slots: number; available_slots: number; booked_slots: number; canceled_slots: number };
  refetch: () => void;
}

function hhmmFromIso(s: string): string {
  const m = s.match(/T(\d{2}):(\d{2})/);
  if (m) return `${m[1]}:${m[2]}`;
  const m2 = s.match(/^(\d{2}):(\d{2})/);
  if (m2) return `${m2[1]}:${m2[2]}`;
  return s;
}

/**
 * doctorUserId теперь опциональный:
 * - includeAll=true => можно вызывать без doctorUserId (режим "вижу всех")
 * - includeAll=false => doctorUserId обязателен (режим "только мой график")
 */
export function useDoctorAvailableSlots(
  doctorUserId: string | null,
  { date, includeAll = false, includeBooked = true, includeCancelled = true }: UseSlotsOptions
): UseSlotsResult {
  const [slots, setSlots] = useState<DoctorSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<any>();
  const [period, setPeriod] = useState<any>();
  const [summary, setSummary] = useState<any>();
  const authenticatedFetch = useAuthenticatedFetch();

  const patientCache = useRef<Map<string, DoctorSlot['patient']>>(new Map());

  const paramsStr = useMemo(() => {
    const params = new URLSearchParams();
    params.set('date', date);
    if (includeAll) params.set('include_all', '1');
    if (includeBooked) params.set('include_booked', '1');
    if (includeCancelled) params.set('include_cancelled', '0');
    return params.toString();
  }, [date, includeAll, includeBooked, includeCancelled]);

  /**
   * ✅ Список кандидатов эндпоинтов.
   * 1) общий (для всех врачей) — ты должен выбрать тот, который реально существует на бэке
   * 2) старый пер-врачевой (fallback)
   *
   * Сделано так, чтобы у тебя сразу “завелось” после того, как ты добавишь/подключишь общий эндпоинт.
   */
  const endpointCandidates = useMemo(() => {
    const common = [
      `/api/doctors/available-slots?${paramsStr}`,          // вариант A
      `/api/available-slots?${paramsStr}`,                 // вариант B
      `/api/appointments/available-slots?${paramsStr}`,    // вариант C
      `/api/slots/available?${paramsStr}`,                 // вариант D
    ];

    const perDoctor =
      doctorUserId
        ? [`/api/doctors/${doctorUserId}/available-slots?${paramsStr}`]
        : [];

    return includeAll ? [...common, ...perDoctor] : perDoctor;
  }, [includeAll, doctorUserId, paramsStr]);

  const fetchPatient = useCallback(
    async (userId: string) => {
      if (patientCache.current.has(userId)) return patientCache.current.get(userId)!;
      try {
        const res = await authenticatedFetch(`/api/users/${userId}/patient`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        const raw = data?.data ?? data ?? null;
        const brief = raw
          ? {
              id: raw.id,
              user_id: raw.user_id,
              first_name: raw.first_name,
              last_name: raw.last_name,
              middle_name: raw.middle_name,
              email: raw.email,
              phone: raw.phone,
            }
          : null;
        patientCache.current.set(userId, brief);
        return brief;
      } catch {
        patientCache.current.set(userId, null);
        return null;
      }
    },
    [authenticatedFetch]
  );

  const normalize = useCallback(
    async (raw: any[]): Promise<DoctorSlot[]> => {
      const sorted = raw.slice().sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)));

      const base: DoctorSlot[] = sorted.map((s) => ({
        id: String(s.id),
        appointment_id: s.appointment_id ?? s.appointmentId ?? s.appointment?.id ?? undefined,

        // ✅ пробуем вытащить принадлежность слота врачу из разных возможных полей
        doctor_user_id:
          s.doctor_user_id ??
          s.doctorUserId ??
          s.doctor_id ??
          s.doctor?.user_id ??
          s.doctor?.id ??
          undefined,

        start_time: s.start_time,
        end_time: s.end_time,
        duration_minutes: s.duration_minutes,
        status: s.status,
        appointment_type: s.appointment_type,
        title: s.title,
        patient_id: s.patient_id,
        booked_at: s.booked_at,
        start_hhmm: s.start_time ? hhmmFromIso(s.start_time) : '',
        end_hhmm: s.end_time ? hhmmFromIso(s.end_time) : '',
      }));

      const userIds = Array.from(
        new Set(base.filter((x) => x.status === 'booked' && x.patient_id).map((x) => x.patient_id as string))
      );
      await Promise.all(userIds.map((id) => fetchPatient(id)));

      return base.map((s) => (s.patient_id ? { ...s, patient: patientCache.current.get(s.patient_id) ?? null } : s));
    },
    [fetchPatient]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      if (!includeAll && !doctorUserId) {
        throw new Error('doctorUserId is required when includeAll=false');
      }

      let res: Response | null = null;
      let lastErr: any = null;

      // ✅ пробуем кандидаты по очереди, пока не найдём рабочий общий эндпоинт
      for (const url of endpointCandidates) {
        try {
          const r = await authenticatedFetch(url, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          });
          if (r.ok) {
            res = r;
            break;
          }
          lastErr = new Error(`HTTP ${r.status} for ${url}`);
        } catch (e: any) {
          lastErr = e;
        }
      }

      if (!res) throw lastErr ?? new Error('No endpoint matched');

      const json = await res.json();
      const payload = json?.data ?? json ?? {};
      const norm = await normalize(payload.slots ?? []);
      setSlots(norm);
      setSchedule(payload.schedule);
      setPeriod(payload.period);
      setSummary(payload.summary);
    } catch (e: any) {
      setError(e?.message ?? 'Не удалось загрузить слоты');
      setSlots([]);
    } finally {
      setLoading(false);
    }
  }, [authenticatedFetch, endpointCandidates, includeAll, doctorUserId, normalize]);

  useEffect(() => {
    load();
  }, [load]);

  return { slots, loading, error, schedule, period, summary, refetch: load };
}