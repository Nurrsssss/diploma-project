'use client';

import { useEffect, useMemo, useState } from 'react';
import PagesLayout from '@/components/layout/general/PagesLayout';
import PageStateWrapper from '@/components/ui/PageStateWrapper';
import DropdownTabs from '@/components/ui/DropdownTabs';
import CompactDoctorPicker from '@/components/doctor/schedule-management/CompactDoctorPicker';

import { useDoctors } from '@/hooks/doctor/useDoctors';
import { useAuthenticatedFetch } from '@/hooks/auth/useAuthenticatedFetch';

import Schedules from '@/components/doctor/appointments/schedule/common/Schedules';
import DoctorScheduleManager from '@/components/doctor/schedule/DoctorScheduleManager';

import {
  FaCalendarAlt,
  FaBan,
  FaUserEdit,
  FaPlus,
} from 'react-icons/fa';

const DISABLE_ALL = '__DISABLE_ALL__';

export default function ReceptionMyAppointments() {
  const [activeTab, setActiveTab] = useState<string>('schedule');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const { doctors, loading, error, refetch } = useDoctors();
  const authenticatedFetch = useAuthenticatedFetch();

  const [selectedDoctorInternalId, setSelectedDoctorInternalId] = useState<string | null>(null);
  const [isCreateDoctorOpen, setIsCreateDoctorOpen] = useState(false);

  // auto select first doctor
  useEffect(() => {
    if (!doctors?.length) return;
    if (selectedDoctorInternalId) return;
    setSelectedDoctorInternalId(String(doctors[0].id));
  }, [doctors, selectedDoctorInternalId]);

  // users.id для расписания
  const selectedDoctorUserId = useMemo(() => {
    if (!selectedDoctorInternalId) return null;
    const doc = doctors.find((d: any) => String(d.id) === String(selectedDoctorInternalId));
    return doc?.user_id ? String(doc.user_id).trim() : null;
  }, [doctors, selectedDoctorInternalId]);

  const tabsForReception = useMemo(
    () => [
      { label: 'Основной график', value: 'schedule', icon: <FaCalendarAlt /> },
      { label: 'Закрытия/исключения', value: 'schedule-management', icon: <FaBan /> },
      { label: 'Профиль', value: 'profile', icon: <FaUserEdit /> },
    ],
    []
  );

  return (
    <PagesLayout title="Расписание врачей" isBackButton={true}>
      <PageStateWrapper
        loading={loading}
        error={error}
        isEmpty={!doctors.length && !loading}
        emptyTitle="Врачи не найдены"
        emptyDescription="В системе нет доступных врачей"
        onRetry={refetch}
        loadingText="Загрузка данных"
      >
        <div className="container">

          {/* Выбор врача + кнопка */}
          <div className="mb-4 flex flex-col md:flex-row gap-3 md:items-center">
            <div className="flex-1">
              <CompactDoctorPicker
                doctors={doctors}
                selectedDoctorId={selectedDoctorInternalId}
                onSelectDoctor={setSelectedDoctorInternalId}
                allDoctorsId={DISABLE_ALL}
              />
            </div>

            <button
              onClick={() => setIsCreateDoctorOpen(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary text-white hover:bg-primary/90"
            >
              <FaPlus />
              Добавить
            </button>
          </div>

          <DropdownTabs
            tabs={tabsForReception}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            isMobileMenuOpen={isMobileMenuOpen}
            setIsMobileMenuOpen={setIsMobileMenuOpen}
          />

          {!selectedDoctorInternalId ? (
            <div className="bg-white rounded-xl shadow-sm p-12 text-center text-gray-500">
              Выберите врача
            </div>
          ) : (
            <>
              {activeTab === 'schedule' && selectedDoctorUserId && (
                <Schedules doctorId={selectedDoctorUserId} />
              )}

              {activeTab === 'schedule-management' && selectedDoctorUserId && (
                <DoctorScheduleManager doctorId={selectedDoctorUserId} />
              )}

              {activeTab === 'profile' && (
                <DoctorProfile
                  doctorId={selectedDoctorInternalId}
                  onDeleted={() => {
                    refetch();
                    setSelectedDoctorInternalId(null);
                    setActiveTab('schedule');
                  }}
                  onSaved={refetch}
                />
              )}
            </>
          )}
        </div>
      </PageStateWrapper>

      <CreateDoctorModal
        open={isCreateDoctorOpen}
        onClose={() => setIsCreateDoctorOpen(false)}
        onCreated={refetch}
      />
    </PagesLayout>
  );
}

//////////////////////////////////////////
// 👇 ПРОФИЛЬ ВРАЧА
//////////////////////////////////////////
function DoctorProfile({ doctorId, onDeleted, onSaved }: any) {
  const authenticatedFetch = useAuthenticatedFetch()

  const [form, setForm] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)

        const res = await authenticatedFetch(`/api/doctors/${doctorId}/management`)

        if (!res.ok) {
          const text = await res.text()
          throw new Error(text || 'Не удалось загрузить профиль врача')
        }

        const data = await res.json()
        setForm(data)
      } catch (e: any) {
        alert(e.message || 'Ошибка загрузки профиля')
        setForm(null)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [doctorId, authenticatedFetch])

  const parseList = (value: string) =>
    value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)

  const handleSave = async () => {
    try {
      const payload = {
        first_name: form.first_name?.trim() || '',
        middle_name: form.middle_name?.trim() || '',
        last_name: form.last_name?.trim() || '',
        phone: form.phone?.trim() || '',
        email: form.email?.trim() || '',
        description: form.description?.trim() || '',
        avatar_url: form.avatar_url?.trim() || '',
        roles: parseList(form.roles_text || ''),
        price: Number(form.price || 0),
        education: parseList(form.education_text || ''),
        certificates: parseList(form.certificates_text || ''),
      }

      const res = await authenticatedFetch(`/api/doctors/${doctorId}/reception`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || 'Не удалось сохранить врача')
      }

      const data = await res.json()
      setForm({
        ...data,
        roles_text: Array.isArray(data.roles) ? data.roles.join(', ') : '',
        education_text: Array.isArray(data.education) ? data.education.join(', ') : '',
        certificates_text: Array.isArray(data.certificates) ? data.certificates.join(', ') : '',
      })
      alert('Сохранено')
      onSaved?.()
    } catch (e: any) {
      alert(e.message || 'Ошибка сохранения')
    }
  }

  const handleDelete = async () => {
    if (!confirm('Удалить врача?')) return

    try {
      const res = await authenticatedFetch(`/api/doctors/${doctorId}/reception`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || 'Не удалось удалить врача')
      }

      alert('Удалено')
      onDeleted?.()
    } catch (e: any) {
      alert(e.message || 'Ошибка удаления')
    }
  }

  useEffect(() => {
    if (!form) return
    setForm((prev: any) => ({
      ...prev,
      roles_text: Array.isArray(prev.roles) ? prev.roles.join(', ') : prev.roles_text || '',
      education_text: Array.isArray(prev.education) ? prev.education.join(', ') : prev.education_text || '',
      certificates_text: Array.isArray(prev.certificates) ? prev.certificates.join(', ') : prev.certificates_text || '',
    }))
  }, [loading])

  if (loading) {
    return <div className="p-6 bg-white rounded-2xl shadow-sm">Загрузка...</div>
  }

  if (!form) {
    return (
      <div className="p-6 bg-white rounded-2xl shadow-sm text-red-500">
        Не удалось загрузить профиль врача
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-white to-gray-50">
        <h2 className="text-xl font-bold text-gray-900">Профиль врача</h2>
        <p className="text-sm text-gray-500 mt-1">
          Редактирование основных данных врача
        </p>
      </div>

      <div className="p-6 space-y-6">
        <div>
          <div className="text-sm font-semibold text-gray-900 mb-3">Основная информация</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Имя">
              <input
                value={form.first_name || ''}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-primary"
                placeholder="Имя"
              />
            </Field>

            <Field label="Фамилия">
              <input
                value={form.last_name || ''}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-primary"
                placeholder="Фамилия"
              />
            </Field>

            <Field label="Отчество">
              <input
                value={form.middle_name || ''}
                onChange={(e) => setForm({ ...form, middle_name: e.target.value })}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-primary"
                placeholder="Отчество"
              />
            </Field>

            <Field label="Телефон">
              <input
                value={form.phone || ''}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-primary"
                placeholder="Телефон"
              />
            </Field>

            <Field label="Email">
              <input
                value={form.email || ''}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-primary"
                placeholder="Email"
              />
            </Field>

            <Field label="Цена приема">
              <input
                type="number"
                value={form.price || 0}
                onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-primary"
                placeholder="Цена"
              />
            </Field>
          </div>
        </div>

        <div>
          <div className="text-sm font-semibold text-gray-900 mb-3">Профессиональная информация</div>
          <div className="space-y-4">
            <Field label="Специализации">
              <input
                value={form.roles_text || ''}
                onChange={(e) => setForm({ ...form, roles_text: e.target.value })}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-primary"
                placeholder="Например: Терапевт, Кардиолог"
              />
            </Field>

            <Field label="Описание">
              <textarea
                value={form.description || ''}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full min-h-[110px] rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-primary"
                placeholder="Описание врача"
              />
            </Field>

            <Field label="Образование">
              <textarea
                value={form.education_text || ''}
                onChange={(e) => setForm({ ...form, education_text: e.target.value })}
                className="w-full min-h-[90px] rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-primary"
                placeholder="Через запятую"
              />
            </Field>

            <Field label="Сертификаты">
              <textarea
                value={form.certificates_text || ''}
                onChange={(e) => setForm({ ...form, certificates_text: e.target.value })}
                className="w-full min-h-[90px] rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-primary"
                placeholder="Через запятую"
              />
            </Field>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            onClick={handleSave}
            className="inline-flex items-center justify-center rounded-xl bg-primary px-5 py-3 text-white font-medium hover:bg-primary/90"
          >
            Сохранить
          </button>
          <button
            onClick={handleDelete}
            className="inline-flex items-center justify-center rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-red-600 font-medium hover:bg-red-100"
          >
            Удалить
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-sm text-gray-600 mb-2">{label}</div>
      {children}
    </label>
  )
}
//////////////////////////////////////////
// 👇 СОЗДАНИЕ ВРАЧА
//////////////////////////////////////////

