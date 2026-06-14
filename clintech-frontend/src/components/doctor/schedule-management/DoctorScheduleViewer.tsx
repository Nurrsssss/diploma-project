// 'use client';

// import { useMemo, useState } from 'react';
// import { useRouter } from 'next/navigation';

// import { TPatient } from '@/types/patient';
// import { useDoctorAvailableSlots } from '@/hooks/appointment/useDoctorAvailableSlots';
// import { ScheduleCalendar } from './ScheduleCalendar';
// import { BookingModal, ResourceDef } from './BookingModal';
// import { useCancelAppointmentByDoctor } from '@/hooks/appointment/useCancelAppointmentByDoctor';

// // простые форматтеры без библиотек
// function pad2(n: number) {
//   return n < 10 ? `0${n}` : `${n}`;
// }
// function ymd(d: Date) {
//   return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
// }
// function headerRu(d: Date) {
//   const months = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
//   return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
// }

// interface DoctorScheduleViewerProps {
//   doctorUserId: string; // users.id врача
//   patients: TPatient[];
// }

// const DEFAULT_RESOURCE: ResourceDef = {
//   key: 'cabinet-1',
//   title: 'Кабинет 1',
//   channel: 'cabinet',
//   cabinetNumber: 1
// };

// export const DoctorScheduleViewer = ({ doctorUserId, patients }: DoctorScheduleViewerProps) => {
//   const [selectedDate, setSelectedDate] = useState<Date>(new Date());
//   const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
//   const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
//   const router = useRouter();

//   const formattedDate = useMemo(() => ymd(selectedDate), [selectedDate]);

//   const { slots, loading, error, refetch } = useDoctorAvailableSlots(doctorUserId, {
//     date: formattedDate,
//     includeAll: true,
//     includeBooked: true,
//     includeCancelled: true
//   });

//   const { cancelAppointment, loading: cancelLoading } = useCancelAppointmentByDoctor();

//   const selectedSlot = slots.find((s) => s.id === selectedSlotId) ?? null;

//   const handleSlotClick = (slotId: string) => {
//     const slot = slots.find((s) => s.id === slotId);
//     if (!slot) return;

//     if (slot.status === 'booked') {
//       const url = `/doctor/my-appointments/${encodeURIComponent(slot.id)}?date=${encodeURIComponent(
//         formattedDate
//       )}&start_time=${encodeURIComponent(slot.start_time)}&end_time=${encodeURIComponent(slot.end_time)}`;
//       router.push(url);
//       return;
//     }

//     if (slot.status === 'available') {
//       setSelectedSlotId(slotId);
//       setIsBookingModalOpen(true);
//     }
//   };

//   const handleCancelSlot = async (slotId: string) => {
//     const success = await cancelAppointment(slotId);
//     if (success) refetch();
//   };

//   const handleBookingSuccess = () => {
//     setIsBookingModalOpen(false);
//     setSelectedSlotId(null);
//     refetch();
//   };

//   return (
//     <div className="bg-white rounded-xl shadow-sm">
//       <div className="p-6 border-b border-gray-200">
//         <h2 className="text-xl font-semibold text-gray-900">Расписание на {headerRu(selectedDate)}</h2>
//       </div>

//       <div className="p-6">
//         <ScheduleCalendar
//           selectedDate={selectedDate}
//           onDateChange={setSelectedDate}
//           slots={slots}
//           loading={loading || cancelLoading}
//           error={error}
//           onSlotClick={handleSlotClick}
//           onCancelSlot={handleCancelSlot}
//         />
//       </div>

//       {selectedSlot && selectedSlot.status === 'available' && (
//         <BookingModal
//           isOpen={isBookingModalOpen}
//           onClose={() => {
//             setIsBookingModalOpen(false);
//             setSelectedSlotId(null);
//           }}
//           slot={selectedSlot as any}
//           resource={DEFAULT_RESOURCE}
//           patients={patients}
//           doctors={[]} // врачу список врачей не нужен
//           viewerUserId={doctorUserId}
//           isReception={false}
//           onSuccess={handleBookingSuccess}
//         />
//       )}
//     </div>
//   );
// };
'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { TDoctor } from '@/types/doctors';
import { TPatient } from '@/types/patient';

import { useAuthenticatedFetch } from '@/hooks/auth/useAuthenticatedFetch';
import { useCancelAppointmentByDoctor } from '@/hooks/appointment/useCancelAppointmentByDoctor';

