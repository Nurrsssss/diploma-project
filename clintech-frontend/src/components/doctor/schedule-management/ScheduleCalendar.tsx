'use client';

import type { DoctorSlot } from '@/hooks/appointment/useDoctorAvailableSlots';
import type { ResourceDef } from './BookingModal';
import { useMemo } from 'react';

// ===== utils dates (без date-fns) =====
function addDays(d: Date, days: number) {
  const nd = new Date(d);
  nd.setDate(nd.getDate() + days);
  return nd;
}
function startOfIsoWeek(d: Date) {
  const nd = new Date(d);
  const day = (nd.getDay() + 6) % 7; // 0..6 (пн..вс)
  nd.setHours(0, 0, 0, 0);
  return addDays(nd, -day);
}
function ymd(d: Date) {
  const z = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}
function dowShortRu(d: Date) {
  return ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'][(d.getDay() + 6) % 7];
}

// ===== вычисляем колонку (resource_key) если бэк её не дал =====
function inferResourceKey(s: any): string {
  const ch = s?.channel ?? null;
  const cabRaw = s?.cabinet_number ?? s?.cabinetNumber ?? null;
  const cab = Number(cabRaw ?? 1);

  if (ch === 'home') return 'home';
  if (ch === 'online') return 'online';
  if (ch === 'lab') return 'lab';
  if (ch === 'cabinet') {
    const safe = cab >= 1 && cab <= 6 ? cab : 1;
    return `cabinet-${safe}`;
  }

  // fallback по типу приёма
  const at = s?.appointment_type ?? s?.appointmentType ?? null;
  if (at === 'online') return 'online';
  if (at === 'offline') {
    const safe = cab >= 1 && cab <= 6 ? cab : 1;
    return `cabinet-${safe}`;
  }

  // общий fallback
  const safe = cab >= 1 && cab <= 6 ? cab : 1;
  return `cabinet-${safe}`;
}

/**
 * ✅ FIX: фильтруем слоты по дате В АЛМАТЫ (UTC+5), а не по iso.slice(0,10) (это UTC-дата)
 * Иначе слоты, которые по UTC попадают на другую дату, полностью пропадают из daySlots.
 */
const DEBUG_CAL = true;
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

