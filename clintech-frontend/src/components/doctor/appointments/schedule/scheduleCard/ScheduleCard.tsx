'use client'
import React, { useState } from 'react'
import { TScheduleFormValues } from '@/types/calendar';
import ScheduleCardActions from './ScheduleCardActions';
import ScheduleCardInfo from './ScheduleCardInfo';
import { getScheduleStatusStyle } from '@/utils/schedule'

interface IScheduleCardProps {
    schedule: TScheduleFormValues
    index: number,
    toggleSchedule: (scheduleId: string) => void,
    toggling: boolean,
    deleteAllSlots: (scheduleId: string) => void,
    deleting: boolean,
    onEdit: () => void,
    deleteSchedule: (scheduleId: string) => void,
}

export default function ScheduleCard({ schedule, index, toggleSchedule, toggling, deleteAllSlots, deleting, onEdit, deleteSchedule }: IScheduleCardProps) {

    const [isSettingsOpen, setIsSettingsOpen] = useState(false)

    // Получаем стили статуса из утилит
    const statusStyle = getScheduleStatusStyle(schedule.is_active || false)

    return (
        <div className="group relative bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl hover:shadow-primary/10 transition-all duration-300 mt-6">
            {/* Цветная полоска сверху */}
            <div className={`h-1.5 w-full ${statusStyle.stripe}`} />

            <div className="p-6">
                <div className="flex flex-col xl:flex-row  xl:justify-between gap-6">
                    <ScheduleCardActions
                        isSettingsOpen={isSettingsOpen}
                        setIsSettingsOpen={setIsSettingsOpen}
                        toggleSchedule={toggleSchedule}
                        schedule={schedule}
                        toggling={toggling}
                        deleteAllSlots={deleteAllSlots}
                        deleting={deleting}
                        onEdit={onEdit}
                        deleteSchedule={deleteSchedule}
                        statusStyle={statusStyle}
                    />

                    {/* Основная информация */}
                    <ScheduleCardInfo schedule={schedule} statusStyle={statusStyle} />
                </div>
            </div>
        </div>
    )
}
