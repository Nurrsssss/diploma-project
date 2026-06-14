'use client'

import { useParams, useSearchParams } from 'next/navigation'
import { useState, useEffect, useMemo } from 'react'
import { useAppointmentById } from '@/hooks/appointment/useAppointmentById'
import { useDoctor } from '@/hooks/doctor/useDoctor'
import { useAuth } from '@/context/AuthContext'
import { useFiles } from '@/hooks/files/useFiles'
import { TFile } from '@/types/files'
import { useQuestionnaires } from '@/hooks/files/useQuestionnaires'
import { getActualSlotStatus, getAppointmentStatusInfo } from '@/utils/appointments'
import { useRouter } from 'next/navigation'
import PagesLayout from '@/components/layout/general/PagesLayout'
import PatientFullInfo from '@/components/doctor/appointments/appointmentsId/PatientFullInfo'
import DoctorFullInfo from '@/components/doctor/appointments/appointmentsId/DoctorFullInfo'
import AppointmentData from '@/components/doctor/appointments/appointmentsId/AppointmentData'
import AppointmentAnketa from '@/components/doctor/appointments/appointmentsId/AppointmentAnketa'
import AppointmentFiles from '@/components/doctor/appointments/appointmentsId/AppointmentFiles'
import DropdownTabs from '@/components/ui/DropdownTabs'
import { PAppointmentsTabs } from '@/arrays/appointments/PAppointmentsTabs'
import { TAppointment } from '@/types/appointments'
import { TPatient } from '@/types/patient'
import MyButton from '@/components/ui/MyButton'
import PageStateWrapper from '@/components/ui/PageStateWrapper'
import AppointmentHeader from '@/components/doctor/appointments/appointmentsId/AppointmentHeader'