import { ScheduleCalendar } from './ScheduleCalendar';
import { BookingModal, ResourceDef } from './BookingModal';

type SlotStatus = 'available' | 'booked' | 'blocked' | 'cancelled' | 'completed';

type DoctorSlot = {
  id: string;
  doctor_id: string;
  doctor_user_id: string;

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

  cabinet_number?: number | null;
  channel?: 'cabinet' | 'home' | 'online' | 'lab' | null;
  service_id?: string | null;

  patient?: {
    id: string;
    user_id: string;
    first_name?: string;
    last_name?: string;
    middle_name?: string;
    email?: string;
    phone?: string;
  } | null;

  resource_key?: string;
};

// utils
function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}
function ymd(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function headerRu(d: Date) {
  const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

// TIMEZONE Алматы
const ALMATY_OFFSET_MIN = 5 * 60;

function parseToUtcMsStable(s: string): number {
  if (!s) return NaN;
  const hasTz = /([zZ]|[+\-]\d{2}:?\d{2})$/.test(s);
  if (!hasTz) {
    const isoNoTz = s.includes('T') ? s : s.replace(' ', 'T');
    return Date.parse(isoNoTz.endsWith('Z') ? isoNoTz : `${isoNoTz}Z`);
  }
  const normalized = s.includes(' ') && !s.includes('T') ? s.replace(' ', 'T') : s;
  return Date.parse(normalized);
}

function hhmmFromIsoAlmaty(s: string): string {
  const ms = parseToUtcMsStable(s);
  if (!Number.isFinite(ms)) return '';
  const d = new Date(ms);
  const total = d.getUTCHours() * 60 + d.getUTCMinutes() + ALMATY_OFFSET_MIN;
  const mm = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const hh = String(Math.floor(mm / 60)).padStart(2, '0');
  const mi = String(mm % 60).padStart(2, '0');
  return `${hh}:${mi}`;
}

function diffMinutes(startISO: string, endISO: string): number {
  const a = Date.parse(startISO);
  const b = Date.parse(endISO);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.max(0, Math.round((b - a) / 60000));
}

// RESOURCES
const RESOURCES: ResourceDef[] = [
  { key: 'cabinet-1', title: 'Кабинет 1', channel: 'cabinet', cabinetNumber: 1 },
  { key: 'cabinet-2', title: 'Кабинет 2', channel: 'cabinet', cabinetNumber: 2 },
  { key: 'cabinet-3', title: 'Кабинет 3', channel: 'cabinet', cabinetNumber: 3 },
  { key: 'cabinet-4', title: 'Кабинет 4', channel: 'cabinet', cabinetNumber: 4 },
  { key: 'cabinet-5', title: 'Кабинет 5', channel: 'cabinet', cabinetNumber: 5 },
  { key: 'cabinet-6', title: 'Кабинет 6', channel: 'cabinet', cabinetNumber: 6 },
  { key: 'cabinet-7', title: 'Кабинет 7', channel: 'cabinet', cabinetNumber: 7 },
  { key: 'cabinet-8', title: 'Кабинет 8', channel: 'cabinet', cabinetNumber: 8 },
  { key: 'lab', title: 'Анализы', channel: 'lab' },
  { key: 'home', title: 'Вызов на дом', channel: 'home' },
  { key: 'online', title: 'Онлайн консультация', channel: 'online' },
];

const DEFAULT_RESOURCE_KEY: ResourceDef['key'] = 'cabinet-1';

type DoctorScheduleViewerProps = {
  doctorUserId: string; // viewer users.id
  doctors: TDoctor[];
  patients: TPatient[];

  // ✅ фильтр
  selectedDoctorId: string; // doctors.id или '__ALL_DOCTORS__'
  allDoctorsId: string; // '__ALL_DOCTORS__'
};

export const DoctorScheduleViewer = ({
  doctorUserId,
  doctors,
  patients,
  selectedDoctorId,
  allDoctorsId,
}: DoctorScheduleViewerProps) => {
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const formattedDate = useMemo(() => ymd(selectedDate), [selectedDate]);

  const [slots, setSlots] = useState<DoctorSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [selectedResourceKey, setSelectedResourceKey] = useState<ResourceDef['key']>(DEFAULT_RESOURCE_KEY);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);

  const authenticatedFetch = useAuthenticatedFetch();
  const router = useRouter();
  const { cancelAppointment, loading: cancelLoading } = useCancelAppointmentByDoctor();

  const patientsById = useMemo(() => {
    const m = new Map<string, TPatient>();
    for (const p of patients ?? []) if ((p as any)?.id) m.set(String((p as any).id), p);
    return m;
  }, [patients]);

  const canEditDoctor = useCallback(
    (slotDoctorUserId: string) => String(slotDoctorUserId ?? '').trim() === String(doctorUserId ?? '').trim(),
    [doctorUserId]
  );

  const fetchSlotsForDoctor = useCallback(
    async (doctorId: string, targetDoctorUserId: string, date: string): Promise<DoctorSlot[]> => {
      const params = new URLSearchParams();
      params.set('date', date);
      params.set('include_all', '1');
      params.set('include_booked', '1');
      params.set('include_cancelled', '0');

params.set('alt_doctor_id', targetDoctorUserId);
    const url = `/api/doctors/${encodeURIComponent(doctorUserId)}/available-slots?${params.toString()}`;
      const res = await authenticatedFetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const json = await res.json();
      const payload = json?.data ?? json ?? {};
      const rawSlots: any[] = Array.isArray(payload.slots) ? payload.slots : Array.isArray(payload.Slots) ? payload.Slots : [];

      const sorted = rawSlots.slice().sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)));

      return sorted.map((s) => {
        const start_time = String(s.start_time ?? '');
        const end_time = String(s.end_time ?? '');

        const pid = s.patient_id ? String(s.patient_id) : undefined;
        const p = pid ? patientsById.get(pid) : undefined;
const appointment_type = (s.appointment_type ?? s.appointmentType ?? null) as
    | 'online'
    | 'offline'
    | 'both'
    | null;

        const channel = (s.channel ?? null) as any;
        const cabinet_number = (s.cabinet_number ?? null) as any;
const cab = Math.min(6, Math.max(1, Number(cabinet_number ?? 1)));

  let resource_key: string = `cabinet-${cab}`;

  if (channel === 'home') resource_key = 'home';
  else if (channel === 'online') resource_key = 'online';
  else if (channel === 'lab') resource_key = 'lab';
  else if (channel === 'cabinet') resource_key = `cabinet-${cab}`;
  else {
    // channel нет → фолбэк как у ресепшна по appointment_type
    if (appointment_type === 'online') resource_key = 'online';
    else if (appointment_type === 'offline') resource_key = `cabinet-${cab}`;
    else if (appointment_type === 'both') {
      // booked обычно уже имеет channel, но на всякий:
      // пусть в календаре будет хотя бы в кабинете
      resource_key = `cabinet-${cab}`;
    } else {
      resource_key = `cabinet-${cab}`;
    }
  }

        return {
          id: String(s.id),
          doctor_id: String(doctorId).trim(),
          doctor_user_id: String(targetDoctorUserId).trim(),

          start_time,
          end_time,
          duration_minutes: Number(s.duration_minutes ?? s.duration ?? diffMinutes(start_time, end_time) ?? 0),
          status: String(s.status) as SlotStatus,

          appointment_type: s.appointment_type ?? s.appointmentType,
          title: s.title,

          patient_id: pid,
          booked_at: s.booked_at ?? s.bookedAt,

          start_hhmm: start_time ? hhmmFromIsoAlmaty(start_time) : '',
          end_hhmm: end_time ? hhmmFromIsoAlmaty(end_time) : '',

          channel,
          cabinet_number,
          service_id: s.service_id ?? null,

          patient: p
            ? {
                id: (p as any).id,
                user_id: (p as any).user_id,
                first_name: (p as any).first_name,
                last_name: (p as any).last_name,
                middle_name: (p as any).middle_name,
                email: (p as any).email,
                phone: (p as any).phone,
              }
            : null,
             resource_key,
        }as DoctorSlot;
      });
    },
    [authenticatedFetch, patientsById]
  );

  // ✅ Грузим либо всех, либо выбранного (как у ресепшна)
  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const doctorsUsable = (doctors ?? []).filter((d: any) => String((d as any)?.id ?? '').trim().length > 0);

      const doctorsToLoad =
        !selectedDoctorId || selectedDoctorId === allDoctorsId
          ? doctorsUsable
          : doctorsUsable.filter((d: any) => String((d as any).id) === String(selectedDoctorId));

      const entries = await Promise.all(
        doctorsToLoad.map(async (d: any) => {
          const did = String((d as any).id ?? '').trim();
          const duid = String((d as any).user_id ?? '').trim();
          return fetchSlotsForDoctor(did, duid, formattedDate);
        })
      );

      const all = entries.flat();
      all.sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)));
      setSlots(all);
    } catch (e: any) {
      setError(e?.message ?? 'Не удалось загрузить слоты');
      setSlots([]);
    } finally {
      setLoading(false);
    }
  }, [doctors, fetchSlotsForDoctor, formattedDate, selectedDoctorId, allDoctorsId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const selectedSlot = useMemo(() => slots.find((s) => s.id === selectedSlotId) ?? null, [slots, selectedSlotId]);

  const selectedResource = useMemo(() => {
    return RESOURCES.find((r) => r.key === selectedResourceKey) ?? RESOURCES[0];
  }, [selectedResourceKey]);

  const handleSlotClick = (slotId: string, resourceKey?: string) => {
    const slot = slots.find((s) => s.id === slotId);
    if (!slot) return;

    const rk = (slot as any)?.resource_key ?? resourceKey ?? DEFAULT_RESOURCE_KEY;

if (slot.status === 'booked' || slot.status === 'completed') {      // ✅ doctor_user_id берём из слота
      const url =
        `/doctor/appointments/${encodeURIComponent(slot.id)}` +
        `?date=${encodeURIComponent(formattedDate)}` +
        `&start_time=${encodeURIComponent(slot.start_time)}` +
        `&end_time=${encodeURIComponent(slot.end_time)}` +
        `&doctor_user_id=${encodeURIComponent(slot.doctor_user_id)}`;
      router.push(url);
      return;
    }

    if (slot.status === 'available') {
      setSelectedSlotId(slotId);
      setSelectedResourceKey(rk);
      setIsBookingModalOpen(true);
    }
  };

  const handleCancelSlot = async (slotId: string) => {
    const slot = slots.find((s) => s.id === slotId);
    if (!slot) return;

    if (!canEditDoctor(slot.doctor_user_id)) return;

    const ok = await cancelAppointment(slotId);
    if (ok) loadAll();
  };

  const handleBookingSuccess = () => {
    setIsBookingModalOpen(false);
    setSelectedSlotId(null);
    loadAll();
  };

  const titleSuffix = useMemo(() => {
    if (!selectedDoctorId || selectedDoctorId === allDoctorsId) return ' (все врачи)';
    const d = (doctors as any[]).find((x) => String(x.id) === String(selectedDoctorId));
    const fio = d ? `${d.last_name ?? ''} ${d.first_name ?? ''}`.trim() : '';
    return fio ? ` (${fio})` : '';
  }, [selectedDoctorId, allDoctorsId, doctors]);

  return (
    <div className="bg-white rounded-xl shadow-sm">
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900">
          Расписание на {headerRu(selectedDate)}
          {titleSuffix}
        </h2>

        <div className="mt-2 flex gap-2 items-center">
          <input
            type="date"
            className="px-3 py-2 rounded-lg border text-sm"
            value={formattedDate}
            onChange={(e) => {
              const d = new Date(`${e.target.value}T00:00:00`);
              d.setHours(0, 0, 0, 0);
              setSelectedDate(d);
            }}
          />
          <button className="px-3 py-2 rounded-lg border text-sm" onClick={loadAll} disabled={loading}>
            Обновить
          </button>
        </div>
      </div>

      {(loading || cancelLoading) && <div className="px-6 py-3 text-sm text-gray-600">Загрузка слотов…</div>}
      {error && <div className="px-6 py-3 text-sm text-red-600">Ошибка: {error}</div>}

      <div className="p-6">
        <ScheduleCalendar
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          slots={slots as any}
          loading={loading || cancelLoading}
          error={error}
          resources={RESOURCES}
          onSlotClick={handleSlotClick}
          onCancelSlot={handleCancelSlot}
        />
      </div>

      {selectedSlot && selectedSlot.status === 'available' && (
        <BookingModal
          isOpen={isBookingModalOpen}
          onClose={() => {
            setIsBookingModalOpen(false);
            setSelectedSlotId(null);
          }}
          slot={selectedSlot as any}
          resource={selectedResource}
          patients={patients}
          doctors={[]} // врачу список врачей не нужен
          viewerUserId={doctorUserId}
          isReception={false}
          onSuccess={handleBookingSuccess}
        />
      )}
    </div>
  );
};