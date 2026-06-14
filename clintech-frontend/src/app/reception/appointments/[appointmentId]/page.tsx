'use client';

import PagesLayout from '@/components/layout/general/PagesLayout';
import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect, useMemo } from 'react';

import { useAppointmentById } from '@/hooks/appointment/useAppointmentById';
import { useAuth } from '@/context/AuthContext';
import { useFiles } from '@/hooks/files/useFiles';
import { useQuestionnaires } from '@/hooks/files/useQuestionnaires';
import { useDoctor } from '@/hooks/doctor/useDoctor';
import { usePatientById } from '@/hooks/patient/usePatientById';
import { useCancelAppointmentByDoctor } from '@/hooks/appointment/useCancelAppointmentByDoctor';
import { useDeleteAppointmentByDoctor } from '@/hooks/appointment/useDeleteAppointmentByDoctor';

import { getActualSlotStatus } from '@/utils/appointments';

import PatientFullInfo from '@/components/doctor/appointments/appointmentsId/PatientFullInfo';
import DoctorFullInfo from '@/components/doctor/appointments/appointmentsId/DoctorFullInfo';
import ChatIdFiles from '@/components/chat/chatId/ChatIdFiles';
import PageStateWrapper from '@/components/ui/PageStateWrapper';
import AppointmentFiles from '@/components/doctor/appointments/appointmentsId/AppointmentFiles';
import AppointmentHeader from '@/components/doctor/appointments/appointmentsId/AppointmentHeader';
import AppointmentData from '@/components/doctor/appointments/appointmentsId/AppointmentData';
import AppointmentAnketa from '@/components/doctor/appointments/appointmentsId/AppointmentAnketa';
import DropdownTabs from '@/components/ui/DropdownTabs';

import { DAppointmentsTabs } from '@/arrays/appointments/DAppointmentsTabs';
import { TAppointment } from '@/types/appointments';
import { TPatient } from '@/types/patient';
import { TAnalysis } from '@/types/questionnaire';

