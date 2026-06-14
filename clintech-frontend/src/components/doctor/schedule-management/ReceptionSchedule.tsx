'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { TDoctor } from '@/types/doctors';
import { TPatient } from '@/types/patient';

import { useAuthenticatedFetch } from '@/hooks/auth/useAuthenticatedFetch';
import { useCancelAppointmentByDoctor } from '@/hooks/appointment/useCancelAppointmentByDoctor';
import { BookingModal, ResourceDef } from './BookingModal';

const DEBUG_SCHEDULE = true;

function dbg(...args: any[]) {
  if (!DEBUG_SCHEDULE) return;
  console.log('[SCHEDULE]', ...args);
}
function dbgErr(...args: any[]) {
  if (!DEBUG_SCHEDULE) return;
  console.error('[SCHEDULE]', ...args);
}

type ReceptionScheduleProps = {
  doctors: TDoctor[];
  patients: TPatient[];
  viewerUserId: string;
  isReception: boolean;
  selectedDoctorId: string;
  allDoctorsId: string;
};

type SlotStatus = 'available' | 'booked' | 'blocked' | 'cancelled' | 'completed';

type ResourceKey =
  | 'cabinet-1'
  | 'cabinet-2'
  | 'cabinet-3'
  | 'cabinet-4'
  | 'cabinet-5'
  | 'cabinet-6'
  | 'cabinet-7'
  | 'cabinet-8'
  | 'lab'
  | 'home'
  | 'online';

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

type ReceptionSlot = {
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
};