export default function PatientAppointmentPage() {
  const { appointmentId } = useParams()
  const searchParams = useSearchParams()
  const { session } = useAuth()
  const router = useRouter()

  const { appointment, loading, error } = useAppointmentById(appointmentId as string)
  const { doctor, loading: doctorLoading } = useDoctor(appointment?.doctor_id)

  const [patient, setPatient] = useState<TPatient | null>(null)
  const [patientLoading, setPatientLoading] = useState(false)
  const [patientError, setPatientError] = useState<string | null>(null)

  // Состояние для записи
  const [isStarted, setIsStarted] = useState(false)
  const [isRecordLoading, setIsRecordLoading] = useState(false)
  const [dialogue, setDialogue] = useState('')

  // Состояние для отмены записи
  const [isCancelling, setIsCancelling] = useState(false)

  // Состояние для табов
  const [activeTab, setActiveTab] = useState('appointment')
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  // Состояние для анкет
  const [selectedAnketaId, setSelectedAnketaId] = useState<string | null>(null)

  // Грузим пациента по user_id текущей сессии, а не по appointment.patient_id
  useEffect(() => {
    if (!session?.user_id) {
      console.log('[PATIENT PAGE] skip patient load: no session.user_id')
      setPatient(null)
      setPatientError(null)
      setPatientLoading(false)
      return
    }

    let cancelled = false

    const loadPatient = async () => {
      try {
        setPatientLoading(true)
        setPatientError(null)

        const url = `/api/users/${session.user_id}/patient`
        console.log('[PATIENT PAGE] loading patient by session.user_id', {
          sessionUserId: session.user_id,
          url,
          appointmentId,
        })

        const res = await fetch(url, { cache: 'no-store' })
        const data = await res.json().catch(() => null)

        console.log('[PATIENT PAGE] patient response', {
          ok: res.ok,
          status: res.status,
          data,
        })

        if (!res.ok) {
          throw new Error(data?.error || data?.message || `Ошибка получения пациента: ${res.status}`)
        }

        const payload = data?.data ?? data

        if (!cancelled) {
          console.log('[PATIENT PAGE] patient payload set', payload)
          setPatient(payload ?? null)
        }
      } catch (e: any) {
        if (!cancelled) {
          console.error('[PATIENT PAGE] patient load error', e)
          setPatient(null)
          setPatientError(e?.message || 'Ошибка загрузки пациента')
        }
      } finally {
        if (!cancelled) {
          setPatientLoading(false)
        }
      }
    }

    loadPatient()

    return () => {
      cancelled = true
    }
  }, [session?.user_id, appointmentId])

  const { questionnaires: anketa, loading: anketaLoading, error: anketaError } =
    useQuestionnaires(patient?.user_id)

  useEffect(() => {
    console.log('[PATIENT PAGE] debug ids', {
      appointmentId,
      sessionUserId: session?.user_id,
      appointment,
      appointmentPatientId: (appointment as any)?.patient_id,
      appointmentPatientRecordId: (appointment as any)?.patient_record_id,
      appointmentPatientObjId: (appointment as any)?.patient?.id,
      patient,
      patientId: (patient as any)?.id,
      patientUserId: (patient as any)?.user_id,
    })
  }, [appointmentId, session?.user_id, appointment, patient])

  // Автоматически выбираем анкету из записи
  useEffect(() => {
    if (appointment?.anketa_id && !selectedAnketaId) {
      setSelectedAnketaId(appointment.anketa_id)
    }
  }, [appointment?.anketa_id, selectedAnketaId])

  // Получаем выбранную анкету из массива
  const selectedAnketa = useMemo(() => {
    if (!selectedAnketaId || !anketa) return null
    return anketa.find((q) => q.id === selectedAnketaId) ?? null
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

  const { files: documentFiles, loading: documentsLoading, error: documentsError } = useFiles(fileIds)

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

  // Получаем актуальный статус записи
  const actualStatus = appointment && appointment.start_time ? getActualSlotStatus(appointment) : null

  const startStopAppointment = () => {
    setIsRecordLoading(true)
    setTimeout(() => {
      setIsStarted(!isStarted)
      setIsRecordLoading(false)
    }, 1000)
  }

  const handleCancelAppointment = async () => {
    if (!appointment) return

    if (!confirm('Вы уверены, что хотите отменить запись?')) {
      return
    }

    setIsCancelling(true)
    try {
      console.log('[PATIENT PAGE] cancel clicked', { appointmentId: appointment.id })
      router.push('/patient/my-appointments')
    } catch (error) {
      console.error('Ошибка при отмене записи:', error)
    } finally {
      setIsCancelling(false)
    }
  }

  // Показываем загрузку пока не загрузились основные данные
  const isMainLoading = loading || patientLoading || isRecordLoading

  // Показываем пустое состояние только если данные загружены, но приема или пациента нет
  const isReallyEmpty = !loading && !patientLoading && (!appointment || !patient)

  return (
    <PageStateWrapper
      loading={isMainLoading}
      error={error || patientError}
      isEmpty={isReallyEmpty}
      emptyTitle="Приём не найден"
      emptyDescription="Проверьте, что вы перешли по правильной ссылке"
      retryText="Попробовать снова"
      loadingText="Загрузка информации о приёме..."
    >
      <PagesLayout title="Информация о приёме" description="Актуальная информация о приёме">
        <div className="container mx-auto px-4 space-y-4">
          <AppointmentHeader
            appointment={appointment as TAppointment}
            patient={patient as TPatient}
            actualStatus={actualStatus || ''}
          />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {!getAppointmentStatusInfo(appointment as TAppointment).isPassed && (
              <div className="lg:col-span-1 lg:order-2 h-fit bg-white rounded-xl md:p-4">
                <div className="space-y-4">
                  {actualStatus && (
                    <div className="bg-white rounded-xl p-4 shadow">
                      <h3 className="text-lg font-bold mb-4">Действия</h3>
                      <div className="space-y-3">
                        {getAppointmentStatusInfo(appointment as TAppointment).canCancel && (
                          <MyButton
                            onClick={handleCancelAppointment}
                            disabled={isCancelling}
                            className="w-full bg-red-500 hover:bg-red-600 text-white disabled:opacity-50"
                          >
                            {isCancelling ? 'Отмена...' : 'Отменить запись'}
                          </MyButton>
                        )}
                        {appointment?.appointment_type === 'online' && actualStatus === 'booked' && (
                          <MyButton className="w-full bg-green-500 hover:bg-green-600 text-white">
                            Присоединиться к встрече
                          </MyButton>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div
              className={`${
                getAppointmentStatusInfo(appointment as TAppointment).isPassed ? 'lg:col-span-3' : 'lg:col-span-2'
              } h-fit bg-white rounded-xl md:p-4 mb-`}
            >
              <DropdownTabs
                tabs={PAppointmentsTabs}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                isMobileMenuOpen={isMobileMenuOpen}
                setIsMobileMenuOpen={setIsMobileMenuOpen}
              />

              {activeTab === 'patient' && patient && <PatientFullInfo patient={patient} />}

              {activeTab === 'doctor' && (
                <DoctorFullInfo doctor={doctor} loading={doctorLoading} />
              )}

              {activeTab === 'appointment' && appointment && (
                <AppointmentData
                  isDoctor={false}
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

              {activeTab === 'files' && appointment && (
                <AppointmentFiles
                  id={appointment.id}
                  status={actualStatus || ''}
                  healthPassportId={appointment.health_passport_id}
                />
              )}
            </div>
          </div>
        </div>
      </PagesLayout>
    </PageStateWrapper>
  )
}