'use client'
import { TAppointment } from '@/types/appointments'
import { getActualSlotStatus, getStatusColor, getStatusText, getAppointmentTypeText, formatAppointmentTime } from '@/utils/appointments'
import { FaClock, FaVideo, FaHospital, } from 'react-icons/fa'
import Link from 'next/link'
import MyButton from '@/components/ui/MyButton'
import { useState } from 'react'
import { useAppointments } from '@/hooks/appointment/useAppointments'
import { getAppointmentStatusInfo } from '@/utils/appointments'
import DoctorInfo from '@/components/common/DoctorInfo'

interface AppointmentCardProps {
    appointment: TAppointment
    onCancel?: () => void
}

export default function AppointmentCard({ appointment, onCancel }: AppointmentCardProps) {
    const [isCancelling, setIsCancelling] = useState(false)
    const { cancelAppointment } = useAppointments()

    const handleCancelAppointment = async () => {
        if (!confirm('Вы уверены, что хотите отменить запись?')) {
            return
        }

        setIsCancelling(true)
        try {
            const success = await cancelAppointment(appointment.id)
            if (success) {
                onCancel?.()
            }
        } catch (error) {
            console.error('Ошибка при отмене записи:', error)
        } finally {
            setIsCancelling(false)
        }
    }



    const actualStatus = getActualSlotStatus(appointment)

    return (
        <div className="bg-white rounded-xl p-4 shadow hover:shadow-md transition-shadow">
            {/* Мобильная версия */}
            <div className="lg:hidden space-y-3">
                <div className="flex items-center justify-between">
                    <div className="space-y-2">
                        <p className="flex items-center gap-2">
                            <FaClock className="text-gray-500" />
                            <span className="font-semibold">
                                {formatAppointmentTime(appointment.start_time)} - {formatAppointmentTime(appointment.end_time)}
                            </span>
                        </p>
                        <p className="flex items-center gap-2">
                            {appointment.appointment_type === 'online' ? (
                                <FaVideo className="text-gray-500" />
                            ) : (
                                <FaHospital className="text-gray-500" />
                            )}
                            <span className="text-sm text-gray-600">
                                {getAppointmentTypeText(appointment.appointment_type)}
                            </span>
                        </p>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(actualStatus || '')}`}>
                            {getStatusText(actualStatus || '')}
                        </span>
                        <span className="text-xs text-gray-500">
                            {getAppointmentStatusInfo(appointment).timeUntil}
                        </span>
                    </div>
                </div>



                {/* Информация о враче */}
                <DoctorInfo doctorId={appointment.doctor_user_id || appointment.doctor_id} compact={true} showAvatar={false} />

                {/* Онлайн запись - ссылка на встречу */}
                {appointment.appointment_type === 'online' && actualStatus === 'booked' && (
                    <div className="bg-blue-50 p-3 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                            <FaVideo className="text-blue-600" />
                            <span className="text-sm font-medium text-blue-800">Онлайн консультация</span>
                        </div>
                        <Link
                            href={`/patient/chat/${appointment.id}`}
                            className="inline-block bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors"
                        >
                            Присоединиться к встрече
                        </Link>
                    </div>
                )}

                <div className="flex gap-2">
                    <Link
                        href={`/patient/my-appointments/${appointment.id}`}
                        className="flex-1 bg-blue-500 text-white text-center py-2 px-3 rounded-lg hover:bg-blue-600 transition-colors text-sm"
                    >
                        Подробнее
                    </Link>
                    {getAppointmentStatusInfo(appointment).canCancel && (
                        <MyButton
                            onClick={handleCancelAppointment}
                            disabled={isCancelling}
                            className="flex-1 bg-red-500 hover:bg-red-600 text-white disabled:opacity-50 py-2 px-3 text-sm"
                        >
                            {isCancelling ? 'Отмена...' : 'Отменить'}
                        </MyButton>
                    )}
                </div>
            </div>

            {/* Десктопная версия */}
            <div className="hidden lg:block">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <FaClock className="text-blue-500" />
                            <span className="font-semibold text-lg">
                                {formatAppointmentTime(appointment.start_time)} - {formatAppointmentTime(appointment.end_time)}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            {appointment.appointment_type === 'online' ? (
                                <FaVideo className="text-gray-500" />
                            ) : (
                                <FaHospital className="text-gray-500" />
                            )}
                            <span className="text-gray-600">
                                {getAppointmentTypeText(appointment.appointment_type)}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(actualStatus || '')}`}>
                            {getStatusText(actualStatus || '')}
                        </span>
                        <span className="text-sm text-gray-500">
                            {getAppointmentStatusInfo(appointment).timeUntil}
                        </span>
                    </div>
                </div>

                {/* Информация о враче */}
                <div className="mb-4">
                    <DoctorInfo doctorId={appointment.doctor_user_id || appointment.doctor_id} />
                </div>

                {/* Онлайн запись - ссылка на встречу */}
                {appointment.appointment_type === 'online' && actualStatus === 'booked' && (
                    <div className="bg-blue-50 p-4 rounded-lg mb-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <FaVideo className="text-blue-600 text-xl" />
                                <div>
                                    <div className="font-medium text-blue-800">Онлайн консультация</div>
                                    <div className="text-sm text-blue-600">Готовы к встрече</div>
                                </div>
                            </div>
                            <Link
                                href={`/patient/chat/${appointment.id}`}
                                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                Присоединиться к встрече
                            </Link>
                        </div>
                    </div>
                )}

                <div className="flex gap-3">
                    <Link
                        href={`/patient/my-appointments/${appointment.id}`}
                        className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition-colors"
                    >
                        Подробнее
                    </Link>
                    {getAppointmentStatusInfo(appointment).canCancel && (
                        <MyButton
                            onClick={handleCancelAppointment}
                            disabled={isCancelling}
                            className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 disabled:opacity-50"
                        >
                            {isCancelling ? 'Отмена...' : 'Отменить запись'}
                        </MyButton>
                    )}
                </div>
            </div>
        </div>
    )
} 