export default function ReceptionAppointmentPage() {
  const params = useParams();
  const router = useRouter();
  const appointmentId = Array.isArray(params.appointmentId) ? params.appointmentId[0] : params.appointmentId;

  const { session } = useAuth();
  const { appointment, loading, error, refetch } = useAppointmentById(appointmentId as string);

  const [activeTab, setActiveTab] = useState<string>('patientData');
  const [selectedAnketaId, setSelectedAnketaId] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const { patient, loading: patientLoading, error: patientError } =
    usePatientById(appointment?.patient_id || null, true);

  const { doctor, loading: doctorLoading } = useDoctor(appointment?.doctor_id);

  const { cancelAppointment, loading: cancelLoading } = useCancelAppointmentByDoctor();
  const {
    deleteAppointment,
    loading: deleteLoading,
    error: deleteError,
  } = useDeleteAppointmentByDoctor();

  const { questionnaires: anketa, loading: anketaLoading, error: anketaError } =
    useQuestionnaires(patient?.user_id);

  useEffect(() => {
    if (appointment?.anketa_id && !selectedAnketaId) setSelectedAnketaId(appointment.anketa_id);
  }, [appointment?.anketa_id, selectedAnketaId]);

  const selectedAnketa = useMemo(() => {
    if (!selectedAnketaId || !anketa) return null;
    return anketa.find((a) => a.id === selectedAnketaId) ?? null;
  }, [anketa, selectedAnketaId]);

  const fileIds = useMemo(() => {
    if (!selectedAnketa) return [];
    const ids = new Set<string>();
    if (Array.isArray(selectedAnketa.files)) selectedAnketa.files.forEach((id: string) => id && ids.add(id));
    if (selectedAnketa.health_passport_pdf) ids.add(selectedAnketa.health_passport_pdf);
    if (selectedAnketa.health_survey_pdf) ids.add(selectedAnketa.health_survey_pdf);
    return Array.from(ids);
  }, [selectedAnketa]);

  useFiles(fileIds);

  const actualStatus =
    appointment && appointment.start_time
      ? (getActualSlotStatus(appointment) || appointment.status)
      : appointment?.status || '';

  const isMainLoading = loading || patientLoading || cancelLoading || deleteLoading;
  const isReallyEmpty = !loading && !patientLoading && (!appointment || !patient);

  const doctorName = useMemo(() => {
    const d: any = doctor;
    if (!d) return '—';

    const fio =
      [d.last_name, d.first_name, d.middle_name].filter(Boolean).join(' ') ||
      d.full_name ||
      d.name ||
      d.title ||
      '';

    return fio || '—';
  }, [doctor]);

  const doctorContacts = useMemo(() => {
    const d: any = doctor;
    if (!d) return { phone: '', email: '' };
    return {
      phone: d.phone || d.contact_phone || '',
      email: d.email || d.contact_email || '',
    };
  }, [doctor]);

  const nowMs = Date.now();
  const appointmentEndMs = appointment?.end_time ? new Date(appointment.end_time).getTime() : 0;
  const isPastAppointment = !!appointmentEndMs && appointmentEndMs < nowMs;

  const canCancel = !isPastAppointment && actualStatus !== 'cancelled';
  const canDelete = isPastAppointment;

  const canReschedule = useMemo(() => {
    return actualStatus === 'booked' || actualStatus === 'scheduled' || actualStatus === 'confirmed';
  }, [actualStatus]);

  const onCancel = async () => {
    if (!appointment?.id) return;
    if (!confirm('Отменить приём?')) return;

    const ok = await cancelAppointment(String(appointment.id));
    if (ok) {
      await refetch();
      router.push('/reception/schedule-management');
    }
  };

  const onDelete = async () => {
    if (!appointment?.id) return;
    if (!confirm('Удалить приём? Это действие необратимо.')) return;

    const ok = await deleteAppointment(String(appointment.id));
    if (ok) {
      router.push('/reception/schedule-management');
    }
  };

  const onReschedule = () => {
    if (!appointment?.id) return;

    router.push(
      `/reception/schedule-management?reschedule_appointment_id=${encodeURIComponent(String(appointment.id))}` +
        `&doctor_id=${encodeURIComponent(String(appointment.doctor_id ?? ''))}` +
        `&patient_id=${encodeURIComponent(String(appointment.patient_id ?? ''))}` +
        `&start_time=${encodeURIComponent(String(appointment.start_time ?? ''))}` +
        `&end_time=${encodeURIComponent(String(appointment.end_time ?? ''))}`
    );
  };

  return (
    <PageStateWrapper
      loading={isMainLoading}
      error={error || patientError || deleteError}
      isEmpty={isReallyEmpty}
      emptyTitle="Приём не найден"
      emptyDescription="Проверьте, что вы перешли по правильной ссылке"
      retryText="Попробовать снова"
      buttonHref="/reception/schedule-management"
      button="Вернуться к расписанию"
      loadingText="Загрузка информации о приёме"
    >
      <PagesLayout title="Информация о приёме" description="Актуальная информация о приёме">
        <div className="container mx-auto px-4 space-y-4">
          <AppointmentHeader
            appointment={appointment as TAppointment}
            patient={patient as TPatient}
            actualStatus={actualStatus || ''}
            onAppointmentUpdated={() => {
              refetch();
            }}
          />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white rounded-xl shadow-sm border border-gray-100">
                <DropdownTabs
                  tabs={DAppointmentsTabs}
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                  isMobileMenuOpen={isMobileMenuOpen}
                  setIsMobileMenuOpen={setIsMobileMenuOpen}
                />
              </div>

              {activeTab === 'patientData' && patient && <PatientFullInfo patient={patient} />}
              {activeTab === 'doctorData' && <DoctorFullInfo doctor={doctor} loading={doctorLoading} />}
              {activeTab === 'appointmentData' && appointment && (
                <AppointmentData isDoctor={false} appointment={appointment} actualStatus={actualStatus || ''} />
              )}
              {activeTab === 'anketa' && (
                <AppointmentAnketa
                  session={session}
                  appointment={appointment}
                  anketa={anketa}
                  anketaLoading={anketaLoading}
                  anketaError={anketaError}
                  selectedAnketaId={selectedAnketaId}
                  setSelectedAnketaId={setSelectedAnketaId}
                />
              )}
              {activeTab === 'documents' && <ChatIdFiles analysis={selectedAnketa as TAnalysis} />}
              {activeTab === 'appointmentFiles' && appointment && (
                <AppointmentFiles
                  id={appointmentId as string}
                  status={actualStatus || ''}
                  healthPassportId={(appointment as any)?.health_passport_id}
                />
              )}
            </div>

            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 sticky top-4 space-y-4">
                <div>
                  <div className="text-xs text-gray-500">Врач</div>
                  <div className="text-sm font-semibold text-gray-900">{doctorName}</div>
                  {doctorContacts.email && <div className="text-sm text-gray-600">{doctorContacts.email}</div>}
                </div>

                <div className="border-t pt-3">
                  <div className="text-xs text-gray-500">Статус</div>
                  <div className="text-sm font-medium text-gray-900">{actualStatus || '—'}</div>
                </div>

                <div className="border-t pt-3 space-y-2">
                  <button
                    type="button"
                    disabled={!canCancel || cancelLoading || deleteLoading}
                    onClick={onCancel}
                    className={[
                      'w-full px-3 py-2 rounded-lg text-sm font-medium border transition-colors',
                      canCancel
                        ? 'border-red-300 text-red-700 hover:bg-red-50'
                        : 'border-gray-200 text-gray-400 cursor-not-allowed',
                    ].join(' ')}
                  >
                    Отменить приём
                  </button>

                  <button
                    type="button"
                    disabled={!canDelete || cancelLoading || deleteLoading}
                    onClick={onDelete}
                    className={[
                      'w-full px-3 py-2 rounded-lg text-sm font-medium border transition-colors',
                      canDelete
                        ? 'border-red-500 bg-red-600 text-white hover:bg-red-700'
                        : 'border-gray-200 text-gray-400 cursor-not-allowed',
                    ].join(' ')}
                  >
                    Удалить приём
                  </button>

                  <button
                    type="button"
                    disabled={!canReschedule || cancelLoading || deleteLoading}
                    onClick={onReschedule}
                    className={[
                      'w-full px-3 py-2 rounded-lg text-sm font-medium border transition-colors',
                      canReschedule
                        ? 'border-blue-300 text-blue-700 hover:bg-blue-50'
                        : 'border-gray-200 text-gray-400 cursor-not-allowed',
                    ].join(' ')}
                  >
                    Перенести приём
                  </button>
                </div>

                <div className="border-t pt-3">
                  <button
                    type="button"
                    onClick={() => router.push('/reception/schedule-management')}
                    className="w-full px-3 py-2 rounded-lg text-sm font-medium border border-gray-200 hover:bg-gray-50"
                  >
                    Назад к расписанию
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </PagesLayout>
    </PageStateWrapper>
  );
}