'use client'

import PagesLayout from '@/components/layout/general/PagesLayout'
import { useParams, useRouter } from 'next/navigation'
import { useState, useEffect, useMemo } from 'react'
import { useAppointmentById } from '@/hooks/appointment/useAppointmentById'
import { useAuth } from '@/context/AuthContext'
import { useFiles } from '@/hooks/files/useFiles'
import { TFile } from '@/types/files'
import { useQuestionnaires } from '@/hooks/files/useQuestionnaires'
import { useDoctor } from '@/hooks/doctor/useDoctor'
import { getActualSlotStatus } from '@/utils/appointments'
import PatientFullInfo from '@/components/doctor/appointments/appointmentsId/PatientFullInfo'
import DoctorFullInfo from '@/components/doctor/appointments/appointmentsId/DoctorFullInfo'
import { TAnalysis } from '@/types/questionnaire'
import ChatIdFiles from '@/components/chat/chatId/ChatIdFiles'
import PageStateWrapper from '@/components/ui/PageStateWrapper'
import AppointmentFiles from '@/components/doctor/appointments/appointmentsId/AppointmentFiles'
import AppointmentHeader from '@/components/doctor/appointments/appointmentsId/AppointmentHeader'
import AppointmentData from '@/components/doctor/appointments/appointmentsId/AppointmentData'
import AppointmentAnketa from '@/components/doctor/appointments/appointmentsId/AppointmentAnketa'
import AppointmentToggle from '@/components/doctor/appointments/appointmentsId/AppointmentToggle'
import DropdownTabs from '@/components/ui/DropdownTabs'
import { DAppointmentsTabs } from '@/arrays/appointments/DAppointmentsTabs'
import { TAppointment } from '@/types/appointments'
import { TPatient } from '@/types/patient'
import { usePatientById } from '@/hooks/patient/usePatientById'
import { useCancelAppointmentByDoctor } from '@/hooks/appointment/useCancelAppointmentByDoctor'
import { useDeleteAppointmentByDoctor } from '@/hooks/appointment/useDeleteAppointmentByDoctor'
export default function AppointmentPage() {
  const params = useParams()
  const router = useRouter()
  const appointmentId = Array.isArray(params.appointmentId) ? params.appointmentId[0] : params.appointmentId

  const { session } = useAuth()
  const { appointment, loading, error, refetch } = useAppointmentById(appointmentId as string)

  const [activeTab, setActiveTab] = useState<string>('patientData')
  const [isStarted, setIsStarted] = useState<boolean>(true)
  const [dialogue, setDialogue] = useState('')
  const [selectedAnketaId, setSelectedAnketaId] = useState<string | null>(null)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const { patient, loading: patientLoading, error: patientError } =
    usePatientById(appointment?.patient_id || null, true)

  const { doctor, loading: doctorLoading } = useDoctor(appointment?.doctor_id)
  const { cancelAppointment, loading: cancelLoading } = useCancelAppointmentByDoctor()
  const {
    deleteAppointment,
    loading: deleteLoading,
    error: deleteError,
  } = useDeleteAppointmentByDoctor()

  const { questionnaires: anketa, loading: anketaLoading, error: anketaError } =
    useQuestionnaires(patient?.user_id)

  useEffect(() => {
    if (appointment?.anketa_id && !selectedAnketaId) {
      setSelectedAnketaId(appointment.anketa_id)
    }
  }, [appointment?.anketa_id, selectedAnketaId])

  const selectedAnketa = useMemo(() => {
    if (!selectedAnketaId || !anketa) return null
    return anketa.find((a) => a.id === selectedAnketaId) ?? null
  }, [anketa, selectedAnketaId])

  const fileIds = useMemo(() => {
    if (!selectedAnketa) return []
    const ids = new Set<string>()

    if (Array.isArray(selectedAnketa.files)) {
      selectedAnketa.files.forEach((id: string) => id && ids.add(id))
    }
    if (selectedAnketa.health_passport_pdf) {
      ids.add(selectedAnketa.health_passport_pdf)
    }
    if (selectedAnketa.health_survey_pdf) {
      ids.add(selectedAnketa.health_survey_pdf)
    }

    return Array.from(ids)
  }, [selectedAnketa])

  const { files: documentFiles } = useFiles(fileIds)

  const { attachedFiles, healthSurveyFile, healthPassportFile } = useMemo(() => {
    if (!selectedAnketa || !documentFiles) {
      return { attachedFiles: [], healthSurveyFile: null, healthPassportFile: null }
    }

    const surveyId = selectedAnketa.health_survey_pdf
    const passportId = selectedAnketa.health_passport_pdf
    const attachedIds = new Set(selectedAnketa.files || [])

    const attached: TFile[] = []
    let survey: TFile | null = null
    let passport: TFile | null = null

    for (const file of documentFiles) {
      if (file.id === surveyId) survey = file
      else if (file.id === passportId) passport = file
      else if (attachedIds.has(file.id)) attached.push(file)
    }

    return { attachedFiles: attached, healthSurveyFile: survey, healthPassportFile: passport }
  }, [selectedAnketa, documentFiles])

  const actualStatus =
    appointment && appointment.start_time
      ? (getActualSlotStatus(appointment) || appointment.status)
      : appointment?.status || ''

  const startStopAppointment = () => {
    setIsStarted(!isStarted)
  }

  const isMainLoading = loading || patientLoading || cancelLoading || deleteLoading
  const isReallyEmpty = !loading && !patientLoading && (!appointment || !patient)

  const viewerUserId = String(session?.user_id ?? '').trim()
  const appointmentDoctorUserId = String((doctor as any)?.user_id ?? '').trim()

  const isOwnerDoctor =
    !!viewerUserId &&
    !!appointmentDoctorUserId &&
    viewerUserId === appointmentDoctorUserId

  const doctorName = useMemo(() => {
    const d: any = doctor
    if (!d) return '—'

    const fio =
      [d.last_name, d.first_name, d.middle_name].filter(Boolean).join(' ') ||
      d.full_name ||
      d.name ||
      d.title ||
      ''

    return fio || '—'
  }, [doctor])

  const doctorContacts = useMemo(() => {
    const d: any = doctor
    if (!d) return { phone: '', email: '' }
    return {
      phone: d.phone || d.contact_phone || '',
      email: d.email || d.contact_email || '',
    }
  }, [doctor])

  const nowMs = Date.now()
  const appointmentEndMs = appointment?.end_time ? new Date(appointment.end_time).getTime() : 0
  const isPastAppointment = !!appointmentEndMs && appointmentEndMs < nowMs

  const canCancel = !isPastAppointment && actualStatus !== 'cancelled'
  const canDelete = isPastAppointment

  const onCancel = async () => {
    if (!appointment?.id) return
    if (!confirm('Отменить приём?')) return

    const ok = await cancelAppointment(String(appointment.id))
    if (ok) {
      await refetch()
      router.push('/doctor/schedule-management')
    }
  }

  const onDelete = async () => {
    if (!appointment?.id) return
    if (!confirm('Удалить приём? Это действие необратимо.')) return

    const ok = await deleteAppointment(String(appointment.id))
    if (ok) {
      router.push('/doctor/schedule-management')
    }
  }

  return (
    <PageStateWrapper
      loading={isMainLoading}
      error={error || patientError || deleteError}
      isEmpty={isReallyEmpty}
      emptyTitle="Приём не найден"
      emptyDescription="Проверьте, что вы перешли по правильной ссылке"
      retryText="Попробовать снова"
      buttonHref={`/doctor/appointments`}
      button="Вернуться к списку"
      loadingText="Загрузка информации о приёме"
    >
      <PagesLayout title="Информация о приёме" description="Актуальная информация о приёме">
        <div className="container mx-auto px-4 space-y-4">
          <AppointmentHeader
            appointment={appointment as TAppointment}
            patient={patient as TPatient}
            actualStatus={actualStatus || ''}
            onAppointmentUpdated={() => {
              window.location.reload()
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

              {activeTab === 'patientData' && patient && (
                <PatientFullInfo patient={patient} />
              )}

              {activeTab === 'doctorData' && (
                <DoctorFullInfo doctor={doctor} loading={doctorLoading} />
              )}

              {activeTab === 'appointmentData' && appointment && (
                <AppointmentData
                  isDoctor={true}
                  appointment={appointment}
                  actualStatus={actualStatus || ''}
                />
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

              {activeTab === 'documents' && (
                <ChatIdFiles analysis={selectedAnketa as TAnalysis} />
              )}

              {activeTab === 'appointmentFiles' && appointment && (
                <AppointmentFiles
                  id={appointmentId as string}
                  status={actualStatus || ''}
                  healthPassportId={appointment.health_passport_id}
                />
              )}
            </div>

            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 sticky top-4">
                {isOwnerDoctor ? (
                  <div className="space-y-4">
                    <AppointmentToggle
                      isStarted={isStarted}
                      startStopAppointment={startStopAppointment}
                      appointmentId={appointmentId as string}
                      dialogue={dialogue}
                      setDialogue={setDialogue}
                      analysisId={selectedAnketa?.id || null}
                      analysisData={selectedAnketa}
                      onAppointmentUpdated={refetch}
                      appointmentStatus={appointment?.status}
                      healthPassportId={appointment?.health_passport_id}
                    />

                    <div className="border-t pt-3 space-y-3">
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
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <div className="text-xs text-gray-500">Врач</div>
                      <div className="text-sm font-semibold text-gray-900">{doctorName}</div>
                    
                      {doctorContacts.email && (
                        <div className="text-sm text-gray-600">{doctorContacts.email}</div>
                      )}
                    </div>

                    <div className="border-t pt-3">
                      <div className="text-xs text-gray-500">Статус</div>
                      <div className="text-sm font-medium text-gray-900">{actualStatus || '—'}</div>
                    </div>

                    <div className="border-t pt-3">
                      <button
                        type="button"
                        onClick={() => router.push('/doctor/schedule-management')}
                        className="w-full px-3 py-2 rounded-lg text-sm font-medium border border-gray-200 hover:bg-gray-50"
                      >
                        Назад к расписанию
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </PagesLayout>
    </PageStateWrapper>
  )
}