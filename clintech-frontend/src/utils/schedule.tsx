import { FaCalendar, FaVideo, FaHospital } from 'react-icons/fa'
import { TScheduleDay } from '@/types/calendar'

/**
 * Возвращает стили для статуса расписания (активное/неактивное)
 */
export const getScheduleStatusStyle = (isActive: boolean) => {
    if (isActive) {
        return {
            badge: 'bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 border border-green-200',
            stripe: 'bg-gradient-to-r from-green-500 to-emerald-500',
            button: 'bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 border border-green-200 hover:from-green-200 hover:to-emerald-200'
        }
    } else {
        return {
            badge: 'bg-gradient-to-r from-gray-100 to-slate-100 text-gray-800 border border-gray-200',
            stripe: 'bg-gradient-to-r from-gray-400 to-slate-400',
            button: 'bg-gradient-to-r from-gray-100 to-slate-100 text-gray-800 border border-gray-200 hover:from-gray-200 hover:to-slate-200'
        }
    }
}

/**
 * Возвращает иконку для формата приема
 */
export const getAppointmentFormatIcon = (format?: string) => {
    switch (format) {
        case 'online':
            return <FaVideo className='text-blue-600' size={20} />
        case 'offline':
            return <FaHospital className='text-green-600' size={20} />
        case 'both':
            return (
                <div className="flex items-center gap-1">
                    <FaVideo className='text-blue-600' size={18} />
                    <FaHospital className='text-green-600' size={18} />
                </div>
            )
        default:
            return <FaCalendar className='text-primary' size={20} />
    }
}

/**
 * Возвращает текстовое описание формата приема
 */
export const getAppointmentFormatText = (format?: string): string => {
    switch (format) {
        case 'online': 
            return 'Только онлайн'
        case 'offline': 
            return 'Только офлайн'
        case 'both': 
            return 'Онлайн и офлайн'
        default: 
            return 'Не указан'
    }
}

/**
 * Возвращает CSS классы для цветового оформления формата приема
 */
export const getAppointmentFormatColor = (format?: string): string => {
    switch (format) {
        case 'online': 
            return 'bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-800 border border-blue-200'
        case 'offline': 
            return 'bg-gradient-to-r from-green-50 to-emerald-50 text-green-800 border border-green-200'
        case 'both': 
            return 'bg-gradient-to-r from-purple-50 to-indigo-50 text-purple-800 border border-purple-200'
        default: 
            return 'bg-gradient-to-r from-gray-50 to-slate-50 text-gray-800 border border-gray-200'
    }
}

/**
 * Возвращает локализованные названия дней недели
 */
export const getWeekDaysLabels = (): string[] => {
    return ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
}

/**
 * Проверяет, является ли день рабочим в расписании
 */
export const isWorkDay = (dayIndex: number, workDays?: number[]): boolean => {
    return workDays?.includes(dayIndex + 1) || false
}

/**
 * Форматирует время в читаемый вид
 */
export const formatScheduleTime = (startTime?: string, endTime?: string): string => {
    if (!startTime || !endTime) return 'Время не указано'
    return `${startTime} - ${endTime}`
}

/**
 * Возвращает статус текст с эмодзи
 */
export const getScheduleStatusText = (isActive: boolean): string => {
    return isActive ? 'Активно' : 'Неактивно'
}

// Новые утилиты для детального расписания

/**
 * Возвращает массив дней недели с настройками по умолчанию
 */
export const getDefaultScheduleDays = (): TScheduleDay[] => {
    return [
        { day_of_week: 1, start_time: '09:00', end_time: '17:00', break_start: '12:00', break_end: '13:00', is_working_day: true },
        { day_of_week: 2, start_time: '09:00', end_time: '17:00', break_start: '12:00', break_end: '13:00', is_working_day: true },
        { day_of_week: 3, start_time: '09:00', end_time: '17:00', break_start: '12:00', break_end: '13:00', is_working_day: true },
        { day_of_week: 4, start_time: '09:00', end_time: '17:00', break_start: '12:00', break_end: '13:00', is_working_day: true },
        { day_of_week: 5, start_time: '09:00', end_time: '17:00', break_start: '12:00', break_end: '13:00', is_working_day: true },
        { day_of_week: 6, start_time: '10:00', end_time: '14:00', break_start: null, break_end: null, is_working_day: false },
        { day_of_week: 7, start_time: '00:00', end_time: '00:00', break_start: null, break_end: null, is_working_day: false },
    ]
}

/**
 * Получает название дня недели по номеру
 */
export const getDayName = (dayOfWeek: number): string => {
    const dayNames = ['', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье']
    return dayNames[dayOfWeek] || 'Неизвестный день'
}

/**
 * Получает короткое название дня недели по номеру
 */
export const getDayShortName = (dayOfWeek: number): string => {
    const dayNames = ['', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
    return dayNames[dayOfWeek] || '?'
}

/**
 * Проверяет, является ли расписание детальным (имеет поле days)
 */
export const isDetailedSchedule = (schedule: any): boolean => {
    return schedule && Array.isArray(schedule.days) && schedule.days.length > 0
}

/**
 * Получает рабочие дни из детального расписания
 */
export const getWorkingDaysFromDetailed = (schedule: any): number[] => {
    if (!isDetailedSchedule(schedule)) return []
    return schedule.days
        .filter((day: TScheduleDay) => day.is_working_day)
        .map((day: TScheduleDay) => day.day_of_week)
}

/**
 * Форматирует информацию о рабочем времени для детального расписания
 */
export const formatDetailedScheduleInfo = (schedule: any): string => {
    if (!isDetailedSchedule(schedule)) return 'Простое расписание'
    
    const workingDays = schedule.days.filter((day: TScheduleDay) => day.is_working_day)
    if (workingDays.length === 0) return 'Нет рабочих дней'
    
    const dayNames = workingDays.map((day: TScheduleDay) => getDayShortName(day.day_of_week))
    return `${dayNames.join(', ')} • ${workingDays.length} дн.`
}

/**
 * Получает общее время работы из детального расписания
 */
export const getTotalWorkingHours = (schedule: any): string => {
    if (!isDetailedSchedule(schedule)) return 'Не указано'
    
    const workingDays = schedule.days.filter((day: TScheduleDay) => day.is_working_day)
    if (workingDays.length === 0) return 'Нет рабочих дней'
    
    // Показываем диапазон времени для всех дней
    const startTimes = workingDays.map((day: TScheduleDay) => day.start_time).sort()
    const endTimes = workingDays.map((day: TScheduleDay) => day.end_time).sort()
    
    const earliestStart = startTimes[0]
    const latestEnd = endTimes[endTimes.length - 1]
    
    return `${earliestStart} - ${latestEnd}`
}