function CreateDoctorModal({ open, onClose, onCreated }: any) {
  const authenticatedFetch = useAuthenticatedFetch();

  const [form, setForm] = useState<any>({
    first_name: '',
    middle_name: '',
    last_name: '',
    phone: '',
    email: '',
    description: '',
    avatar_url: '',
    roles: 'Терапевт',
    price: 0,
    education: '',
    certificates: '',
  });

  if (!open) return null;

  const parseList = (value: string) =>
    value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

  const create = async () => {
    try {
      const payload = {
        first_name: form.first_name?.trim() || '',
        middle_name: form.middle_name?.trim() || '',
        last_name: form.last_name?.trim() || '',
        phone: form.phone?.trim() || '',
        email: form.email?.trim() || '',
        description: form.description?.trim() || '',
        avatar_url: form.avatar_url?.trim() || '',
        roles: parseList(form.roles || ''),
        price: Number(form.price || 0),
        education: parseList(form.education || ''),
        certificates: parseList(form.certificates || ''),
      };

      const res = await authenticatedFetch('/api/doctors/reception', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const text = await res.text();

      if (!res.ok) {
        throw new Error(text || 'Не удалось создать врача');
      }

      alert('Врач создан. Пароль: Clintech1234');
      onCreated?.();
      onClose();
      setForm({
        first_name: '',
        middle_name: '',
        last_name: '',
        phone: '',
        email: '',
        description: '',
        avatar_url: '',
        roles: 'Терапевт',
        price: 0,
        education: '',
        certificates: '',
      });
    } catch (e: any) {
      alert(e.message || 'Ошибка создания врача');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-4">
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-white to-gray-50">
          <h2 className="text-xl font-bold text-gray-900">Добавить врача</h2>
          <p className="text-sm text-gray-500 mt-1">
            Заполните данные нового врача
          </p>
        </div>

        <div className="p-6 max-h-[80vh] overflow-y-auto space-y-6">
          <div>
            <div className="text-sm font-semibold text-gray-900 mb-3">Основная информация</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Имя">
                <input
                  placeholder="Имя"
                  value={form.first_name}
                  onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-primary"
                />
              </Field>

              <Field label="Фамилия">
                <input
                  placeholder="Фамилия"
                  value={form.last_name}
                  onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-primary"
                />
              </Field>

              <Field label="Отчество">
                <input
                  placeholder="Отчество"
                  value={form.middle_name}
                  onChange={(e) => setForm({ ...form, middle_name: e.target.value })}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-primary"
                />
              </Field>

              <Field label="Телефон">
                <input
                  placeholder="Начните с +7… *"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-primary"
                />
              </Field>

              <Field label="Email">
                <input
                  placeholder="Email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-primary"
                />
              </Field>

              <Field label="Цена приема">
                <input
                  type="number"
                  placeholder="Цена"
                  onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-primary"
                />
              </Field>
            </div>
          </div>

          <div>
            <div className="text-sm font-semibold text-gray-900 mb-3">Профессиональная информация</div>
            <div className="space-y-4">
              <Field label="Специализации">
                <input
                  placeholder="Через запятую"
                  value={form.roles}
                  onChange={(e) => setForm({ ...form, roles: e.target.value })}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-primary"
                />
              </Field>

              <Field label="Описание">
                <textarea
                  placeholder="Описание"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full min-h-[110px] rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-primary"
                />
              </Field>

              <Field label="Образование">
                <textarea
                  placeholder="Через запятую"
                  value={form.education}
                  onChange={(e) => setForm({ ...form, education: e.target.value })}
                  className="w-full min-h-[90px] rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-primary"
                />
              </Field>

              <Field label="Сертификаты">
                <textarea
                  placeholder="Через запятую"
                  value={form.certificates}
                  onChange={(e) => setForm({ ...form, certificates: e.target.value })}
                  className="w-full min-h-[90px] rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-primary"
                />
              </Field>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 bg-white flex flex-col sm:flex-row justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-gray-200 px-5 py-3 text-gray-700 hover:bg-gray-50"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={create}
            className="rounded-xl bg-primary px-5 py-3 text-white font-medium hover:bg-primary/90"
          >
            Создать
          </button>
        </div>
      </div>
    </div>
  );
}