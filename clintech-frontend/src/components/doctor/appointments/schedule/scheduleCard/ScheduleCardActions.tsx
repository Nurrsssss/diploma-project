import React from 'react'
import { Settings } from 'lucide-react'
import MyButton from '@/components/ui/MyButton'
import { FaToggleOn, FaEdit, FaTrash } from 'react-icons/fa'
import { TScheduleFormValues } from '@/types/calendar'

interface IScheduleCardActionsProps {
    isSettingsOpen: boolean,
    setIsSettingsOpen: (isOpen: boolean) => void,
    toggleSchedule: (scheduleId: string) => void,
    schedule: TScheduleFormValues,
    toggling: boolean,
    deleteAllSlots: (scheduleId: string) => void,
    deleting: boolean,
    onEdit: () => void,
    deleteSchedule: (scheduleId: string) => void,
    statusStyle: {
        button: string,
        badge: string,
        stripe: string,
    },
}

export default function ScheduleCardActions({
    isSettingsOpen,
    setIsSettingsOpen,
    toggleSchedule,
    schedule,
    toggling,
    deleteAllSlots,
    deleting,
    onEdit,
    deleteSchedule,
    statusStyle
}: IScheduleCardActionsProps) {

    const handleDeleteSlots = () => {
        if (confirm('Вы уверены, что хотите удалить все приемы для этого расписания?')) {
            deleteAllSlots(schedule?.id || '');
        }
    };

    return (
        <div className="xl:min-w-[200px] xl:order-2 space-y-3">
            <div
                className="flex items-center justify-end ml-2 cursor-pointer transition-transform duration-200 hover:scale-105"
                onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            >
                <Settings
                    className={`w-7 h-7 transition-transform duration-300 ${isSettingsOpen ? 'rotate-90' : 'rotate-0'}`}
                />
            </div>

            {/* Анимированный контейнер настроек */}
            <div
                className={`overflow-hidden transition-all duration-300 ease-in-out ${isSettingsOpen
                        ? 'max-h-96 opacity-100 translate-y-0'
                        : 'max-h-0 opacity-0 -translate-y-4'
                    }`}
            >
                <div className="space-y-3 pt-2">
                    {/* Вторичные действия */}
                    <div className={`pt-2 border-t border-gray-100 space-y-2 transition-all duration-300 delay-200 ${isSettingsOpen ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
                        }`}>
                        <MyButton
                            className="w-full bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-800 border border-blue-200 hover:from-blue-200 hover:to-indigo-200 transition-all duration-200 flex items-center justify-center gap-2 py-2.5 hover:scale-[1.02] active:scale-95"
                            onClick={onEdit}
                        >
                            <FaEdit size={14} className="transition-transform duration-200" />
                            <span className="font-medium">Изменить</span>
                        </MyButton>

                        <MyButton
                            className="w-full bg-gradient-to-r from-red-100 to-rose-100 text-red-800 border border-red-200 hover:from-red-200 hover:to-rose-200 transition-all duration-200 flex items-center justify-center gap-2 py-2.5 hover:scale-[1.02] active:scale-95"
                            onClick={() => {
                                if (confirm('Вы уверены, что хотите удалить это расписание?')) {
                                    deleteSchedule(schedule?.id || '')
                                }
                            }}
                            disabled={deleting}
                        >
                            <FaTrash size={14} className="transition-transform duration-200" />
                            <span className="font-medium">
                                {deleting ? 'Удаляем...' : 'Удалить'}
                            </span>
                        </MyButton>
                    </div>
                </div>
            </div>
        </div>
    )
}