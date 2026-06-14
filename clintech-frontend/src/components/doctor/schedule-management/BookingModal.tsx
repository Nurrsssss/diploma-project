'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { TPatient } from '@/types/patient';
import { TDoctor } from '@/types/doctors';
import { useBookAppointmentByDoctor } from '@/hooks/appointment/useBookAppointmentByDoctor';
import MyButton from '@/components/ui/MyButton';
import { useQuestionnaires } from '@/hooks/files/useQuestionnaires';
import { useAuthenticatedFetch } from '@/hooks/auth/useAuthenticatedFetch';

// ---- types to match ReceptionSchedule ----
type ResourceKey =
  | 'cabinet-1'
  | 'cabinet-2'
  | 'cabinet-3'
  | 'cabinet-4'
  | 'cabinet-5'
  | 'cabinet-6'
  | 'cabinet-7'
  | 'cabinet-8'
  | 'home'
  | 'online'
  | 'lab';

export type ResourceDef = {
  key: ResourceKey;
  title: string;
  channel: 'cabinet' | 'home' | 'online' | 'lab';
  cabinetNumber?: number;
};

type Channel = 'cabinet' | 'home' | 'online' | 'lab';

type ServiceOption = {
  'data-price'?: number;
  'data-duration'?: number;
  'data-service_name'?: string;
};

type ServiceItem = {
  id: number | string;
  name: string;
  options?: ServiceOption;
  __categoryName?: string;
};

type ServicesJsonShape = {
  output?: Record<string, ServiceItem[]>;
};

type ServiceCategory = {
  categoryName: string;
  items: ServiceItem[];
};

// Красивое форматирование диапазона дат/времени без date-fns
function formatSlotRange(startISO: string, endISO: string) {
  try {
    const start = new Date(startISO);
    const end = new Date(endISO);

    const datePart = start.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });

    const timeStart = start.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const timeEnd = end.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    });

    return `${datePart}, ${timeStart}–${timeEnd}`;
  } catch {
    return `${startISO} → ${endISO}`;
  }
}

function doctorFio(d: TDoctor) {
  const fio = `${(d as any).last_name ?? ''} ${(d as any).first_name ?? ''}${
    (d as any).middle_name ? ' ' + (d as any).middle_name : ''
  }`.trim();
  return fio || (d as any).email || (d as any).phone || `Врач ${(d as any).id}`;
}

function toYmdLocal(d: Date) {
  const z = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

function formatMoney(value?: number) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  return `${value.toLocaleString('ru-RU')} ₸`;
}

