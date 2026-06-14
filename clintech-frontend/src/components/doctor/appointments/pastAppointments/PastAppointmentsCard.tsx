'use client'
import { TAppointment } from '@/types/appointments'
import { getActualSlotStatus, getStatusColor, getStatusText, getAppointmentTypeText, formatAppointmentTime } from '@/utils/appointments'
import { FaClock, FaVideo, FaHospital, FaUser, FaPhone, FaCalendar } from 'react-icons/fa'
import Link from 'next/link'
import MyButton from '@/components/ui/MyButton'

export function PastAppointmentCard({ appointment }: { appointment: TAppointment }) {
    const actualStatus = getActualSlotStatus(appointment)
    const statusColor = getStatusColor(actualStatus || appointment.status)
    const statusText = getStatusText(actualStatus || appointment.status)

    const getTimeUntilAppointment = (startTime: string) => {
        const now = new Date()
        const [appointmentDate, appointmentTimeStr] = startTime.split('T')
        const appointmentTimeOnly = appointmentTimeStr.substring(0, 5)

        const appointmentTime = new Date()
        const [hours, minutes] = appointmentTimeOnly.split(':').map(Number)
        appointmentTime.setFullYear(
            parseInt(appointmentDate.split('-')[0]),
            parseInt(appointmentDate.split('-')[1]) - 1,
            parseInt(appointmentDate.split('-')[2])
        )
        appointmentTime.setHours(hours, minutes, 0, 0)

        const diffMs = appointmentTime.getTime() - now.getTime()
        const absDiffMs = Math.abs(diffMs)
        const totalMinutes = Math.floor(absDiffMs / (1000 * 60))
        const days = Math.floor(totalMinutes / (60 * 24))
        const hoursLeft = Math.floor((totalMinutes % (60 * 24)) / 60)
        const minutesLeft = totalMinutes % 60

        if (absDiffMs < 5 * 60 * 1000) {
            return 'Сейчас идёт!'
        }

        const parts = []
        if (days > 0) parts.push(`${days} д.`)
        if (hoursLeft > 0) parts.push(`${hoursLeft} ч.`)
        if (minutesLeft > 0) parts.push(`${minutesLeft} мин.`)
        const diffString = parts.join(' ')

        if (diffMs < 0) {
            return `Прошло ${diffString}`
        } else {
            return `Через ${diffString}`
        }
    }

    return (
        <div className="bg-white rounded-xl p-4 shadow hover:shadow-md transition-shadow">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                    <div className="flex flex-wrap items-center gap-2">
                        <FaClock className="text-blue-500" />
                        <span className="font-semibold text-base sm:text-lg">
                            {formatAppointmentTime(appointment.start_time)} - {formatAppointmentTime(appointment.end_time)}
                        </span>
                        <span className="flex items-center gap-1 font-semibold text-base sm:text-lg sm:ml-2">
                            <FaCalendar className="text-blue-500" />
                            {appointment.start_time.split('T')[0]}
                        </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm sm:text-base">
                        {appointment.appointment_type === 'online' ? (
                            <FaVideo className="text-blue-500" />
                        ) : (
                            <FaHospital className="text-green-500" />
                        )}
                        <span className="text-gray-600">
                            {getAppointmentTypeText(appointment.appointment_type)}
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-2 sm:gap-3">
                    <span className={`px-2 py-1 sm:px-3 rounded-full text-xs sm:text-sm font-medium ${statusColor}`}>
                        {statusText}
                    </span>
                    {actualStatus === 'completed' && (
                        <span className="text-xs text-gray-500">
                            {getTimeUntilAppointment(appointment.start_time)}
                        </span>
                    )}
                </div>
            </div>

            <div className="mb-4">
                <h3 className="">
                    <span className="font-bold">Тема приема:</span>
                    <span className="text-gray-700 ml-2">{appointment.title}</span>
                </h3>
            </div>

                <div className="flex gap-3">
                    <Link
                        href={`/doctor/appointments/${appointment.id}`}
                        className="bg-blue-500 text-white px-4 sm:px-6 py-2 rounded-lg hover:bg-blue-600 transition-colors w-full sm:w-auto text-center"
                    >
                        Подробнее
                    </Link>
                </div>

        </div>
    )
}