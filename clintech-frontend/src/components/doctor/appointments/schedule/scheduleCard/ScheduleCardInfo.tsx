import { FaClock, FaCalendarAlt } from 'react-icons/fa'
import { isDetailedSchedule, formatDetailedScheduleInfo, getDayName } from '@/utils/schedule'
import { getAppointmentFormatColor, getAppointmentFormatIcon, getAppointmentFormatText, getWeekDaysLabels, isWorkDay } from '@/utils/schedule'
import { TScheduleFormValues } from '@/types/calendar'

export default function ScheduleCardInfo({ schedule, statusStyle }: { schedule: TScheduleFormValues, statusStyle: { badge: string } }) {
    const isDetailed = isDetailedSchedule(schedule)
    
    return (
        <div className="flex-1 space-y-4 xl:order-1">
            {/* Заголовок с временем работы */}
            <div className="bg-primary/5 rounded-xl p-4 border border-primary/10">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="hidden sm:flex w-12 h-12 bg-primary/10 rounded-xl items-center justify-center">
                            <FaClock className="text-primary" size={20} />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-gray-900">{schedule.name}</h3>
                            <div className="text-lg font-semibold flex flex-col gap-2 md:flex-row xl:flex-col 3xl:flex-row">
                                {isDetailed ? (
                                    <span className="text-sm font-semibold text-primary">
                                        {formatDetailedScheduleInfo(schedule)}
                                    </span>
                                ) : (
                                    <span className="text-sm font-semibold text-primary">
                                        Время работы: {schedule?.start_time} - {schedule?.end_time}
                                    </span>
                                )}
                                {!isDetailed && schedule?.break_start && schedule?.break_end && (
                                    <span className="text-sm text-gray-500">
                                        | Перерыв: {schedule?.break_start} - {schedule?.break_end}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Детали расписания */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Продолжительность приема */}
                <div className="rounded-xl p-4 border border-green-200 bg-green-50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                            <FaClock className="text-green-600" size={16} />
                        </div>
                        <div>
                            <div className="text-sm font-medium text-green-700">Прием</div>
                            <div className="text-sm font-semibold text-green-800">{schedule.slot_duration} мин</div>
                        </div>
                    </div>
                </div>

                {/* Формат приема */}
                <div className={`rounded-xl p-4 border ${getAppointmentFormatColor(schedule?.appointment_format)}`}>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/60 rounded-lg flex items-center justify-center">
                            {getAppointmentFormatIcon(schedule?.appointment_format)}
                        </div>
                        <div>
                            <div className="text-sm font-medium opacity-80">Формат</div>
                            <div className="text-sm font-semibold">{getAppointmentFormatText(schedule?.appointment_format)}</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Дни недели */}
            <div className="bg-primary/5 rounded-xl p-4 border border-primary/10">
                <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <FaCalendarAlt className="text-indigo-600" size={16} />
                    </div>
                    <div className="flex-1">
                        <div className="text-sm font-medium text-indigo-700 mb-2">
                            {isDetailed ? 'Детальное расписание' : 'Рабочие дни'}
                        </div>
                        
                        {isDetailed ? (
                            <div className="space-y-2 w-fit">
                                {schedule.days
  ?.filter((day: any) => day.is_working_day)
  .map((day: any) => (
    <div key={day.day_of_week} className="flex flex-col sm:flex-row sm:items-center gap-x-2 p-2 rounded-lg bg-white/50">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">{getDayName(day.day_of_week)}</span>
      </div>

      <div className="text-sm flex flex-col sm:flex-row sm:items-center justify-between text-gray-600">
        <span className="text-sm">{day.start_time} - {day.end_time}</span>
        {day.break_start && day.break_end && (
          <span className="text-xs text-gray-500 sm:ml-2">
            (перерыв: {day.break_start}-{day.break_end})
          </span>
        )}
      </div>
    </div>
  ))}
                            </div>
                        ) : (
                            <div className="flex flex-wrap gap-2">
                                {getWeekDaysLabels().map((day, idx) => {
                                    const isActive = isWorkDay(idx, schedule.work_days)
                                    return (
                                        <span
                                            key={day}
                                            className={`px-3 py-1 rounded-lg text-sm font-medium ${isActive
                                                ? 'bg-indigo-200 text-indigo-900'
                                                : 'bg-gray-200 text-gray-500'
                                                }`}
                                        >
                                            {day}
                                        </span>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
