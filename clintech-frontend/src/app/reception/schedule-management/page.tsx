'use client';

import { useEffect, useState } from 'react';

import { useDoctors } from '@/hooks/doctor/useDoctors';
import { usePatients } from '@/hooks/patient/usePatients';

import PageStateWrapper from '@/components/ui/PageStateWrapper';
import ReceptionSchedule from '@/components/doctor/schedule-management/ReceptionSchedule';
import CompactDoctorPicker from '@/components/doctor/schedule-management/CompactDoctorPicker';

import { useAuth as useAuthContext } from '@/context/AuthContext';

import { RECEPTION_DOCTOR_ID } from '@/constants/reception';

const ALL_DOCTORS_ID = '__ALL_DOCTORS__';

export default function ScheduleManagementPage() {
  const { doctors, loading: loadingDoctors, error: doctorsError, refetch: refetchDoctors } = useDoctors();
  const { patients, loading: loadingPatients, error: patientsError, refetch: refetchPatients } = usePatients();

  const { session, role } = useAuthContext();

  const normalizedRole = String(role ?? '').trim().toLowerCase();
  const isReception = normalizedRole === 'reception';

  const viewerUserId = String(session?.user_id ?? '').trim();

  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(null);

  const loading = loadingDoctors || loadingPatients;
  const error = doctorsError || patientsError;

  const isReceptionDoctorSelected = String(selectedDoctorId ?? '').trim() === String(RECEPTION_DOCTOR_ID);

  // ✅ дефолт: ВСЕМ показываем всех
  useEffect(() => {
    if (!doctors?.length || !session) return;
    if (selectedDoctorId) return;

    setSelectedDoctorId(ALL_DOCTORS_ID);
  }, [doctors, session, selectedDoctorId]);

  return (
    <PageStateWrapper
      loading={loading}
      error={error}
      isEmpty={!doctors.length && !loading}
      emptyTitle="Врачи не найдены"
      emptyDescription="В системе нет доступных врачей"
      onRetry={() => {
        refetchDoctors();
        refetchPatients();
      }}
      loadingText="Загрузка данных"
    >
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Управление расписанием</h1>
            <p className="text-gray-600">Просматривайте график врачей и записывайте пациентов на приём</p>
          </div>

          <div className="space-y-4">
            <CompactDoctorPicker
              doctors={doctors}
              selectedDoctorId={selectedDoctorId}
              onSelectDoctor={(id: string) => setSelectedDoctorId(id)}
              allDoctorsId={ALL_DOCTORS_ID}
            />

            <div>
              {selectedDoctorId ? (
                !isReception && isReceptionDoctorSelected ? (
                  <div className="bg-white rounded-xl shadow-sm p-12 text-center text-red-600 font-bold">
                    Нет доступа к общему графику
                  </div>
                ) : (
                  <ReceptionSchedule
                    doctors={doctors}
                    patients={patients}
                    viewerUserId={viewerUserId}
                    isReception={isReception}
                    // ✅ ДОБАВИЛИ:
                    selectedDoctorId={selectedDoctorId}
                    allDoctorsId={ALL_DOCTORS_ID}
                  />
                )
              ) : (
                <div className="bg-white rounded-xl shadow-sm p-12 text-center text-gray-500">
                  Выберите врача для просмотра расписания
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </PageStateWrapper>
  );
}