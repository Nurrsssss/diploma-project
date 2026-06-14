'use client'
import { TAppointment } from '@/types/appointments'
import { getStatusText, getAppointmentTypeText, formatAppointmentTime } from '@/utils/appointments'
import { FaCalendar, FaClock, FaBuilding, FaUser, FaStickyNote } from 'react-icons/fa'

interface IAppointmentDataProps {
    isDoctor: boolean
    appointment: TAppointment
    actualStatus: string
}

export default function AppointmentData({ isDoctor, appointment, actualStatus }: IAppointmentDataProps) {
    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
            {/* Заголовок */}
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 sm:mb-6">Информация о записи</h2>

            {/* Основная информация */}
            <div className="space-y-3 sm:space-y-4">
                {/* Дата и время */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 py-3 border-b border-gray-100">
                    <div className="flex items-center gap-3 min-w-0">
                        <FaCalendar className="text-gray-400 text-sm flex-shrink-0" />
                        <span className="text-gray-600 text-sm flex-shrink-0">Дата</span>
                    </div>
                    <span className="font-semibold text-gray-900 break-words pl-6 sm:pl-0">
                        {new Date(appointment.start_time).toLocaleDateString('ru-RU', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric'
                        })}
                    </span>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 py-3 border-b border-gray-100">
                    <div className="flex items-center gap-3 min-w-0">
                        <FaClock className="text-gray-400 text-sm flex-shrink-0" />
                        <span className="text-gray-600 text-sm flex-shrink-0">Время</span>
                    </div>
                    <span className="font-semibold text-gray-900 break-words pl-6 sm:pl-0">
                        {formatAppointmentTime(appointment.start_time)} - {formatAppointmentTime(appointment.end_time)}
                    </span>
                </div>

                {/* Тип приема */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 py-3 border-b border-gray-100">
                    <div className="flex items-center gap-3 min-w-0">
                        <FaBuilding className="text-gray-400 text-sm flex-shrink-0" />
                        <span className="text-gray-600 text-sm flex-shrink-0">Тип приема</span>
                    </div>
                    <span className="font-semibold text-gray-900 break-words pl-6 sm:pl-0">
                        {getAppointmentTypeText(appointment.appointment_type)}
                    </span>
                </div>

                {/* Статус записи */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 py-3 border-b border-gray-100">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-3 h-3 bg-gray-400 rounded-full flex-shrink-0"></div>
                        <span className="text-gray-600 text-sm flex-shrink-0">Статус записи</span>
                    </div>
                    <span className="font-semibold text-gray-900 break-words pl-6 sm:pl-0">
                        {getStatusText(actualStatus)}
                    </span>
                </div>

                {/* Тема приема */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 py-3 border-b border-gray-100">
                    <div className="flex items-center gap-3 min-w-0">
                        <FaUser className="text-gray-400 text-sm flex-shrink-0" />
                        <span className="text-gray-600 text-sm flex-shrink-0">Тема приема</span>
                    </div>
                    <span className="font-semibold text-gray-900 break-words pl-6 sm:pl-0">
                        {appointment.title || 'Прием врача'}
                    </span>
                </div>

                {/* Заметки пациента */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 py-3 border-b border-gray-100">
                    <div className="flex items-center gap-3 min-w-0">
                        <FaStickyNote className="text-gray-400 text-sm flex-shrink-0" />
                        <span className="text-gray-600 text-sm flex-shrink-0">Заметки пациента</span>
                    </div>
                    <span className="font-semibold text-gray-900 break-words pl-6 sm:pl-0">
                        {appointment.patient_notes || 'Пациент не оставил заметок'}
                    </span>
                </div>

                {/* Заметки врача */}
                {/* {isDoctor && appointment.doctor_notes && (
                    <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3 py-3 border-b border-gray-100">
                        <div className="flex items-center gap-3 min-w-0">
                            <FaStickyNote className="text-gray-400 text-sm flex-shrink-0" />
                            <span className="text-gray-600 text-sm flex-shrink-0">Заметки врача</span>
                        </div>
                        <span className="font-semibold text-gray-900 break-words pl-6 sm:pl-0">
                            {appointment.doctor_notes || 'Не указано'}
                        </span>
                    </div>
                )} */}

                {/* ID записи */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-3 h-3 bg-gray-400 rounded-full flex-shrink-0"></div>
                        <span className="text-gray-600 text-sm flex-shrink-0">ID записи</span>
                    </div>
                    <span className="font-semibold text-gray-900 text-sm break-words pl-6 sm:pl-0">
                        #{appointment.id}
                    </span>
                </div>
            </div>
        </div>
    )
}