function serviceTitle(s: ServiceItem) {
  const raw =
    String(s?.options?.['data-service_name'] ?? '').trim() ||
    String(s?.name ?? '').trim() ||
    `Услуга ${s?.id ?? ''}`;

  return raw.replace(/\t+/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeServicesData(rawJson: ServicesJsonShape): ServiceCategory[] {
  const output = rawJson?.output ?? {};
  const result: ServiceCategory[] = [];

  for (const [categoryName, rawItems] of Object.entries(output)) {
    const items = Array.isArray(rawItems) ? rawItems : [];
    const normalizedItems = items
      .map((item) => ({
        id: item.id,
        name: item.name,
        options: item.options ?? {},
      }))
      .filter(
        (item) =>
          String(item.id ?? '').trim() !== '' || String(item.name ?? '').trim() !== ''
      );

    if (normalizedItems.length > 0) {
      result.push({
        categoryName,
        items: normalizedItems,
      });
    }
  }

  return result.sort((a, b) => a.categoryName.localeCompare(b.categoryName, 'ru'));
}

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  slot: {
    id: string;
    start_time: string;
    backendAppointmentId?: string;
    end_time: string;
    title?: string;
    doctor_user_id?: string;
    [key: string]: any;
  };
  resource?: ResourceDef | null;
  patients: TPatient[];
  doctors?: TDoctor[];

  viewerUserId: string;
  isReception: boolean;
  onSuccess: (payload: {
    appointmentId: string;
    doctorId: string;
    doctorUserId: string;
    start_time: string;
    end_time: string;
    channel?: 'cabinet' | 'home' | 'online' | 'lab';
    cabinet_number?: number | null;
    title?: string;
  }) => void;
}

export const BookingModal = ({
  isOpen,
  onClose,
  slot,
  resource,
  patients,
  doctors = [],
  viewerUserId,
  isReception,
  onSuccess,
}: BookingModalProps) => {
  const authenticatedFetch = useAuthenticatedFetch();

  const [servicesCatalog, setServicesCatalog] = useState<ServicesJsonShape>({ output: {} });
  const [servicesLoading, setServicesLoading] = useState(false);
  const [servicesError, setServicesError] = useState('');

  const serviceCategories = useMemo(() => {
    return normalizeServicesData(servicesCatalog);
  }, [servicesCatalog]);

  const allServices = useMemo(() => {
    return serviceCategories.flatMap((cat) =>
      cat.items.map((item) => ({
        ...item,
        __categoryName: cat.categoryName,
      }))
    );
  }, [serviceCategories]);

  // ===== ПАЦИЕНТЫ =====
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [selectedPatientUserId, setSelectedPatientUserId] = useState<string>('');
  const [patientNotes, setPatientNotes] = useState('');
  const [selectedAnketaId, setSelectedAnketaId] = useState<string>('');

  // ===== УСЛУГИ =====
  const [serviceSearch, setServiceSearch] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [selectedCategoryName, setSelectedCategoryName] = useState<string>('all');

  // ===== ВРАЧ =====
  const [isDoctorPickerOpen, setIsDoctorPickerOpen] = useState(false);
  const [doctorSearch, setDoctorSearch] = useState('');

  // selectedDoctorId = doctors.id
  // selectedDoctorUserId = doctors.user_id
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [selectedDoctorUserId, setSelectedDoctorUserId] = useState<string>(() => {
    if (!isReception) return String(viewerUserId ?? '').trim();
    return '';
  });

  // ===== slot-check состояние =====
  const [resolvedAppointmentId, setResolvedAppointmentId] = useState<string>('');
  const [slotCheckError, setSlotCheckError] = useState<string>('');

  const effectiveChannel: Channel = (resource?.channel ?? 'cabinet') as Channel;
  const effectiveCabinetNumber: number | undefined =
    resource?.channel === 'cabinet' ? resource?.cabinetNumber ?? 1 : undefined;

  const effectiveAppointmentType: 'offline' | 'online' =
    effectiveChannel === 'online' ? 'online' : 'offline';

  const { bookAppointment, loading, error } = useBookAppointmentByDoctor();

  const doctorsWithUser = useMemo(
    () => doctors.filter((d) => String((d as any).user_id ?? '').trim().length > 0),
    [doctors]
  );

  const viewerDoctor = useMemo(() => {
    const uid = String(viewerUserId ?? '').trim();
    return doctorsWithUser.find((d) => String((d as any).user_id ?? '').trim() === uid);
  }, [doctorsWithUser, viewerUserId]);

  const selectedDoctor = useMemo(() => {
    if (!selectedDoctorUserId) return undefined;
    return doctorsWithUser.find((d) => String((d as any).user_id) === String(selectedDoctorUserId));
  }, [selectedDoctorUserId, doctorsWithUser]);

  const selectedPatient = useMemo(() => {
    if (!selectedPatientId) return undefined;
    return patients.find((p: any) => String(p.id) === String(selectedPatientId));
  }, [selectedPatientId, patients]);

  const selectedService = useMemo(() => {
    if (!selectedServiceId) return undefined;
    return allServices.find((s: any) => String(s.id) === String(selectedServiceId));
  }, [selectedServiceId, allServices]);

  const { questionnaires, loading: qLoading, error: qError } = useQuestionnaires(selectedPatientUserId);

  const filteredDoctors = useMemo(() => {
    const q = doctorSearch.trim().toLowerCase();
    if (!q) return doctorsWithUser;

    return doctorsWithUser.filter((d) => {
      const fio = doctorFio(d).toLowerCase();
      const phone = String((d as any).phone ?? '').toLowerCase();
      const email = String((d as any).email ?? '').toLowerCase();
      return fio.includes(q) || phone.includes(q) || email.includes(q);
    });
  }, [doctorSearch, doctorsWithUser]);

  const filteredPatients = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return patients;

    return patients.filter((patient: any) => {
      const fullName = `${patient.last_name ?? ''} ${patient.first_name ?? ''} ${patient.middle_name ?? ''}`.toLowerCase();
      const phone = String(patient.phone ?? '');
      const email = String(patient.email ?? '').toLowerCase();
      return fullName.includes(q) || phone.includes(searchQuery) || email.includes(q);
    });
  }, [patients, searchQuery]);

  const visibleServices = useMemo(() => {
    if (selectedCategoryName === 'all') return allServices;

    const category = serviceCategories.find((c) => c.categoryName === selectedCategoryName);
    if (!category) return [];

    return category.items.map((item) => ({
      ...item,
      __categoryName: category.categoryName,
    }));
  }, [allServices, selectedCategoryName, serviceCategories]);

  const filteredServices = useMemo(() => {
    const q = serviceSearch.trim().toLowerCase();
    if (!q) return visibleServices;

    return visibleServices.filter((s: any) => {
      const title = serviceTitle(s).toLowerCase();
      const fullName = String(s.name ?? '').toLowerCase();
      const price = String(s?.options?.['data-price'] ?? '');
      const categoryName = String(s.__categoryName ?? '').toLowerCase();

      return (
        title.includes(q) ||
        fullName.includes(q) ||
        price.includes(q) ||
        categoryName.includes(q)
      );
    });
  }, [visibleServices, serviceSearch]);

  const formattedRange = formatSlotRange(slot.start_time, slot.end_time);
  const canShowPatientStep = Boolean(selectedDoctorUserId);

  const isPastSlot = useMemo(() => {
    const startMs = new Date(slot.start_time).getTime();
    if (!Number.isFinite(startMs)) return false;
    return startMs < Date.now();
  }, [slot.start_time]);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    (async () => {
      try {
        setServicesLoading(true);
        setServicesError('');

        const res = await fetch('/api/services/catalog', {
          method: 'GET',
          cache: 'no-store',
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const json = await res.json();

        if (!cancelled) {
          setServicesCatalog(json ?? { output: {} });
        }
      } catch (e: any) {
        if (!cancelled) {
          setServicesCatalog({ output: {} });
          setServicesError(`Не удалось загрузить услуги: ${String(e?.message || e)}`);
        }
      } finally {
        if (!cancelled) {
          setServicesLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    if (!isReception) {
      const uid = String(viewerUserId ?? '').trim();
      setSelectedDoctorUserId(uid);
      setSelectedDoctorId(viewerDoctor ? String((viewerDoctor as any).id).trim() : '');
    }

    setSelectedPatientId('');
    setSelectedPatientUserId('');
    setSelectedAnketaId('');
    setSearchQuery('');
    setPatientNotes('');

    setSelectedServiceId('');
    setServiceSearch('');
    setSelectedCategoryName('all');

    setResolvedAppointmentId('');
    setSlotCheckError('');
  }, [isOpen, isReception, viewerUserId, viewerDoctor]);

  useEffect(() => {
    if (!isOpen) return;
    setResolvedAppointmentId('');
    setSlotCheckError('');
  }, [isOpen, selectedDoctorId, slot.start_time]);

  function isUuid(value: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  }

  useEffect(() => {
    if (!isOpen) return;

    if (!selectedDoctorUserId) {
      setResolvedAppointmentId('');
      setSlotCheckError('');
      return;
    }

    const startISO = String(slot.start_time || '');
    if (!startISO) {
      setResolvedAppointmentId('');
      setSlotCheckError('');
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setSlotCheckError('');
        setResolvedAppointmentId('');

        const clickD = new Date(startISO);
        const date = toYmdLocal(clickD);
        const clickMs = clickD.getTime();

        const params = new URLSearchParams();
        params.set('date', date);
        params.set('include_all', '1');
        params.set('include_booked', '1');
        params.set('include_cancelled', '1');

        const url = `/api/doctors/${encodeURIComponent(
          selectedDoctorUserId
        )}/available-slots?${params.toString()}`;

        const res = await authenticatedFetch(url, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const json = await res.json();
        const payload = json?.data ?? json ?? {};
        const slots: any[] = payload?.slots ?? payload?.Slots ?? payload ?? [];
        const slotsArr = Array.isArray(slots) ? slots : [];

        const normalized = slotsArr.map((s) => {
          const id = String(s.id ?? '').trim();
          const rawStart = String(s.start_time ?? s.startTime ?? '');
          const rawEnd = String(s.end_time ?? s.endTime ?? '');
          const startMs = new Date(rawStart).getTime();
          const endMs = new Date(rawEnd).getTime();
          const status = String(s.status ?? '').trim();
          const patientId = String(s.patient_id ?? '').trim();

          return {
            id,
            startMs,
            endMs,
            status,
            patientId,
            raw: s,
          };
        });

        let exact = normalized.find((x) => x.startMs === clickMs);

        if (!exact) {
          exact = normalized.find((x) => Math.abs(x.startMs - clickMs) < 30_000);
        }

        if (!exact) {
          if (cancelled) return;
          setResolvedAppointmentId('');
          setSlotCheckError('Не найден слот врача на это время.');
          return;
        }

        if (!isUuid(exact.id)) {
          if (cancelled) return;
          setResolvedAppointmentId('');
          setSlotCheckError('Слот найден, но его ID некорректный.');
          return;
        }

        if (exact.patientId) {
          if (cancelled) return;
          setResolvedAppointmentId('');
          setSlotCheckError('Этот слот уже занят пациентом.');
          return;
        }

        if (!isPastSlot && exact.status !== 'available') {
          if (cancelled) return;
          setResolvedAppointmentId('');
          setSlotCheckError('У выбранного врача нет доступного слота на это время.');
          return;
        }

        if (cancelled) return;
        setResolvedAppointmentId(exact.id);
        setSlotCheckError('');
      } catch (e: any) {
        if (cancelled) return;
        setResolvedAppointmentId('');
        setSlotCheckError('Ошибка при проверке слота: ' + String(e?.message || e));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, selectedDoctorUserId, slot.start_time, isPastSlot, authenticatedFetch]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedDoctorUserId || !selectedDoctorId) return alert('Выберите врача');
    if (!selectedServiceId) return alert('Выберите услугу');
    if (!selectedPatientId) return alert('Выберите пациента');
    if (!resolvedAppointmentId) return alert('Нет подходящего свободного слота на выбранное время');

    const ok = await bookAppointment({
      appointmentId: resolvedAppointmentId,
      patientId: selectedPatientId,
      appointmentType: effectiveAppointmentType,
      patientNotes,
      anketaId: selectedAnketaId || undefined,
      doctorUserId: selectedDoctorUserId,
      serviceId: selectedServiceId || undefined,
      channel: effectiveChannel,
      cabinetNumber: effectiveChannel === 'cabinet' ? effectiveCabinetNumber : undefined,
    } as any);

    if (ok) {
      onSuccess({
        appointmentId: resolvedAppointmentId,
        doctorId: selectedDoctorId,
        doctorUserId: selectedDoctorUserId,
        start_time: slot.start_time,
        end_time: slot.end_time,
        channel: effectiveChannel,
        cabinet_number: effectiveChannel === 'cabinet' ? (effectiveCabinetNumber ?? 1) : null,
        title: selectedService ? `Забронировано: ${serviceTitle(selectedService)}` : 'Забронировано',
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-xl">
        <div className="sticky top-0 border-b border-gray-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Запись пациента</h2>
              <p className="mt-1 text-gray-600">
                {slot.title || 'Приём'} • {formattedRange}
              </p>
              {resource?.title ? (
                <p className="mt-1 text-xs text-gray-500">Колонка: {resource.title}</p>
              ) : null}
            </div>
            <button onClick={onClose} className="rounded-lg p-2 hover:bg-gray-100" type="button">
              ✕
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 p-6">
          <div className="rounded-lg border bg-gray-50 p-3 text-sm text-gray-700">
            <div className="font-medium">Место приёма</div>
            <div className="mt-1">
              {resource?.title ? resource.title : '—'}
              {effectiveChannel === 'cabinet' && effectiveCabinetNumber
                ? ` (кабинет ${effectiveCabinetNumber})`
                : ''}
            </div>
            <div className="mt-1 text-xs text-gray-500">
              Тип приёма: <b>{effectiveAppointmentType === 'online' ? 'Онлайн' : 'Очный'}</b>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Врач *</label>

            {!isReception ? (
              <div className="rounded-lg border bg-gray-50 p-3 text-sm text-gray-700">
                Врач: <b>{selectedDoctor ? doctorFio(selectedDoctor) : '—'}</b>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setIsDoctorPickerOpen((v) => !v)}
                    className="rounded-lg border px-4 py-2 hover:bg-gray-50"
                  >
                    {selectedDoctor ? `Врач: ${doctorFio(selectedDoctor)}` : 'Выбрать врача'}
                  </button>

                  {(selectedDoctorUserId || selectedDoctorId) && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDoctorUserId('');
                        setSelectedDoctorId('');
                        setDoctorSearch('');

                        setSelectedPatientId('');
                        setSelectedPatientUserId('');
                        setSearchQuery('');
                        setSelectedAnketaId('');

                        setSelectedServiceId('');
                        setServiceSearch('');
                        setSelectedCategoryName('all');

                        setResolvedAppointmentId('');
                        setSlotCheckError('');
                      }}
                      className="rounded-lg border px-4 py-2 text-red-600 hover:bg-red-50"
                    >
                      Сбросить врача
                    </button>
                  )}
                </div>

                {selectedDoctorUserId && (
                  <div className="rounded-lg border bg-gray-50 p-3 text-sm text-gray-700">
                    {slotCheckError ? <div className="text-red-600">{slotCheckError}</div> : null}
                    {!slotCheckError && resolvedAppointmentId && !isPastSlot ? (
                      <div className="text-green-700">Свободное время подтверждено.</div>
                    ) : null}
                  </div>
                )}

                {isDoctorPickerOpen && (
                  <div className="space-y-3 rounded-lg border p-3">
                    <input
                      value={doctorSearch}
                      onChange={(e) => setDoctorSearch(e.target.value)}
                      placeholder="Поиск врача (ФИО, телефон, email)..."
                      className="w-full rounded-lg border border-gray-300 px-4 py-2"
                    />

                    <div className="max-h-56 overflow-y-auto rounded-lg border">
                      {filteredDoctors.length === 0 ? (
                        <div className="p-4 text-center text-gray-500">Врачи не найдены</div>
                      ) : (
                        filteredDoctors.map((d) => {
                          const uid = String((d as any).user_id ?? '').trim();
                          const did = String((d as any).id ?? '').trim();
                          const isSelected = selectedDoctorUserId === uid;

                          return (
                            <button
                              key={uid || did}
                              type="button"
                              onClick={() => {
                                setSelectedDoctorUserId(uid);
                                setSelectedDoctorId(did);
                                setIsDoctorPickerOpen(false);

                                setSelectedPatientId('');
                                setSelectedPatientUserId('');
                                setSearchQuery('');
                                setSelectedAnketaId('');

                                setSelectedServiceId('');
                                setServiceSearch('');
                                setSelectedCategoryName('all');

                                setResolvedAppointmentId('');
                                setSlotCheckError('');
                              }}
                              className={[
                                'w-full border-b p-4 text-left hover:bg-gray-50 last:border-b-0',
                                isSelected ? 'border-l-4 border-l-blue-500 bg-blue-50' : '',
                              ].join(' ')}
                            >
                              <div className="font-medium text-gray-900">{doctorFio(d)}</div>
                              <div className="mt-1 flex gap-4 text-sm text-gray-600">
                                {(d as any).phone ? <span>{(d as any).phone}</span> : null}
                                {(d as any).email ? <span>{(d as any).email}</span> : null}
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {!canShowPatientStep ? (
            <div className="rounded-lg border bg-gray-50 p-4 text-sm text-gray-600">
              Сначала выберите <b>врача</b>, затем появится выбор пациента и услуги.
            </div>
          ) : (
            <>
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">Услуга *</label>

                {servicesError ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                    {servicesError}
                  </div>
                ) : null}

                <div className="grid grid-cols-1 gap-3">
                  <select
                    value={selectedCategoryName}
                    onChange={(e) => {
                      setSelectedCategoryName(e.target.value);
                      setSelectedServiceId('');
                    }}
                    className="w-full rounded-lg border px-3 py-2"
                    disabled={servicesLoading}
                  >
                    <option value="all">Все категории</option>
                    {serviceCategories.map((category) => (
                      <option key={category.categoryName} value={category.categoryName}>
                        {category.categoryName} ({category.items.length})
                      </option>
                    ))}
                  </select>

                  <input
                    type="text"
                    value={serviceSearch}
                    onChange={(e) => setServiceSearch(e.target.value)}
                    placeholder="Поиск услуги по названию, категории или цене"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-blue-500"
                    disabled={servicesLoading}
                  />
                </div>

                <div className="max-h-72 overflow-y-auto rounded-lg border">
                  {servicesLoading ? (
                    <div className="p-4 text-center text-gray-500">Загрузка услуг...</div>
                  ) : filteredServices.length === 0 ? (
                    <div className="p-4 text-center text-gray-500">Услуги не найдены</div>
                  ) : (
                    filteredServices.map((s: any) => {
                      const isSelected = selectedServiceId === String(s.id);
                      const price = s?.options?.['data-price'];
                      const duration = s?.options?.['data-duration'];

                      return (
                        <button
                          key={`${String(s.__categoryName ?? 'cat')}::${String(s.id)}`}
                          type="button"
                          onClick={() => setSelectedServiceId(String(s.id))}
                          className={[
                            'w-full border-b p-4 text-left hover:bg-gray-50 last:border-b-0',
                            isSelected ? 'border-l-4 border-l-blue-500 bg-blue-50' : '',
                          ].join(' ')}
                        >
                          <div className="font-medium text-gray-900">{serviceTitle(s)}</div>
                          <div className="mt-1 flex flex-wrap gap-4 text-sm text-gray-600">
                            <span>Категория: {String(s.__categoryName ?? '—')}</span>
                            <span>ID: {s.id}</span>
                            <span>Цена: {formatMoney(price)}</span>
                            <span>
                              Длительность:{' '}
                              {typeof duration === 'number' ? `${duration} мин` : '—'}
                            </span>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>

                {selectedService && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                    <p className="mb-1 text-sm font-medium text-blue-900">Выбранная услуга:</p>
                    <p className="font-semibold text-blue-900">{serviceTitle(selectedService)}</p>
                    <div className="mt-1 text-sm text-blue-800">
                      Категория: {String((selectedService as any).__categoryName ?? '—')}
                      {' • '}
                      Цена: {formatMoney(selectedService?.options?.['data-price'])}
                      {' • '}
                      Длительность:{' '}
                      {typeof selectedService?.options?.['data-duration'] === 'number'
                        ? `${selectedService.options['data-duration']} мин`
                        : '—'}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Поиск пациента
                </label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Введите ФИО, телефон или email"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Выберите пациента *
                </label>
                <div className="max-h-60 overflow-y-auto rounded-lg border">
                  {filteredPatients.length === 0 ? (
                    <div className="p-4 text-center text-gray-500">Пациенты не найдены</div>
                  ) : (
                    filteredPatients.map((p: any) => {
                      const isSelected = selectedPatientId === String(p.id);
                      return (
                        <button
                          key={String(p.id)}
                          type="button"
                          onClick={() => {
                            setSelectedPatientId(String(p.id));
                            setSelectedPatientUserId(String(p.user_id));
                            setSelectedAnketaId('');
                          }}
                          className={[
                            'w-full border-b p-4 text-left hover:bg-gray-50 last:border-b-0',
                            isSelected ? 'border-l-4 border-l-blue-500 bg-blue-50' : '',
                          ].join(' ')}
                        >
                          <p className="font-medium text-gray-900">
                            {p.last_name} {p.first_name} {p.middle_name}
                          </p>
                          <div className="mt-1 flex gap-4 text-sm text-gray-600">
                            {p.phone ? <span>{p.phone}</span> : null}
                            {p.email ? <span>{p.email}</span> : null}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {selectedPatient && (
                <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
                  <div>
                    <p className="mb-1 text-sm font-medium text-blue-900">Выбранный пациент:</p>
                    <p className="font-semibold text-blue-900">
                      {(selectedPatient as any).last_name} {(selectedPatient as any).first_name}{' '}
                      {(selectedPatient as any).middle_name}
                    </p>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Анкета для приёма (необязательно)
                    </label>

                    {qLoading ? (
                      <div className="text-gray-600">Загрузка анкет...</div>
                    ) : qError ? (
                      <div className="text-red-600">Ошибка: {qError}</div>
                    ) : (
                      <select
                        value={selectedAnketaId || 'none'}
                        onChange={(e) =>
                          setSelectedAnketaId(e.target.value === 'none' ? '' : e.target.value)
                        }
                        className="w-full rounded-lg border px-3 py-2"
                      >
                        <option value="none">Без анкеты</option>
                        {questionnaires && questionnaires.length > 0
                          ? [...questionnaires]
                              .sort(
                                (a, b) =>
                                  new Date(b.created_at).getTime() -
                                  new Date(a.created_at).getTime()
                              )
                              .map((a, idx) => (
                                <option key={a.id} value={a.id}>
                                  {idx === 0 ? 'Последняя: ' : ''}Анкета от{' '}
                                  {new Date(a.created_at).toLocaleString('ru-RU')}
                                </option>
                              ))
                          : null}
                      </select>
                    )}

                    {(!questionnaires || questionnaires.length === 0) && !qLoading && !qError && (
                      <p className="mt-1 text-sm text-gray-500">
                        У пациента нет анкет. Можно записать без анкеты.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Заметки (необязательно)
            </label>
            <textarea
              value={patientNotes}
              onChange={(e) => setPatientNotes(e.target.value)}
              rows={4}
              maxLength={1000}
              className="w-full resize-none rounded-lg border px-4 py-2"
              placeholder="Доп. информация..."
            />
          </div>

          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          ) : null}

          <div className="flex gap-3 border-t border-gray-200 pt-4">
            <MyButton type="button" onClick={onClose} className="flex-1 border">
              Отмена
            </MyButton>

            <MyButton
              type="submit"
              disabled={
                loading ||
                servicesLoading ||
                !selectedDoctorUserId ||
                !selectedPatientId ||
                !selectedServiceId ||
                !resolvedAppointmentId
              }
              className="flex-1 bg-blue-600 text-white"
            >
              {loading ? 'Записываем...' : 'Записать пациента'}
            </MyButton>
          </div>
        </form>
      </div>
    </div>
  );
};