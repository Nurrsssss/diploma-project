'use client'
import { FaCalendar, FaPlus } from 'react-icons/fa';
import { TDoctorSchedule } from '@/types/doctorShedules';
import MyButton from '@/components/ui/MyButton';

interface ISchedulesHeaderProps {
    schedules: TDoctorSchedule[];
    onShowForm?: () => void;
}

export default function SchedulesHeader({ schedules, onShowForm }: ISchedulesHeaderProps) {
    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-r from-primary/10 to-blue-100 rounded-xl flex items-center justify-center">
                        <FaCalendar className="text-primary" size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Расписания</h1>
                        <p className="text-gray-500">
                            {schedules.length === 0 ? 'Нет расписаний' : 
                                `${schedules.length} ${schedules.length === 1 ? 'расписание' : schedules.length < 5 ? 'расписания' : 'расписаний'}`}
                        </p>
                    </div>
                </div>

                {/* Показываем кнопку создания только когда нет расписаний */}
                {schedules.length === 0 && onShowForm && (
                    <MyButton
                        onClick={onShowForm}
                        className="bg-primary hover:bg-primary/90 text-white px-6 py-3 rounded-xl flex items-center gap-2"
                    >
                        <FaPlus size={16} />
                        Создать расписание
                    </MyButton>
                )}
            </div>
        </div>
    );
}
