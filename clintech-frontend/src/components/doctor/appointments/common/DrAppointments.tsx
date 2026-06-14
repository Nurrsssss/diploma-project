'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { FaClock, FaVideo, FaHospital, FaUser, FaPhone, FaTimes, FaArrowRight } from 'react-icons/fa'
import { Calendar } from 'lucide-react'
import Link from 'next/link'

import MyButton from '@/components/ui/MyButton'
import DatePicker from '@/components/ui/DatePicker'
import NoContent from '@/components/ui/NoContent'
import PageStateWrapper from '@/components/ui/PageStateWrapper'

import { useDoctorDaySlots, DoctorDaySlot } from '@/hooks/schedule/useDoctorDaySlots'
import { useAuth } from '@/context/AuthContext'
import { useAppointmentExceptions } from '@/hooks/appointment/useAppointmentExceptions'
import { generateDates } from '@/utils/date'
import { getActualSlotStatus, isSlotPassed, isSlotInProgress, getStatusColor, getStatusText } from '@/utils/appointments'

import DrAppointmentPatient from './DrAppointmentPatient'
import RescheduleModal from '../appointmentsId/RescheduleModal'

const CLINIC_TZ = 'Asia/Almaty'

// YYYY-MM-DD в TZ клиники
function formatDateYMDInTZ(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date)

  const y = parts.find((p) => p.type === 'year')?.value ?? '1970'
  const m = parts.find((p) => p.type === 'month')?.value ?? '01'
  const d = parts.find((p) => p.type === 'day')?.value ?? '01'
  return `${y}-${m}-${d}`
}

// HH:mm в TZ клиники из ISO строки (с Z)
function formatTimeHHmmInTZ(iso: string, timeZone: string): string {
  const dt = new Date(iso)
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(dt)
}