function ymdLocalFromUtcMs(ms: number): string {
  const shifted = ms + ALMATY_OFFSET_MIN * 60_000;
  const d = new Date(shifted);
  const z = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${z(d.getUTCMonth() + 1)}-${z(d.getUTCDate())}`;
}

function isoToYmdKeyAlmaty(iso: string): string {
  const ms = parseToUtcMsStable(String(iso ?? ''));
  if (!Number.isFinite(ms)) return '';
  return ymdLocalFromUtcMs(ms);
}

// (оставим старое для сравнения в логах)
function isoToYmdKeyUtcSlice(iso: string): string {
  if (!iso) return '';
  return String(iso).slice(0, 10);
}

interface ScheduleCalendarProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  slots: DoctorSlot[];
  loading: boolean;
  error: string | null;

  resources: ResourceDef[];

  onSlotClick: (slotId: string, resourceKey?: string) => void;

  onCancelSlot?: (slotId: string) => void;
}

export const ScheduleCalendar = ({
  selectedDate,
  onDateChange,
  slots,
  loading,
  error,
  resources,
  onSlotClick,
  onCancelSlot,
}: ScheduleCalendarProps) => {
  const weekStart = startOfIsoWeek(selectedDate);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const selectedKey = ymd(selectedDate);
  const todayKey = ymd(new Date());

  // ✅ 1) ФИЛЬТР ПО ВЫБРАННОМУ ДНЮ В АЛМАТЫ
  const daySlots = useMemo(() => {
    return slots.filter((s: any) => isoToYmdKeyAlmaty(String(s.start_time)) === selectedKey);
  }, [slots, selectedKey]);

  // ✅ ЛОГИ (чтобы сразу увидеть, что раньше всё уходило в другой день)
  useMemo(() => {
    if (!DEBUG_CAL) return;

    // eslint-disable-next-line no-console
    console.log('[CAL] selectedKey', selectedKey, 'slots total', slots.length);

    // eslint-disable-next-line no-console
    console.log(
      '[CAL] sample keys',
      (slots as any[]).slice(0, 10).map((s) => ({
        id: s.id,
        status: s.status,
        start_time: s.start_time,
        end_time: s.end_time,
        keyUtcSlice: isoToYmdKeyUtcSlice(String(s.start_time)),
        keyAlmaty: isoToYmdKeyAlmaty(String(s.start_time)),
        rk: (s as any).resource_key ?? inferResourceKey(s),
      }))
    );

    // eslint-disable-next-line no-console
    console.log('[CAL] daySlots', daySlots.length);
  }, [selectedKey, slots, daySlots.length]);

  const availableSlots = useMemo(() => daySlots.filter((s: any) => s.status === 'available'), [daySlots]);
  const bookedSlots = useMemo(() => daySlots.filter((s: any) => s.status === 'booked'), [daySlots]);
  const cancelledSlots = useMemo(() => daySlots.filter((s: any) => s.status === 'cancelled'), [daySlots]);
  const blockedSlots = useMemo(() => daySlots.filter((s: any) => s.status === 'blocked'), [daySlots]);

  // ✅ 2) ГРУППИРОВКА ПО РЕСУРСАМ:
  //    используем resource_key если есть, иначе вычисляем из channel/cabinet/appointment_type
  const slotsByResource = useMemo(() => {
    const map = new Map<string, DoctorSlot[]>();
    for (const r of resources) map.set(r.key, []);

    for (const s of daySlots as any[]) {
      const rk = (s as any).resource_key ?? inferResourceKey(s);
      if (!map.has(rk)) map.set(rk, []);
      map.get(rk)!.push(s);
    }

    for (const [k, arr] of map.entries()) {
      arr.sort((a: any, b: any) => String(a.start_time).localeCompare(String(b.start_time)));
      map.set(k, arr);
    }

    return map;
  }, [daySlots, resources]);

  return (
    <div className="space-y-6">
      {/* Переключатель недель */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => onDateChange(addDays(selectedDate, -7))}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="Предыдущая неделя"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="text-center">
          <p className="text-sm text-gray-600">Неделя</p>
          <p className="font-medium">
            {weekDays[0].getDate()}–{weekDays[6].getDate()}{' '}
            {weekDays[6].toLocaleString('ru-RU', { month: 'short', year: 'numeric' })}
          </p>
        </div>

        <button
          onClick={() => onDateChange(addDays(selectedDate, 7))}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="Следующая неделя"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Дни недели */}
      <div className="grid grid-cols-7 gap-2">
        {weekDays.map((day) => {
          const key = ymd(day);
          const isSelected = key === selectedKey;
          const isToday = key === todayKey;
          return (
            <button
              key={key}
              onClick={() => onDateChange(day)}
              className={`p-3 rounded-lg text-center transition-colors ${
                isSelected
                  ? 'bg-blue-500 text-white'
                  : isToday
                  ? 'bg-blue-50 text-blue-600 border border-blue-200'
                  : 'hover:bg-gray-100'
              }`}
            >
              <p className="text-xs mb-1">{dowShortRu(day)}</p>
              <p className="text-lg font-semibold">{day.getDate()}</p>
            </button>
          );
        })}
      </div>

      {/* Легенда */}
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded bg-green-200 border border-green-400" /> Свободно
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded bg-gray-200 border border-gray-400" /> Занято
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded bg-red-200 border border-red-400" /> Отменено
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded bg-yellow-200 border border-yellow-400" /> Заблокировано
        </span>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
        <div>
          <p className="text-sm text-gray-600">Свободных</p>
          <p className="text-2xl font-bold text-green-600">{availableSlots.length}</p>
        </div>
        <div>
          <p className="text-sm text-gray-600">Занято</p>
          <p className="text-2xl font-bold text-gray-600">{bookedSlots.length}</p>
        </div>
        <div>
          <p className="text-sm text-gray-600">Отменено</p>
          <p className="text-2xl font-bold text-red-600">{cancelledSlots.length}</p>
        </div>
        <div>
          <p className="text-sm text-gray-600">Заблокировано</p>
          <p className="text-2xl font-bold text-yellow-600">{blockedSlots.length}</p>
        </div>
      </div>

      {/* Слоты на день — по колонкам ресурсов */}
      <div>
        <h3 className="font-medium text-gray-900 mb-3">Слоты на день</h3>

        {loading ? (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
            <p className="text-gray-600 mt-2">Загрузка слотов...</p>
          </div>
        ) : error ? (
          <div className="text-center py-8 text-red-600">{error}</div>
        ) : daySlots.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <svg
              className="mx-auto h-12 w-12 text-gray-400 mb-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p>Нет слотов на выбранную дату</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {resources.map((resource) => {
              const colSlots = slotsByResource.get(resource.key) ?? [];

              return (
                <div key={resource.key} className="rounded-lg border border-gray-200 overflow-hidden">
                  <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
                    <div className="text-sm font-semibold text-gray-900">{resource.title}</div>
                    <div className="text-xs text-gray-500">{resource.key}</div>
                  </div>

                  <div className="p-3 space-y-3 max-h-[32rem] overflow-y-auto">
                    {colSlots.length === 0 ? (
                      <div className="text-sm text-gray-500 py-6 text-center">Нет слотов</div>
                    ) : (
                      colSlots.map((slot: any) => {
                        const base = 'p-3 rounded-lg border-2 transition-colors text-left';
                        const common = 'flex items-start justify-between gap-2';
                        const isBookedLike = slot.status === 'booked' || slot.status === 'completed';

const statusCls =
  slot.status === 'available'
    ? 'bg-green-50 border-green-200 hover:bg-green-100 hover:border-green-400 cursor-pointer'
    : isBookedLike
    ? 'bg-gray-50 border-gray-200 hover:bg-gray-100 hover:border-gray-400 cursor-pointer'
    : slot.status === 'cancelled'
    ? 'bg-red-50 border-red-200 text-red-900 opacity-70 cursor-not-allowed'
    : 'bg-yellow-50 border-yellow-200 opacity-70 cursor-not-allowed';

const fullName =
  slot.patient
    ? `${slot.patient.last_name ?? ''} ${slot.patient.first_name ?? ''}${
        slot.patient.middle_name ? ' ' + slot.patient.middle_name : ''
      }`.trim()
    : null;

const clickable =
  slot.status === 'available' ||
  slot.status === 'booked' ||
  slot.status === 'completed';
                        return (
                          <div
                            key={slot.id}
                            className={`${base} ${statusCls}`}
                            onClick={clickable ? () => onSlotClick(slot.id, resource.key) : undefined}
                          >
                            <div className={common}>
                              <div className="flex-1">
                                <div className="font-semibold text-gray-900">
                                  {slot.start_hhmm}–{slot.end_hhmm}
                                </div>
                                <div className="text-xs text-gray-600">{slot.title ?? ''}</div>

{isBookedLike && (
  <div className="mt-2 text-sm text-gray-700">
    <div className="text-gray-800">{fullName || 'Пациент'}</div>
    {slot.patient?.email && <div className="text-gray-600 text-xs">{slot.patient.email}</div>}
    {slot.patient?.phone && <div className="text-gray-600 text-xs">{slot.patient.phone}</div>}
  </div>

                                )}

                                {slot.status === 'cancelled' && <div className="mt-2 text-sm">Отменено</div>}
                                {slot.status === 'blocked' && <div className="mt-2 text-sm">Заблокировано</div>}
                              </div>

                              <div className="flex items-start gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                                {slot.status === 'booked' && onCancelSlot && (
                                  <button
                                    onClick={() => {
                                      if (confirm(`Вы уверены, что хотите отменить запись пациента ${fullName || 'пациента'}?`)) {
                                        onCancelSlot(slot.id);
                                      }
                                    }}
                                    className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                                    title="Отменить запись"
                                    aria-label="Отменить запись"
                                  >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                )}

                                {isBookedLike && (
  <button
    onClick={() => onSlotClick(slot.id, resource.key)}
                                    className="p-1.5 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                                    title="Подробнее"
                                    aria-label="Подробнее"
                                  >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                  </button>
                                )}

                                {slot.status === 'available' && (
                                  <svg
                                    className="w-5 h-5 mt-1 shrink-0 text-gray-400"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                  </svg>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};