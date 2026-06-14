'use client'
import { PatientQuestionnaire } from '@/hooks/files/useQuestionnaires'
import PageStateWrapper from '@/components/ui/PageStateWrapper'
import MyButton from '@/components/ui/MyButton'
import React, { useState, useEffect, useMemo } from 'react'
import ChatIdAnswers from '@/components/chat/chatId/ChatIdAnswers'
import ChatIdRecommendation from '@/components/chat/chatId/ChatIdRecommendation'
import ChatIdFiles from '@/components/chat/chatId/ChatIdFiles'
import { TAnalysis } from '@/types/questionnaire'
import { IAuthSession } from '@/hooks/auth/useAuthSession'
import { TAppointment } from '@/types/appointments'
import { formatDateWithTime } from '@/utils/date'

interface IAppointmentAnketaProps {
    session: IAuthSession | null
    appointment: TAppointment | null
    anketa: PatientQuestionnaire[] | null
    anketaLoading: boolean
    anketaError: string | null
    selectedAnketaId: string | null
    setSelectedAnketaId: (id: string | null) => void
}

export default function AppointmentAnketa({
    session,
    appointment,
    anketa,
    anketaLoading,
    anketaError,
    selectedAnketaId,
    setSelectedAnketaId
}: IAppointmentAnketaProps) {
    const [anketaTab, setAnketaTab] = useState<'answers' | 'recommendations' | 'files'>('answers')

    // Автоматически выбираем анкету из записи
    useEffect(() => {
        if (appointment?.anketa_id && !selectedAnketaId) {
            setSelectedAnketaId(appointment.anketa_id);
        }
    }, [appointment?.anketa_id, selectedAnketaId, setSelectedAnketaId]);

    // Получаем выбранную анкету из массива
    const selectedAnketa = useMemo(() => {
        if (!selectedAnketaId || !anketa) return null;
        return anketa.find(a => a.id === selectedAnketaId) ?? null;
    }, [anketa, selectedAnketaId]);

    // Проверяем, есть ли анкеты у пациента
    const hasQuestionnaires = anketa && anketa.length > 0;
    const wasAnketaSelectedOnBooking = appointment?.anketa_id;

    return (
        <div className="bg-white rounded-xl p-3 sm:p-6 shadow space-y-4 max-w-full w-full">
            <h2 className='text-xl font-bold mb-4'>
                {session?.role === 'patient' ? 'Моя анкета' : 'Анкета пациента'}
            </h2>

            {/* Если пациент записан без анкеты, но есть доступные анкеты - показываем выбор */}
            {!wasAnketaSelectedOnBooking && hasQuestionnaires && !selectedAnketa && !anketaLoading && (
                <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="font-semibold text-amber-900 mb-3">
                        Пациент записан без анкеты. Вы можете выбрать анкету:
                    </p>
                    <select
                        value={selectedAnketaId || 'none'}
                        onChange={(e) => {
                            const value = e.target.value;
                            if (value === 'none') {
                                setSelectedAnketaId(null);
                            } else {
                                setSelectedAnketaId(value);
                            }
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    >
                        <option value="none">Не выбирать анкету</option>
                        {anketa && anketa.length > 0 && anketa
                            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                            .map((a, index) => (
                                <option key={a.id} value={a.id}>
                                    {index === 0 ? 'Последняя: ' : ''}Анкета от {formatDateWithTime(a.created_at)}
                                </option>
                            ))}
                    </select>
                </div>
            )}

            {/* Если анкета не выбрана и нет доступных анкет */}
            {!selectedAnketa && !hasQuestionnaires && !anketaLoading && (
                <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                    <p className="text-gray-600">
                        Пациент записан без анкеты. У пациента нет доступных анкет.
                    </p>
                </div>
            )}

            {/* Загрузка */}
            {anketaLoading && (
                <div className="text-center py-8 text-gray-500">
                    Загрузка анкет пациента...
                </div>
            )}

            {/* Ошибка */}
            {anketaError && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-red-600">Ошибка загрузки анкет: {anketaError}</p>
                </div>
            )}

            {/* Выбор другой анкеты, если есть несколько и анкета уже выбрана */}
            {!anketaLoading && !anketaError && hasQuestionnaires && anketa && anketa.length > 1 && selectedAnketa && (
                <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Выбрать другую анкету:
                    </label>
                    <select
                        value={selectedAnketaId || 'none'}
                        onChange={(e) => {
                            const value = e.target.value;
                            if (value === 'none') {
                                setSelectedAnketaId(null);
                            } else {
                                setSelectedAnketaId(value);
                            }
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    >
                        <option value="none">Не выбирать анкету</option>
                        {anketa
                            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                            .map((a, index) => (
                                <option key={a.id} value={a.id}>
                                    {index === 0 ? 'Последняя: ' : ''}Анкета от {formatDateWithTime(a.created_at)}
                                    {a.id === appointment?.anketa_id ? ' (выбрана при записи)' : ''}
                                </option>
                            ))}
                    </select>
                </div>
            )}

            {/* Информация о выбранной анкете */}
            {!anketaLoading && !anketaError && selectedAnketa && (
                <>
                    <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                        <p className="font-semibold text-gray-900">
                            {wasAnketaSelectedOnBooking && selectedAnketa.id === appointment?.anketa_id
                                ? 'Анкета, выбранная при записи'
                                : 'Выбранная анкета'}
                        </p>
                        <p className="text-sm text-gray-600">
                            Заполнена {formatDateWithTime(selectedAnketa.created_at)}
                        </p>
                    </div>

                    <div className='grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8'>
                        <MyButton className={`w-full text-sm sm:text-lg ${anketaTab === 'answers' ? 'bg-primary hover:bg-primary/90 text-white' : 'bg-gray-100'}`} onClick={() => setAnketaTab('answers')}>
                            Ответы
                        </MyButton>
                        {/* <MyButton className={`w-full text-sm sm:text-lg ${anketaTab === 'recommendations' ? 'bg-primary hover:bg-primary/90 text-white' : 'bg-gray-100'}`} onClick={() => setAnketaTab('recommendations')}>
                            Рекомендации
                        </MyButton> */}
                        <MyButton className={`w-full text-sm sm:text-lg ${anketaTab === 'files' ? 'bg-primary hover:bg-primary/90 text-white' : 'bg-gray-100'}`} onClick={() => setAnketaTab('files')}>
                            Файлы анкеты
                        </MyButton>
                    </div>

                    {anketaTab === 'answers' && (
                        <ChatIdAnswers selectedChat={selectedAnketa as TAnalysis} />
                    )}

                    {/* {anketaTab === 'recommendations' && (
                        <ChatIdRecommendation analysis={selectedAnketa as TAnalysis} />
                    )} */}

                    {anketaTab === 'files' && (
                        <ChatIdFiles 
                            analysis={selectedAnketa as TAnalysis} 
                            appointmentId={appointment?.id || undefined}
                        />
                    )}
                </>
            )}

            {/* Сообщение, если анкета была выбрана при записи, но не найдена */}
            {!anketaLoading && !anketaError && wasAnketaSelectedOnBooking && !selectedAnketa && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="font-semibold text-red-900">Анкета пациента не найдена</p>
                    <p className="text-sm text-red-600 mt-1">
                        Анкета, выбранная при записи, не найдена или была удалена.
                        {hasQuestionnaires && ' Вы можете выбрать другую анкету из списка выше.'}
                    </p>
                </div>
            )}
        </div>
    )
}