export default function DrAppointments() {
  const { session } = useAuth()

  // Сегодня именно в TZ клиники
  const today = useMemo(() => formatDateYMDInTZ(new Date(), CLINIC_TZ), [])

  const [selectedDate, setSelectedDate] = useState<string>(today)
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // Перенос записи
  const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState(false)
  const [selectedSlotForReschedule, setSelectedSlotForReschedule] = useState<DoctorDaySlot | null>(null)

  const { slots, loading, error, fetchDaySlots } = useDoctorDaySlots()
  const { createException } = useAppointmentExceptions()

  useEffect(() => {
  if (!session?.user_id) return
  fetchDaySlots(session.user_id, selectedDate, statusFilter)
}, [session?.user_id, selectedDate, statusFilter, fetchDaySlots])
  const filteredSlots = useMemo(() => {
    return slots.filter((slot) => {
      if (statusFilter === 'all') return true
      return getActualSlotStatus(slot, selectedDate) === statusFilter
    })
  }, [slots, statusFilter, selectedDate])

  const getSlotStatusColor = (slot: DoctorDaySlot) =>
    getStatusColor(getActualSlotStatus(slot, selectedDate) || slot.status)

  const getSlotStatusText = (slot: DoctorDaySlot) =>
    getStatusText(getActualSlotStatus(slot, selectedDate) || slot.status)

  const availableDates = useMemo(() => generateDates(30), [])

  // Закрыть конкретный слот (исключение custom_hours)
const handleCloseSlot = async (slot: DoctorDaySlot, e: React.MouseEvent) => {
  e.preventDefault()
  e.stopPropagation()

  const startTime = formatTimeHHmmInTZ(slot.start_time, CLINIC_TZ)
  const endTime = formatTimeHHmmInTZ(slot.end_time, CLINIC_TZ)

  if (window.confirm(`Закрыть слот ${startTime} - ${endTime}?`)) {
    try {
      const success = await createException({
        type: 'custom_hours',
        date: selectedDate,
        custom_start_time: startTime,
        custom_end_time: endTime,
        reason: `Закрытие слота ${startTime} - ${endTime}`
      })

      if (success) {
        if (!session?.user_id) return
        await fetchDaySlots(session.user_id, selectedDate, statusFilter)
      } else {
        alert('Не удалось закрыть слот')
      }
    } catch (err) {
      console.error('Ошибка при закрытии слота:', err)
      alert('Ошибка при закрытии слота')
    }
  }
}
  // Открыть модалку переноса
  const handleRescheduleSlot = (slot: DoctorDaySlot, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setSelectedSlotForReschedule(slot)
    setIsRescheduleModalOpen(true)
  }

  const handleRescheduleSuccess = () => {
    setIsRescheduleModalOpen(false)
    setSelectedSlotForReschedule(null)
if (!session?.user_id) return
fetchDaySlots(session.user_id, selectedDate, statusFilter)  }

  return (
    <PageStateWrapper loading={loading} error={error} loadingText="Загрузка записей">
      <div className="bg-white rounded-lg p-3 sm:p-4">
        {/* Выбор даты */}
        <div className="mb-6">
          <div className="flex justify-between items-center gap-2 mb-4">
            <p className="text-xl font-semibold">Выберите дату</p>
            <DatePicker value={selectedDate} onChange={setSelectedDate} placeholder="Выберите дату" minDate={today} />
          </div>

          <div className="flex gap-2 mb-4 overflow-x-auto">
            {availableDates.map((d) => (
              <MyButton
                key={d.date}
                className={`flex flex-col items-center md:py-4 md:px-6 border rounded-lg whitespace-nowrap ${
                  selectedDate === d.date ? 'bg-blue-100 border-blue-500 text-blue-700' : 'hover:bg-gray-50'
                }`}
                onClick={() => setSelectedDate(d.date)}
              >
                <p className="font-semibold text-sm md:text-lg">{d.displayDate}</p>
                <p className="text-xs md:text-md text-gray-500">{d.dayOfWeek}</p>
              </MyButton>
            ))}
          </div>

          <div className="md:hidden flex justify-center mb-4">
            <p className="text-sm text-gray-500 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Скролльте вправо или выберите дату в календаре выше
            </p>
          </div>
        </div>

        {/* Список записей */}
        {!loading && !error && (
          <>
            <div className="text-sm text-gray-600">
              {filteredSlots.length}{' '}
              {filteredSlots.length === 1 ? 'прием' : filteredSlots.length < 5 ? 'приема' : 'приемов'} на{' '}
              {new Date(`${selectedDate}T00:00:00`).toLocaleDateString('ru-RU', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
              })}
            </div>

            {filteredSlots.length > 0 ? (
              <div className="space-y-3 sm:space-y-4">
                {filteredSlots.map((slot: DoctorDaySlot) => {
                  // Время в карточке — строго по Алматы
                  const startTime = formatTimeHHmmInTZ(slot.start_time, CLINIC_TZ)
                  const endTime = formatTimeHHmmInTZ(slot.end_time, CLINIC_TZ)

                  const inProgress = isSlotInProgress(slot, selectedDate)
                  const passed = isSlotPassed(slot, selectedDate)

                  const actualStatus = getActualSlotStatus(slot, selectedDate) || slot.status

                  return (
                    <div
                      key={slot.id}
                      className={`border border-gray-200 rounded-lg p-3 sm:p-4 hover:shadow-lg transition-shadow shadow-md ${
                        inProgress
                          ? 'border-blue-500 bg-blue-50 ring-1 sm:ring-2 ring-blue-200'
                          : passed
                            ? 'opacity-75 bg-gray-50'
                            : ''
                      }`}
                    >
                      <Link
                        href={{
                          pathname: `/doctor/appointments/${slot.id}`,
                          query: {
                            // дата в TZ клиники
                            date: selectedDate,
                            // оригинальные ISO (нужны деталям)
                            start_time: slot.start_time,
                            end_time: slot.end_time,
                            // ✅ добавим doctor_user_id (часто нужно деталям, чтобы не строить неправильный URL)
                            doctor_user_id: session?.user_id ?? ''
                          }
                        }}
                        target="_blank"
                      >
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-2 sm:mb-3">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                            {inProgress && (
                              <span className="w-fit text-[10px] sm:text-xs bg-blue-600 text-white px-2 py-1 rounded-full animate-pulse">
                                сейчас идет
                              </span>
                            )}

                            <div className="flex items-center gap-2 flex-wrap">
                              <FaClock className={`${inProgress ? 'text-blue-600' : 'text-blue-500'}`} size={20} />
                              <span className={`font-semibold text-base sm:text-lg ${inProgress ? 'text-blue-700' : ''}`}>
                                {startTime} - {endTime}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 text-sm sm:text-base flex-wrap">
                              {slot.appointment_type === 'online' ? (
                                <FaVideo className="text-blue-500" size={20} />
                              ) : slot.appointment_type === 'both' ? (
                                <>
                                  <FaVideo className="text-blue-500" size={16} />
                                  <FaHospital className="text-blue-500" size={16} />
                                </>
                              ) : (
                                <FaHospital className="text-blue-500" size={20} />
                              )}
                              <span className="text-base sm:text-lg whitespace-normal break-words">
                                {slot.appointment_type === 'online'
                                  ? 'Онлайн консультация'
                                  : slot.appointment_type === 'both'
                                    ? 'Онлайн и офлайн'
                                    : 'Прием в клинике'}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 sm:gap-3 mt-2 sm:mt-0 flex-wrap">
                            <span
                              className={`px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${getSlotStatusColor(slot)}`}
                            >
                              {getSlotStatusText(slot)}
                            </span>

                            {/* Действия для available/booked и не прошедших */}
                            {(['available', 'booked'].includes(actualStatus) && !passed) && (
                              <>
                                {/* Перенести — только booked */}
                                {actualStatus === 'booked' && (
                                  <button
                                    onClick={(e) => handleRescheduleSlot(slot, e)}
                                    className="p-2 text-orange-500 hover:text-orange-700 hover:bg-orange-50 rounded-full transition-colors"
                                    title="Перенести эту запись"
                                  >
                                    <FaArrowRight className="w-4 h-4" />
                                  </button>
                                )}

                                {/* Закрыть слот */}
                                <button
                                  onClick={(e) => handleCloseSlot(slot, e)}
                                  className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-full transition-colors"
                                  title="Закрыть этот слот"
                                >
                                  <FaTimes className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Информация о пациенте */}
                        {(slot.patient_id || slot.patient_name) && (
                          <>
                            {slot.patient_record_id ? (
  <DrAppointmentPatient patientId={slot.patient_record_id} />
                            ) : slot.patient_name ? (
                              <div className="bg-gray-100 rounded-lg p-3 mb-3">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-base sm:text-lg">
                                  <div className="flex items-center gap-2">
                                    <FaUser className="text-gray-500" />
                                    <span className="font-medium text-xs sm:text-base">{slot.patient_name}</span>
                                  </div>
                                  {slot.patient_phone && (
                                    <div className="flex items-center gap-2">
                                      <FaPhone className="text-gray-500" />
                                      <span>{slot.patient_phone}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : null}
                          </>
                        )}
                      </Link>
                    </div>
                  )
                })}
              </div>
            ) : (
              <NoContent
                title="Нет записей"
                description={`На ${new Date(`${selectedDate}T00:00:00`).toLocaleDateString('ru-RU', {
                  day: 'numeric',
                  month: 'long'
                })} записей нет`}
              />
            )}
          </>
        )}
      </div>

      {/* Модалка переноса */}
      {selectedSlotForReschedule && session?.user_id && (
        <RescheduleModal
          isOpen={isRescheduleModalOpen}
          onClose={() => {
            setIsRescheduleModalOpen(false)
            setSelectedSlotForReschedule(null)
          }}
          onSuccess={handleRescheduleSuccess}
          appointmentId={selectedSlotForReschedule.id}
          doctorUserId={session.user_id} // users.id врача
          currentStartTime={selectedSlotForReschedule.start_time}
          currentEndTime={selectedSlotForReschedule.end_time}
        />
      )}
    </PageStateWrapper>
  )
}