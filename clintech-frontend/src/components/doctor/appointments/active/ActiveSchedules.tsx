'use client'
import { useAuth } from '@/context/AuthContext';
import { useEffect, useMemo, useState } from 'react'
import MyInput from '@/components/ui/MyInput';
import MySelect from '@/components/ui/MySelect';
import { FaCalendar, FaClock, FaFilter, FaEye } from 'react-icons/fa';
import NoContent from '@/components/ui/NoContent';
import Loader from '@/components/ui/Loader';
import { useDoctorSchedules } from '@/hooks/schedule/useDoctorSchedules';
import { useGeneratedSlots, GeneratedSlot } from '@/hooks/schedule/useGeneratedSlots';
import { TDoctorSchedule } from '@/types/doctorShedules';
import { getActualSlotStatus, isSlotPassed, isSlotInProgress, getStatusColor, getStatusText, getAppointmentTypeText } from '@/utils/appointments';
import PageStateWrapper from '@/components/ui/PageStateWrapper';

export default function ActiveSchedules() {
    const { session } = useAuth()
    const { schedules, loading, error, fetchSchedules } = useDoctorSchedules()
    const { slots: allSlots, loading: slotsLoading, error: slotsError, fetchGeneratedSlots } = useGeneratedSlots()

    // Фильтры
    const [selectedDate, setSelectedDate] = useState<string>(
        new Date().toLocaleDateString('en-CA') // Сегодняшняя дата в локальном часовом поясе
    )
    const [statusFilter, setStatusFilter] = useState<string>('all')
    const [selectedSchedule, setSelectedSchedule] = useState<TDoctorSchedule | null>(null)

    // Фильтруем слоты с учетом актуального статуса на основе времени
    const slots = allSlots.filter(slot => {
        if (statusFilter === 'all') {
            return true;
        }

        // Используем актуальный статус, который учитывает время
        const actualStatus = getActualSlotStatus(slot, selectedDate);
        return actualStatus === statusFilter;
    });

    useEffect(() => {
        if (session?.user_id) {
            fetchSchedules(session.user_id)
        }
    }, [session?.user_id, fetchSchedules])

    // Фильтрация активных расписаний (со статусом 'active')
const activeSchedules = useMemo(
  () => schedules.filter((schedule) => schedule.is_active === true),
  [schedules]
)
    // ✅ Автоматически выбираем первое активное расписание
    useEffect(() => {
        if (activeSchedules.length > 0 && !selectedSchedule) {
            setSelectedSchedule(activeSchedules[0]);
        }
    }, [activeSchedules, selectedSchedule]);

    // ✅ Загружаем слоты когда есть выбранное расписание
    useEffect(() => {
        if (selectedSchedule) {
            fetchGeneratedSlots(
                selectedSchedule.id, // Передаем scheduleId
                selectedDate,
                statusFilter === 'all' ? undefined : statusFilter // Передаем статус в backend
            )
        }
    }, [selectedSchedule, selectedDate, statusFilter, fetchGeneratedSlots])

    // Обработка выбора расписания
    const handleScheduleSelect = (schedule: TDoctorSchedule) => {
        setSelectedSchedule(schedule)
    }

    const getSlotStatusColor = (slot: GeneratedSlot) => {
        const actualStatus = getActualSlotStatus(slot, selectedDate);
        return getStatusColor(actualStatus || slot.status);
    }

    const getSlotStatusText = (slot: GeneratedSlot) => {
        const actualStatus = getActualSlotStatus(slot, selectedDate);
        return getStatusText(actualStatus || slot.status);
    }



    return (
        <PageStateWrapper
            loading={loading || slotsLoading}
            loadingText='Загрузка расписаний'
            error={error || slotsError}
        >

            <div className="grid lg:grid-cols-4 gap-4">
                {/* Боковая панель с расписаниями и фильтрами */}
                <div className="lg:col-span-1 space-y-4">
                    {/* Список активных расписаний */}
                    <div className="bg-white rounded-lg p-4">
                        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                            <FaCalendar />
                            Активные расписания
                        </h2>

                        {activeSchedules.length > 0 ? (
                            <div className="space-y-2">
                                {activeSchedules.map((schedule) => (
                                    <div
                                        key={schedule.id}
                                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${selectedSchedule?.id === schedule.id
                                            ? 'border-blue-500 bg-blue-50'
                                            : 'border-gray-200 hover:bg-gray-50'
                                            }`}
                                        onClick={() => handleScheduleSelect(schedule)}
                                    >
                                        <div className="font-medium text-xl">{schedule.name}</div>
                                        <div className="text-lg text-gray-500">
                                            {schedule.start_time} - {schedule.end_time}
                                        </div>
                                        <div className="text-lg text-gray-400">
                                            {getAppointmentTypeText(schedule.appointment_format)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <NoContent
                                title="Нет активных расписаний"
                                description="У вас нет активных расписаний для просмотра слотов"
                            />
                        )}
                    </div>

                    {/* Фильтры */}
                    {selectedSchedule && (
                        <div className="bg-white rounded-lg p-4">
                            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                                <FaFilter />
                                Фильтры
                            </h3>

                            {/* Дата */}
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Дата
                                </label>
                                <input
                                    type="date"
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary"
                                />
                            </div>

                            {/* Статус */}
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Статус приемов
                                </label>
                                <select
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary"
                                >
                                    <option value="all">Все</option>
                                    <option value="available">Доступные</option>
                                    <option value="booked">Забронированные</option>
                                    <option value="cancelled">Отмененные</option>
                                    <option value="blocked">Заблокированные</option>
                                </select>
                            </div>
                        </div>
                    )}
                </div>

                {/* Основная область с приемами */}
                <div className="lg:col-span-3">
                    <div className="bg-white rounded-lg p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <FaCalendar />
                                Созданные приемы
                            </h2>
                            <div className="text-sm text-gray-500">
                                {slotsLoading ? 'Загрузка...' : `${slots.length} приемов найдено`}
                            </div>
                        </div>

                        {/* Ошибки */}
                        {slotsError && (
                            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                                <div className="font-medium mb-2">Ошибка загрузки приемов:</div>
                                <div className="text-sm text-red-600">{slotsError}</div>
                                <div className="text-xs text-red-500 mt-2">
                                    Возможно, приемы не созданы для выбранной даты. Попробуйте создать их в разделе "Расписания".
                                </div>
                            </div>
                        )}

                        {/* Список приемов */}
                        {slots.length > 0 ? (
                            <div className="grid gap-4">
                                {slots.map((slot) => (
                                    <div
                                        key={slot.id}
                                        className={`p-4 border rounded-lg ${
                                            slot.status === 'booked'
                                                ? 'border-green-200 bg-green-50'
                                                : slot.status === 'available'
                                                ? 'border-blue-200 bg-blue-50'
                                                : slot.status === 'cancelled'
                                                ? 'border-red-200 bg-red-50'
                                                : 'border-gray-200 bg-gray-50'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-3 h-3 rounded-full ${
                                                    slot.status === 'booked'
                                                        ? 'bg-green-500'
                                                        : slot.status === 'available'
                                                        ? 'bg-blue-500'
                                                        : slot.status === 'cancelled'
                                                        ? 'bg-red-500'
                                                        : 'bg-gray-500'
                                                }`} />
                                                <div>
                                                    <div className="font-medium">
                                                        {slot.start_time} - {slot.end_time}
                                                    </div>
                                                    <div className="text-sm text-gray-600">
                                                        {getSlotStatusText(slot)}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-sm text-gray-500">
                                                {slot.duration_minutes} мин
                                            </div>
                                        </div>

                                        {/* Информация о пациенте для забронированных приемов */}
                                        {slot.status === 'booked' && slot.patient_name && (
                                            <div className="mt-3 pt-3 border-t border-gray-200">
                                                <div className="text-sm">
                                                    <span className="font-medium">Пациент:</span> {slot.patient_name}
                                                </div>
                                                {slot.patient_phone && (
                                                    <div className="text-sm text-gray-600">
                                                        {slot.patient_phone}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : !slotsLoading && !slotsError ? (
                            <div className="text-center py-8">
                                <NoContent
                                    title="Приемы не найдены"
                                    description="На выбранную дату и с выбранными фильтрами приемов не найдено"
                                />
                            </div>
                        ) : null}
                    </div>
                </div>
            </div>
        </PageStateWrapper>
    )
} 