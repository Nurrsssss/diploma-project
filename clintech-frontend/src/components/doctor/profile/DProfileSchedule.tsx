'use client'
import React, { useEffect } from 'react'
import { Clock, RefreshCw } from 'lucide-react'
import NoContent from '@/components/ui/NoContent'
import MyButton from '@/components/ui/MyButton'
import { TDoctor } from '@/types/doctors'
import { useDoctorSchedules } from '@/hooks/schedule/useDoctorSchedules'
import Loader from '@/components/ui/Loader'
import { FaCheckCircle } from 'react-icons/fa'

const dayNumberToShortName = (dayNumber: number) => {
    const days = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
    return days[dayNumber] || '';
};

export const DProfileSchedule = ({ doctor }: { doctor: TDoctor }) => {
    const { schedules, loading, error, fetchSchedules, clearError } = useDoctorSchedules();

    useEffect(() => {
        if (doctor?.user_id) {
            fetchSchedules(doctor.user_id);
        }
    }, [doctor?.user_id, fetchSchedules]);

    const activeSchedules = schedules.filter(s => s.is_active);

    const handleRetry = () => {
        clearError();
        if (doctor?.user_id) {
            fetchSchedules(doctor.user_id);
        }
    };

    // Определяем тип ошибки для более точного сообщения
    const getErrorDetails = () => {
        if (!error) return null;

        if (error.includes('403')) {
            return {
                title: "Нет доступа к расписаниям",
                description: "Возможно проблема с правами доступа. Попробуйте обновить страницу или войти заново.",
                showRetry: true
            };
        }

        if (error.includes('401')) {
            return {
                title: "Ошибка авторизации",
                description: "Необходимо войти в систему заново",
                showRetry: false
            };
        }

        return {
            title: "Ошибка загрузки",
            description: error,
            showRetry: true
        };
    };

    const errorDetails = getErrorDetails();

    return (
        <div className="w-full h-fit bg-white rounded-xl p-4">
            <div className="flex items-center mb-4">
                <Clock className="w-6 h-6" />
                <h2 className="font-semibold text-[16px] ml-2">График работы</h2>
            </div>

            {loading ? (
                <Loader />
            ) : error && errorDetails ? (
                <div className="text-center space-y-4">
                    <NoContent
                        title={errorDetails.title}
                        description={errorDetails.description}
                    />
                    {errorDetails.showRetry && (
                        <MyButton
                            onClick={handleRetry}
                            className="mx-auto flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Попробовать снова
                        </MyButton>
                    )}
                </div>
            ) : activeSchedules.length > 0 ? (
                <div className="space-y-4">
                    {activeSchedules.map(schedule => (
                        <div key={schedule.id} className="p-3 bg-gray-50 rounded-lg border">
                            <div className="flex justify-between items-center mb-2">
                                <h3 className="font-semibold text-gray-800 border-b border-gray-200 pb-2">{schedule.name}</h3>
                                {schedule.is_active && (
                                    <FaCheckCircle className="text-green-500" title="Активно" />
                                )}
                            </div>
                            <div className="space-y-1 text-sm">
                                {schedule.work_days?.sort((a, b) => a - b).map(day => (
                                    <div key={day} className="flex justify-between items-baseline">
                                        <span className="font-medium text-gray-800 text-md">{dayNumberToShortName(day)}:</span>
                                        <span className="text-gray-600 text-md">{schedule.start_time?.slice(0, 5)} - {schedule.end_time?.slice(0, 5)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <NoContent title="Нет активных расписаний" description='У врача пока нет добавленных и активных расписаний.' />
            )}
        </div>
    )
} 