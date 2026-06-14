'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import { FaCalendar, FaClock, FaUser, FaHospital, FaVideo, FaArrowRight } from 'react-icons/fa';
import { UserIcon } from 'lucide-react';

import { TAppointment } from '@/types/appointments';
import { TPatient } from '@/types/patient';
import { getAppointmentTypeText, formatAppointmentTime, getAppointmentStatusInfo } from '@/utils/appointments';

import MyButton from '@/components/ui/MyButton';
import RescheduleModal from './RescheduleModal';

// Проверь путь к хуку: если у тебя другой — поправь импорт
import { useDoctors } from '@/hooks/doctor/useDoctors';

interface IAppointmentHeaderProps {
  appointment: TAppointment;
  patient: TPatient | null;
  actualStatus: string;
  onAppointmentUpdated?: () => void;
}

export default function AppointmentHeader({
  appointment,
  patient,
  actualStatus,
  onAppointmentUpdated,
}: IAppointmentHeaderProps) {
  const statusInfo = getAppointmentStatusInfo(appointment);
  const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState(false);

  // Получаем список врачей, чтобы найти users.id по doctors.id
  const { doctors } = useDoctors();

  // Пытаемся взять doctor_user_id из appointment (приходит с бэкенда), иначе ищем по справочнику врачей
  const doctorUserId = useMemo(() => {
    // Сначала проверяем, есть ли doctor_user_id в ответе от бэкенда
    const inline = appointment?.doctor_user_id as string | undefined;
    if (inline) {
      console.log('AppointmentHeader: doctor_user_id найден в appointment:', inline);
      return inline;
    }
    
    // Если нет, пытаемся найти в справочнике врачей
    const doc = doctors.find((d) => d.id === appointment.doctor_id);
    if (doc?.user_id) {
      console.log('AppointmentHeader: doctor_user_id найден в справочнике врачей:', doc.user_id);
      return doc.user_id;
    }
    
    // Если ничего не найдено, возвращаем пустую строку (кнопка будет disabled)
    console.warn('AppointmentHeader: doctor_user_id не найден!', {
      appointmentDoctorId: appointment.doctor_id,
      doctorsCount: doctors.length,
      doctors: doctors.map(d => ({ id: d.id, user_id: d.user_id }))
    });
    return '';
  }, [appointment, doctors]);

  // Используем actualStatus из statusInfo, если переданный actualStatus пустой или неверный
  const effectiveActualStatus = actualStatus || statusInfo.actualStatus || appointment.status;
  const canReschedule = effectiveActualStatus === 'booked' && statusInfo.isUpcoming && Boolean(doctorUserId);

  // Отладочная информация
  console.log('AppointmentHeader Debug:', {
    actualStatusFromProps: actualStatus,
    effectiveActualStatus,
    statusFromInfo: statusInfo.actualStatus,
    appointmentStatus: appointment.status,
    isUpcoming: statusInfo.isUpcoming,
    isFuture: statusInfo.isFuture,
    isInProgress: statusInfo.isInProgress,
    isPassed: statusInfo.isPassed,
    doctorUserId,
    canReschedule,
    appointmentStartTime: appointment.start_time,
    appointmentEndTime: appointment.end_time,
    now: new Date().toISOString(),
    doctor_user_id_from_appointment: appointment?.doctor_user_id,
  });

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        {/* Левая секция - информация о пациенте и приёме */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 flex-1 min-w-0">
          {/* Аватар пациента */}
          <div className="flex gap-2 flex-shrink-0">
            {patient?.avatar_url ? (
              <Image
                src={patient.avatar_url}
                alt={`${patient.first_name} ${patient.last_name}`}
                width={64}
                height={64}
                className="rounded-full object-cover"
              />
            ) : (
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-primary rounded-full flex items-center justify-center">
                <UserIcon className="w-10 h-10 sm:w-16 sm:h-16 text-white" />
              </div>
            )}
            <div className="flex flex-col sm:hidden gap-2">
              <span className={`px-3 py-1 rounded-full text-sm font-medium w-fit ${statusInfo.statusColor}`}>
                {statusInfo.statusText}
              </span>
              <span className="text-xs text-gray-500">{statusInfo.timeUntil}</span>
            </div>
          </div>

          {/* Информация о пациенте и приёме */}
          <div>
            {/* Имя пациента */}
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 mb-2 break-words">
              {patient
                ? `${patient.last_name} ${patient.first_name} ${patient.middle_name || ''}`
                : 'Пациент не указан'}
            </h1>

            {/* Детали приёма */}
            <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 sm:gap-x-6 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <FaCalendar className="text-gray-400 flex-shrink-0" />
                <span className="break-words">
                  {new Date(appointment.start_time).toLocaleDateString('ru-RU', {
                    day: '2-digit',
                    month: '2-digit',
                    year: '2-digit',
                  })}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <FaClock className="text-gray-400 flex-shrink-0" />
      
              </div>
              <div className="flex items-center gap-2">
                <FaUser className="text-gray-400 flex-shrink-0" />
                <span className="break-words">
                  {appointment.title || getAppointmentTypeText(appointment.appointment_type)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {appointment.appointment_type === 'online' && <FaVideo className="text-gray-400 flex-shrink-0" />}
                {appointment.appointment_type === 'offline' && <FaHospital className="text-gray-400 flex-shrink-0" />}
                <span className="break-words">{getAppointmentTypeText(appointment.appointment_type)}</span>
              </div>
            </div>

            {/* Статус */}
            <div className="hidden sm:flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mt-2">
              <span className={`px-3 py-1 rounded-full text-sm font-medium w-fit ${statusInfo.statusColor}`}>
                {statusInfo.statusText}
              </span>
              <span className="text-xs text-gray-500">{statusInfo.timeUntil}</span>
            </div>
          </div>
        </div>

        {/* Правая секция - кнопки */}
        <div className="flex-shrink-0 flex flex-col gap-2 w-full sm:w-auto">
          {statusInfo.canJoin ? (
            <MyButton className="bg-green-600 hover:bg-green-700 text-white text-sm">Присоединиться к встрече</MyButton>
          ) : (
            <MyButton className="hidden lg:block border border-primary hover:bg-primary/20 text-primary font-semibold px-4 sm:px-6 py-2 sm:py-3 rounded-lg text-sm sm:text-base">
              {appointment.appointment_type === 'online' ? 'Онлайн звонок' : 'Визит в клинике'}
            </MyButton>
          )}

          {/* Перенос записи - показываем кнопку если запись забронирована и еще не прошла */}
          {effectiveActualStatus === 'booked' && statusInfo.isUpcoming && (
            <MyButton
              onClick={() => setIsRescheduleModalOpen(true)}
              className="bg-orange-600 hover:bg-orange-700 text-white text-sm flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={!doctorUserId}
              title={
                !doctorUserId 
                  ? 'Не найден user_id врача — невозможно получить слоты для переноса' 
                  : 'Перенести запись на другое время'
              }
            >
              <FaArrowRight className="w-3 h-3" />
              Перенести запись
            </MyButton>
          )}
          
          {/* Показываем предупреждение, если кнопка должна быть видна, но doctorUserId отсутствует */}
          {effectiveActualStatus === 'booked' && statusInfo.isUpcoming && !doctorUserId && (
            <div className="text-xs text-red-600 mt-1">
              ⚠️ Не удалось получить ID врача для переноса записи
            </div>
          )}
        </div>
      </div>

      {/* Спец-уведомления */}
      {statusInfo.isInProgress && (
        <div className="mt-4 p-3 bg-green-100 border border-green-300 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="text-green-800 font-medium text-sm">Запись идёт сейчас!</span>
          </div>
        </div>
      )}

      {statusInfo.isToday && statusInfo.isUpcoming && (
        <div className="mt-4 p-3 bg-blue-100 border border-blue-300 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="text-blue-800 font-medium text-sm">Запись сегодня {statusInfo.timeUntilShort}</span>
          </div>
        </div>
      )}

      {/* Модалка переноса */}
      <RescheduleModal
        isOpen={isRescheduleModalOpen}
        onClose={() => setIsRescheduleModalOpen(false)}
        onSuccess={() => {
          setIsRescheduleModalOpen(false);
          onAppointmentUpdated?.();
        }}
        appointmentId={appointment.id}
        doctorUserId={doctorUserId}
        currentStartTime={appointment.start_time}
        currentEndTime={appointment.end_time}
      />
    </div>
  );
}
