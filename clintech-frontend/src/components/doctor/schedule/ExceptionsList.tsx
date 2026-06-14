'use client';

import React from 'react';
import { Clock, Calendar, Trash2, CalendarX } from 'lucide-react';
import { AppointmentException } from '@/hooks/appointment/useAppointmentExceptions';
import MyButton from '@/components/ui/MyButton';
import NoContent from '@/components/ui/NoContent';

interface ExceptionsListProps {
    exceptions: AppointmentException[];
    loading: boolean;
    onDelete: (id: string) => void;
}

const ExceptionsList: React.FC<ExceptionsListProps> = ({
    exceptions,
    loading,
    onDelete
}) => {
    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('ru-RU', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    const formatTime = (time: string) => {
        return time.slice(0, 5); // HH:MM
    };

    if (loading) {
        return (
            <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    <span className="ml-2 text-gray-600">Загрузка закрытий...</span>
                </div>
            </div>
        );
    }

    if (exceptions.length === 0) {
        return (
            <NoContent 
                title="Нет закрытых периодов"
                description="Создайте первое закрытие расписания"
                
            />
            
        );
    }

    return (
        <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">
                    Закрытые периоды ({exceptions.length})
                </h3>
            </div>
            <div className="divide-y divide-gray-200">
                {exceptions.map((exception) => (
                    <div key={exception.id} className="p-6">
                        <div className="flex items-start justify-between">
                            <div className="flex-1">
                                <div className="flex items-center space-x-2 mb-2">
                                    {exception.type === 'day_off' ? (
                                        <Calendar className="h-5 w-5 text-red-500" />
                                    ) : (
                                        <Clock className="h-5 w-5 text-orange-500" />
                                    )}
                                    <span className="text-sm font-medium text-gray-900">
                                        {exception.type === 'day_off' ? 'Закрытый день' : 'Закрытые часы'}
                                    </span>
                                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                        exception.type === 'day_off' 
                                            ? 'bg-red-100 text-red-800' 
                                            : 'bg-orange-100 text-orange-800'
                                    }`}>
                                        {exception.type === 'day_off' ? 'Весь день' : 'Временно'}
                                    </span>
                                </div>

                                <div className="space-y-1">
                                    <p className="text-sm text-gray-600">
                                        <strong>Дата:</strong> {formatDate(exception.date)}
                                    </p>
                                    
                                    {exception.type === 'custom_hours' && exception.custom_start_time && exception.custom_end_time && (
                                        <p className="text-sm text-gray-600">
                                            <strong>Время:</strong> {formatTime(exception.custom_start_time)} - {formatTime(exception.custom_end_time)}
                                        </p>
                                    )}
                                    
                                    <p className="text-sm text-gray-600">
                                        <strong>Причина:</strong> {exception.reason}
                                    </p>
                                    
                                    <p className="text-xs text-gray-400">
                                        Создано: {new Date(exception.created_at).toLocaleString('ru-RU')}
                                    </p>
                                </div>
                            </div>

                            <MyButton
                                onClick={() => onDelete(exception.id)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                                <Trash2 className="h-4 w-4" />
                            </MyButton>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ExceptionsList;