function pad2(n: number) {
  return n < 10 ? `0${n}` : String(n);
}
function ymd(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function headerRu(d: Date) {
  const months = [
    'января',
    'февраля',
    'марта',
    'апреля',
    'мая',
    'июня',
    'июля',
    'августа',
    'сентября',
    'октября',
    'ноября',
    'декабря',
  ];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}
function toMin(hhmm: string): number {
  const m = hhmm.match(/^(\d{2}):(\d{2})/);
  if (!m) return 0;
  return Number(m[1]) * 60 + Number(m[2]);
}
function minToLabel(total: number) {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${pad2(h)}:${pad2(m)}`;
}
function buildTimeAxis(startMin: number, endMin: number, stepMin: number) {
  const arr: number[] = [];
  for (let t = startMin; t <= endMin; t += stepMin) arr.push(t);
  return arr;
}
function sameYmd(a: Date, b: Date) {
  return ymd(a) === ymd(b);
}
function addDays(d: Date, days: number) {
  const nd = new Date(d);
  nd.setDate(nd.getDate() + days);
  nd.setHours(0, 0, 0, 0);
  return nd;
}
function parseYmdToDate(s: string) {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const da = Number(m[3]);
  const d = new Date(y, mo, da);
  d.setHours(0, 0, 0, 0);
  return d;
}
function resourceSub(r: ResourceDef) {
  if (r.channel === 'cabinet') return 'Очный приём';
  if (r.channel === 'home') return 'Выезд';
  if (r.channel === 'online') return 'Онлайн';
  return 'Лаборатория';
}
function diffMinutes(startISO: string, endISO: string): number {
  const a = Date.parse(startISO);
  const b = Date.parse(endISO);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.max(0, Math.round((b - a) / 60000));
}

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

type PendingBooked = {
  appointmentId: string;
  doctorId: string;
  doctorUserId: string;
  start_time: string;
  end_time: string;
  channel: 'cabinet' | 'lab' | 'home' | 'online' | null;
  cabinet_number: number | null;
  title?: string;
  createdAt: number;
};

function doctorLabel(d: TDoctor) {
  const last = (d as any)?.last_name?.trim?.() ?? '';
  const first = (d as any)?.first_name?.trim?.() ?? '';
  const mid = (d as any)?.middle_name?.trim?.() ?? '';
  const fio = [last, first, mid].filter(Boolean).join(' ');
  return fio || (d as any)?.email || (d as any)?.phone || `Врач ${(d as any)?.id}`;
}

function doctorShortLabel(d?: TDoctor | null) {
  if (!d) return 'Врач';

  const last = String((d as any)?.last_name ?? '').trim();
  const first = String((d as any)?.first_name ?? '').trim();
  const middle = String((d as any)?.middle_name ?? '').trim();

  const firstInitial = first ? first.charAt(0) : '';
  const middleInitial = middle ? middle.charAt(0) : '';

  if (last && firstInitial && middleInitial) {
    return `${last} ${firstInitial}.${middleInitial}.`;
  }

  if (last && firstInitial) {
    return `${last} ${firstInitial}.`;
  }

  if (last) return last;
  if (first) return first;
  if (middle) return middle;

  return doctorLabel(d);
}
export default function ReceptionSchedule({
  doctors,
  patients,
  viewerUserId,
  isReception,
  selectedDoctorId,
  allDoctorsId,
}: ReceptionScheduleProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const authenticatedFetch = useAuthenticatedFetch();
  const { cancelAppointment, loading: cancelLoading } = useCancelAppointmentByDoctor();

  const ROW_MIN = 15;
  const ROW_PX = 32;

  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const formattedDate = useMemo(() => ymd(selectedDate), [selectedDate]);

  const doctorsUsable = useMemo(
    () => doctors.filter((d: any) => String((d as any).id ?? '').trim().length > 0),
    [doctors]
  );

  useEffect(() => {
    dbg('props', {
      isReception,
      viewerUserId,
      selectedDoctorId,
      allDoctorsId,
      doctors_len: doctors?.length,
      doctorsUsable_len: doctorsUsable.length,
      patients_len: patients?.length,
    });

    if (doctorsUsable.length) {
      dbg(
        'doctorsUsable sample',
        doctorsUsable.slice(0, 5).map((d: any) => ({
          id: String(d.id),
          user_id: String(d.user_id ?? ''),
          fio: `${d.last_name ?? ''} ${d.first_name ?? ''}`.trim(),
        }))
      );
    }
  }, [isReception, viewerUserId, selectedDoctorId, allDoctorsId, doctors, doctorsUsable, patients]);

  const doctorById = useMemo(() => {
    const m = new Map<string, TDoctor>();
    for (const d of doctorsUsable) m.set(String((d as any).id).trim(), d);
    return m;
  }, [doctorsUsable]);

  const selectedDoctorLabel = useMemo(() => {
    if (!selectedDoctorId || selectedDoctorId === allDoctorsId) return 'Все врачи';
    const d = doctorById.get(String(selectedDoctorId).trim());
    return d ? doctorLabel(d) : 'Выбранный врач';
  }, [selectedDoctorId, allDoctorsId, doctorById]);

  const getSlotDoctorShortName = useCallback(
    (slot: ReceptionSlot) => {
      const d = doctorById.get(String(slot.doctor_id).trim());
      return doctorShortLabel(d);
    },
    [doctorById]
  );

  const patientsById = useMemo(() => {
    const m = new Map<string, TPatient>();
    for (const p of patients) {
      if ((p as any).id) m.set(String((p as any).id), p);
    }
    return m;
  }, [patients]);

  const [slotsByDoctorId, setSlotsByDoctorId] = useState<Record<string, ReceptionSlot[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedSlot, setSelectedSlot] = useState<ReceptionSlot | null>(null);
  const [selectedResource, setSelectedResource] = useState<ResourceDef | null>(null);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);

  const slotOverridesRef = useRef<
    Record<string, { channel: 'cabinet' | 'lab' | 'home' | 'online' | null; cabinet_number: number | null }>
  >({});

  const pendingBookedRef = useRef<Record<string, PendingBooked>>({});
  const deletedAppointmentIdsRef = useRef<Record<string, number>>({});

  const canEditDoctor = useCallback(
    (slotDoctorUserId: string) => {
      if (isReception) return true;
      return String(slotDoctorUserId ?? '').trim() === String(viewerUserId ?? '').trim();
    },
    [isReception, viewerUserId]
  );

  const removeDeletedSlotLocally = useCallback((appointmentId: string) => {
    deletedAppointmentIdsRef.current[String(appointmentId)] = Date.now();

    setSlotsByDoctorId((prev) => {
      const next: Record<string, ReceptionSlot[]> = {};
      for (const [did, slots] of Object.entries(prev)) {
        next[did] = slots.filter((s) => String(s.id) !== String(appointmentId));
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const deletedId = searchParams.get('deleted_appointment_id');
    if (!deletedId) return;

    removeDeletedSlotLocally(deletedId);

    const url = new URL(window.location.href);
    url.searchParams.delete('deleted_appointment_id');
    window.history.replaceState({}, '', url.toString());
  }, [searchParams, removeDeletedSlotLocally]);

  const fetchSlotsForDoctor = useCallback(
    async (doctorId: string, doctorUserId: string, date: string): Promise<ReceptionSlot[]> => {
      const params = new URLSearchParams();
      params.set('date', date);
      params.set('include_all', '1');
      params.set('include_booked', '1');
      params.set('include_cancelled', '0');
      params.set('alt_doctor_id', doctorUserId);

      const url = `/api/doctors/${encodeURIComponent(doctorUserId)}/available-slots?${params.toString()}`;

      dbg('FETCH start', { doctorId, doctorUserId, url });

      const res = await authenticatedFetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        let bodyText = '';
        try {
          bodyText = await res.text();
        } catch (readErr) {
          dbgErr('FETCH read body error', readErr);
        }

        dbgErr('FETCH failed', {
          doctorId,
          doctorUserId,
          status: res.status,
          statusText: res.statusText,
          bodyText,
        });

        throw new Error(`HTTP ${res.status}${bodyText ? `: ${bodyText}` : ''}`);
      }

      dbg('FETCH ok', { doctorId, status: res.status });

      const json = await res.json();
      const payload = json?.data ?? json ?? {};

      const raw = payload.slots ?? payload.Slots;
      const rawSlots: any[] = Array.isArray(raw) ? raw : [];
      dbg('FETCH payload slots count', {
        doctorId,
        doctorUserId,
        rawSlots_len: rawSlots.length,
      });

      if (rawSlots.length) {
        dbg('FETCH sample slot', rawSlots[0]);
      }

      const sorted = rawSlots.slice().sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)));

      return sorted.map((s) => {
        const start_time = String(s.start_time ?? s.startTime ?? '');
        const end_time = String(s.end_time ?? s.endTime ?? '');

        const start_hhmm = start_time ? hhmmFromIsoAlmaty(start_time) : '';
        const end_hhmm = end_time ? hhmmFromIsoAlmaty(end_time) : '';

        const pid = s.patient_id ? String(s.patient_id) : undefined;
        const p = pid ? patientsById.get(pid) : undefined;

        const sid = String(s.id);
        const override = slotOverridesRef.current[sid] || null;

        const backendChannel = (s.channel ?? null) as any;
        const backendCab = (s.cabinet_number ?? null) as any;

        const finalChannel = backendChannel ?? override?.channel ?? null;
        const finalCabinet = backendCab ?? override?.cabinet_number ?? null;

        const rawStatus = String(s.status ?? '') as SlotStatus;

        let normalizedStatus: SlotStatus = rawStatus;
        if (!pid && (rawStatus === 'completed' || rawStatus === 'cancelled')) {
          normalizedStatus = 'available';
        }

        return {
          id: sid,
          doctor_id: String(doctorId).trim(),
          doctor_user_id: String(doctorUserId).trim(),

          start_time,
          end_time,
          duration_minutes: Number(s.duration_minutes ?? s.duration ?? diffMinutes(start_time, end_time) ?? 0),
          status: normalizedStatus,
          appointment_type: s.appointment_type ?? s.appointmentType,
          title: s.title,

          patient_id: pid,
          booked_at: s.booked_at ?? s.bookedAt,

          start_hhmm,
          end_hhmm,

          cabinet_number: finalCabinet,
          channel: finalChannel,
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
        } as ReceptionSlot;
      });
    },
    [authenticatedFetch, patientsById]
  );

  const mergePendingBookedIntoMap = useCallback((serverMap: Record<string, ReceptionSlot[]>) => {
    const TTL = 30_000;
    const now = Date.now();

    const merged: Record<string, ReceptionSlot[]> = { ...serverMap };

    for (const [apptId, pb] of Object.entries(pendingBookedRef.current)) {
      if (now - pb.createdAt > TTL) {
        delete pendingBookedRef.current[apptId];
        continue;
      }

      const did = String(pb.doctorId || '').trim();
      if (!did) continue;

      const list = merged[did] ? [...merged[did]] : [];
      const idx = list.findIndex((s) => String(s.id) === String(apptId));

      if (idx >= 0 && list[idx]?.status === 'booked') {
        delete pendingBookedRef.current[apptId];
        merged[did] = list;
        continue;
      }

      const optimistic: ReceptionSlot = {
        id: apptId,
        doctor_id: did,
        doctor_user_id: pb.doctorUserId,

        start_time: pb.start_time,
        end_time: pb.end_time,
        duration_minutes: diffMinutes(pb.start_time, pb.end_time) || 15,
        status: 'booked',

        start_hhmm: hhmmFromIsoAlmaty(pb.start_time),
        end_hhmm: hhmmFromIsoAlmaty(pb.end_time),

        channel: pb.channel,
        cabinet_number: pb.cabinet_number,
        service_id: null,

        patient_id: undefined,
        booked_at: new Date(pb.createdAt).toISOString(),
        patient: null,

        title: pb.title || 'Забронировано',
        appointment_type: pb.channel === 'online' ? 'online' : 'offline',
      };

      if (idx >= 0) list[idx] = optimistic;
      else list.push(optimistic);

      list.sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)));
      merged[did] = list;
    }

    return merged;
  }, []);

  const loadAll = useCallback(async () => {
    dbg('loadAll start', {
      formattedDate,
      selectedDoctorId,
      allDoctorsId,
      doctorsUsable_len: doctorsUsable.length,
    });

    setLoading(true);
    setError(null);

    try {
      const doctorsToLoad =
        !selectedDoctorId || selectedDoctorId === allDoctorsId
          ? doctorsUsable
          : doctorsUsable.filter((d: any) => String((d as any).id) === String(selectedDoctorId));

      dbg('doctorsToLoad', {
        mode: !selectedDoctorId || selectedDoctorId === allDoctorsId ? 'ALL' : 'ONE',
        doctorsToLoad_len: doctorsToLoad.length,
        doctorsToLoad_ids: doctorsToLoad.map((d: any) => String(d.id)),
        doctorsToLoad_user_ids: doctorsToLoad.map((d: any) => String(d.user_id ?? '')),
      });

      const entries = await Promise.all(
        doctorsToLoad.map(async (d: any) => {
          const did = String((d as any).id ?? '').trim();
          const duid = String((d as any).user_id ?? '').trim();
          const slots = await fetchSlotsForDoctor(did, duid, formattedDate);
          return [did, slots] as const;
        })
      );

      dbg(
        'entries result',
        entries.map(([did, slots]) => ({
          doctorId: did,
          slots_len: slots.length,
          booked: slots.filter((s) => s.status === 'booked').length,
          available: slots.filter((s) => s.status === 'available').length,
        }))
      );

      const serverMap: Record<string, ReceptionSlot[]> = {};
      for (const [did, s] of entries) serverMap[did] = s;

      const merged = mergePendingBookedIntoMap(serverMap);

      const filtered: Record<string, ReceptionSlot[]> = {};
      for (const [did, slots] of Object.entries(merged)) {
        filtered[did] = slots.filter((s) => !deletedAppointmentIdsRef.current[String(s.id)]);
      }

      setSlotsByDoctorId(filtered);
    } catch (e: any) {
      dbgErr('loadAll error', e);
      setError(e?.message ?? 'Не удалось загрузить слоты');
      setSlotsByDoctorId((prev) => {
        const mergedPrev = mergePendingBookedIntoMap(prev);
        const filteredPrev: Record<string, ReceptionSlot[]> = {};
        for (const [did, slots] of Object.entries(mergedPrev)) {
          filteredPrev[did] = slots.filter((s) => !deletedAppointmentIdsRef.current[String(s.id)]);
        }
        return filteredPrev;
      });
    } finally {
      setLoading(false);
    }
  }, [selectedDoctorId, allDoctorsId, doctorsUsable, fetchSlotsForDoctor, formattedDate, mergePendingBookedIntoMap]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const slotsByResource = useMemo(() => {
    const map: Record<ResourceKey, ReceptionSlot[]> = {
      'cabinet-1': [],
      'cabinet-2': [],
      'cabinet-3': [],
      'cabinet-4': [],
      'cabinet-5': [],
      'cabinet-6': [],
      'cabinet-7': [],
      'cabinet-8': [],
      lab: [],
      online: [],
      home: [],
    };

    const all = Object.values(slotsByDoctorId).flat();

    for (const s of all) {
      const status = s.status;
      const ch = (s.channel ?? null) as any;
      const cab = Number(s.cabinet_number ?? 0);

      const pushCab = (num: number) => {
        if (num >= 1 && num <= 8) map[`cabinet-${num}` as ResourceKey].push(s);
      };

      if (status === 'available') {
        if (ch === 'home') {
          map.home.push(s);
          continue;
        }
        if (ch === 'online') {
          map.online.push(s);
          continue;
        }
        if (ch === 'lab') {
          map.lab.push(s);
          continue;
        }
        if (ch === 'cabinet') {
          pushCab(cab || 1);
          continue;
        }

        const at = s.appointment_type;

        if (at === 'online') {
          map.online.push(s);
          continue;
        }
        if (at === 'offline') {
          pushCab(cab || 1);
          continue;
        }
        if (at === 'both') {
          map.online.push(s);
          pushCab(cab || 1);
          continue;
        }

        pushCab(cab || 1);
        continue;
      }

      if (ch === 'home') map.home.push(s);
      else if (ch === 'online') map.online.push(s);
      else if (ch === 'lab') map.lab.push(s);
      else pushCab(cab || 1);
    }

    for (const k of Object.keys(map) as ResourceKey[]) {
      map[k] = map[k].slice().sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)));
    }

    return map;
  }, [slotsByDoctorId]);

  useEffect(() => {
    const totals = Object.fromEntries(
      Object.entries(slotsByResource).map(([k, arr]) => [k, arr.length])
    );

    const bookedTotal = Object.values(slotsByResource)
      .flat()
      .filter((s) => s.status === 'booked').length;

    dbg('slotsByResource totals', totals);
    dbg('slotsByResource bookedTotal', bookedTotal);

    if (bookedTotal === 0) {
      dbg('NO BOOKED SLOTS visible (available are hidden)');
    }
  }, [slotsByResource]);

  const { timeAxis, gridStartMin, gridEndMin, gridHeightPx } = useMemo(() => {
    const start = 8 * 60;
    const end = 19 * 60;
    const axis = buildTimeAxis(start, end, ROW_MIN);
    const height = Math.max(1, axis.length) * ROW_PX;
    return { timeAxis: axis, gridStartMin: start, gridEndMin: end, gridHeightPx: height };
  }, [ROW_MIN, ROW_PX]);

  const gridColumnsStyle = useMemo(() => {
    return {
      gridTemplateColumns: `80px repeat(${RESOURCES.length}, minmax(150px, 1fr))`,
    } as React.CSSProperties;
  }, []);

  const handleSlotClick = (slot: ReceptionSlot, resource: ResourceDef) => {
    if (slot.status === 'booked' || slot.status === 'completed') {
      const base = isReception ? '/reception' : '/doctor';
      router.push(
        `${base}/appointments/${encodeURIComponent(slot.id)}?date=${encodeURIComponent(
          formattedDate
        )}&start_time=${encodeURIComponent(slot.start_time)}&end_time=${encodeURIComponent(
          slot.end_time
        )}&doctor_user_id=${encodeURIComponent(slot.doctor_user_id)}`
      );
      return;
    }

    if (slot.status === 'available') {
      setSelectedSlot(slot);
      setSelectedResource(resource);
      setIsBookingModalOpen(true);
    }
  };

  const handleBookingSuccess = (p: {
    appointmentId: string;
    doctorId: string;
    doctorUserId: string;
    start_time: string;
    end_time: string;
    channel?: 'cabinet' | 'lab' | 'home' | 'online';
    cabinet_number?: number | null;
    title?: string;
  }) => {
    setIsBookingModalOpen(false);
    setSelectedSlot(null);
    setSelectedResource(null);

    const fallbackChannel = (p.channel ?? selectedResource?.channel ?? null) as any;
    const fallbackCabinet =
      (p.cabinet_number ?? (selectedResource?.channel === 'cabinet' ? selectedResource?.cabinetNumber ?? null : null)) ??
      null;

    slotOverridesRef.current[p.appointmentId] = {
      channel: fallbackChannel,
      cabinet_number: fallbackCabinet,
    };

    pendingBookedRef.current[p.appointmentId] = {
      appointmentId: p.appointmentId,
      doctorId: String(p.doctorId || '').trim(),
      doctorUserId: String(p.doctorUserId || '').trim(),
      start_time: p.start_time,
      end_time: p.end_time,
      channel: fallbackChannel,
      cabinet_number: fallbackCabinet,
      title: p.title,
      createdAt: Date.now(),
    };

    setSlotsByDoctorId((prev) => {
      const did = String(p.doctorId || '').trim();
      if (!did) return prev;

      const bookedSlot: ReceptionSlot = {
        id: p.appointmentId,
        doctor_id: did,
        doctor_user_id: String(p.doctorUserId || '').trim(),

        start_time: p.start_time,
        end_time: p.end_time,
        duration_minutes: diffMinutes(p.start_time, p.end_time) || 15,
        status: 'booked',

        start_hhmm: hhmmFromIsoAlmaty(p.start_time),
        end_hhmm: hhmmFromIsoAlmaty(p.end_time),

        channel: fallbackChannel,
        cabinet_number: fallbackCabinet,
        service_id: null,

        patient_id: undefined,
        booked_at: new Date().toISOString(),
        patient: null,

        title: p.title || 'Забронировано',
        appointment_type: fallbackChannel === 'online' ? 'online' : 'offline',
      };

      const current = prev[did] ? [...prev[did]] : [];
      const idx = current.findIndex((s) => String(s.id) === String(p.appointmentId));
      if (idx >= 0) current[idx] = bookedSlot;
      else current.push(bookedSlot);

      current.sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)));
      return { ...prev, [did]: current };
    });

    loadAll();
  };

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const relativeLabel = useMemo(() => {
    if (sameYmd(selectedDate, today)) return 'Сегодня';
    if (sameYmd(selectedDate, addDays(today, -1))) return 'Вчера';
    if (sameYmd(selectedDate, addDays(today, 1))) return 'Завтра';
    return '';
  }, [selectedDate, today]);

  return (
    <div className="bg-white rounded-xl shadow-sm">
      <div className="p-6 border-b border-gray-200 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            График на {headerRu(selectedDate)}
            {relativeLabel && (
              <span className="ml-2 inline-flex items-center rounded-full border px-2 py-0.5 text-xs text-gray-600">
                {relativeLabel}
              </span>
            )}
          </h2>

          <div className="text-sm text-gray-600">
            Режим: <span className="font-semibold text-gray-900">{selectedDoctorLabel}</span>
            <span className="mx-2">•</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            className="px-3 py-2 rounded-lg border text-sm hover:bg-gray-50"
            onClick={() => setSelectedDate((d) => addDays(d, -1))}
          >
            ←
          </button>

          <input
            type="date"
            className="px-3 py-2 rounded-lg border text-sm"
            value={formattedDate}
            onChange={(e) => {
              const nd = parseYmdToDate(e.target.value);
              if (nd) setSelectedDate(nd);
            }}
          />

          <button
            className="px-3 py-2 rounded-lg border text-sm hover:bg-gray-50"
            onClick={() => setSelectedDate((d) => addDays(d, 1))}
          >
            →
          </button>

          <button
            className="px-3 py-2 rounded-lg border text-sm hover:bg-gray-50"
            onClick={() => setSelectedDate(today)}
            disabled={sameYmd(selectedDate, today)}
          >
            Сегодня
          </button>

          <button className="px-3 py-2 rounded-lg border text-sm hover:bg-gray-50" onClick={loadAll} disabled={loading}>
            Обновить
          </button>
        </div>
      </div>

      {(loading || cancelLoading) && <div className="px-6 py-3 text-sm text-gray-600">Загрузка слотов…</div>}
      {/* {error && <div className="px-6 py-3 text-sm text-red-600">Ошибка: {error}</div>} */}

      <div className="overflow-auto">
        <div className="min-w-[1900px]">
          <div className="grid" style={gridColumnsStyle}>
            <div className="sticky left-0 z-50 bg-white border-b border-r px-2 py-2 text-xs font-semibold text-gray-700">
              Время
            </div>

            {RESOURCES.map((r) => (
              <div key={r.key} className="border-b border-r px-2 py-2 bg-white">
                <div className="text-xs font-semibold text-gray-900 truncate">{r.title}</div>
                <div className="text-[11px] text-gray-500 truncate">{resourceSub(r)}</div>
              </div>
            ))}
          </div>

          <div className="grid" style={gridColumnsStyle}>
            <div className="sticky left-0 z-40 bg-white border-r">
              {timeAxis.map((tMin) => (
                <div key={tMin} className="border-b px-2 py-1 text-xs text-gray-700 bg-white" style={{ height: ROW_PX }}>
                  {minToLabel(tMin)}
                </div>
              ))}
            </div>

            {RESOURCES.map((r) => {
              const colSlots = slotsByResource[r.key] ?? [];

              return (
                <div key={r.key} className="border-r">
                  <div
                    className="relative"
                    style={{
                      height: gridHeightPx,
                      backgroundImage: 'linear-gradient(to bottom, rgba(0,0,0,0.06) 1px, transparent 1px)',
                      backgroundSize: `100% ${ROW_PX}px`,
                    }}
                    onClick={(e) => {
                      const target = e.target as HTMLElement;
                      if (target.closest('button')) return;

                      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                      const offsetY = e.clientY - rect.top;

                      const minutesFromStart = Math.floor(offsetY / ROW_PX) * ROW_MIN;
                      const startMin = gridStartMin + minutesFromStart;

                      const yyyy = selectedDate.getFullYear();
                      const mm = selectedDate.getMonth();
                      const dd = selectedDate.getDate();

                      const hh = Math.floor(startMin / 60);
                      const mi = startMin % 60;

                      const startLocal = new Date(yyyy, mm, dd, hh, mi, 0, 0);
                      const endLocal = new Date(startLocal.getTime() + 15 * 60000);

                      const virtualSlot: ReceptionSlot = {
                        id: `virtual-${startLocal.toISOString()}-${r.key}`,
                        doctor_id: '',
                        doctor_user_id: '',
                        start_time: startLocal.toISOString(),
                        end_time: endLocal.toISOString(),
                        duration_minutes: 15,
                        status: 'available',
                        start_hhmm: minToLabel(startMin),
                        end_hhmm: minToLabel(startMin + 15),
                        cabinet_number: r.channel === 'cabinet' ? (r.cabinetNumber ?? 1) : null,
                        channel: r.channel,
                        service_id: null,
                        patient_id: undefined,
                        booked_at: undefined,
                        patient: null,
                        appointment_type: r.channel === 'online' ? 'online' : 'offline',
                        title: '',
                      };

                      setSelectedSlot(virtualSlot);
                      setSelectedResource(r);
                      setIsBookingModalOpen(true);
                    }}
                  >
                    {colSlots.map((slot) => {
                      const startMin = toMin(slot.start_hhmm);
                      const endMin = toMin(slot.end_hhmm);

                      const isBookedLike = slot.status === 'booked' || slot.status === 'completed';
                      const isBlocked = slot.status === 'blocked';

                      if (!isBookedLike && !isBlocked) return null;
                      if (endMin <= gridStartMin || startMin >= gridEndMin) return null;

                      const clippedStart = Math.max(startMin, gridStartMin);
                      const clippedEnd = Math.min(endMin, gridEndMin);

                      const pixelsPerMinute = ROW_PX / ROW_MIN;
                      const top = Math.max(0, (clippedStart - gridStartMin) * pixelsPerMinute);
                      const height = Math.max(8, (clippedEnd - clippedStart) * pixelsPerMinute);

                      const isClickable = isBookedLike;

                      return (
                        <button
                          key={`${slot.id}-${r.key}`}
                          type="button"
                          disabled={!isClickable}
                          onClick={(ev) => {
                            ev.stopPropagation();
                            if (!isClickable) return;
                            handleSlotClick(slot, r);
                          }}
                          className={[
                            'absolute left-1 right-1 rounded-lg border px-2 py-2 text-left shadow-sm',
                            !isClickable ? 'opacity-60 cursor-not-allowed' : 'hover:bg-gray-50 cursor-pointer',
                            isBookedLike ? 'bg-gray-100 border-gray-300' : '',
                            isBlocked ? 'bg-yellow-50 border-yellow-200' : '',
                          ].join(' ')}
                          style={{ top, height, zIndex: 20 }}
                        >
                          <div className="text-xs font-medium text-gray-900 truncate">
                            {isBookedLike ? getSlotDoctorShortName(slot) : ''}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {selectedSlot && selectedSlot.status === 'available' && (
        <BookingModal
          isOpen={isBookingModalOpen}
          onClose={() => {
            setIsBookingModalOpen(false);
            setSelectedSlot(null);
            setSelectedResource(null);
          }}
          slot={selectedSlot as any}
          resource={selectedResource}
          patients={patients}
          doctors={doctors}
          viewerUserId={viewerUserId}
          isReception={isReception}
          onSuccess={handleBookingSuccess}
        />
      )}
    </div>
  );
}