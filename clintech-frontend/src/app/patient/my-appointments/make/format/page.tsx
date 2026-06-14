'use client'
import { useRouter } from 'next/navigation'
import { TAppointmentFormat, useAppointment } from '@/context/AppointmentContext'
import PagesLayout from '@/components/layout/general/PagesLayout'
import Image from 'next/image'
import MyButton from '@/components/ui/MyButton'
import { FaVideo, FaMapMarkerAlt, FaClipboardList } from 'react-icons/fa'
import { useState, useMemo, useEffect } from 'react'
import { useAvailableSlots } from '@/hooks/schedule/useAvailableSlots'
import Loader from '@/components/ui/Loader'
import NoContent from '@/components/ui/NoContent'
import { UserIcon } from 'lucide-react'
import PageStateWrapper from '@/components/ui/PageStateWrapper'
import { useQuestionnaires } from '@/hooks/files/useQuestionnaires'
import { useAuth } from '@/hooks/auth/useAuth'

export default function FormatAppointmentPage() {
    const router = useRouter()
    const { doctor, format, setFormat } = useAppointment()
    const [days, setDays] = useState<number>(14)
    const { session } = useAuth()

    // Загружаем анкеты пациента
    const { questionnaires: anketa, loading: anketaLoading, error: anketaError } = useQuestionnaires(session?.user_id)
    const [selectedAnketaId, setSelectedAnketaId] = useState<string | null>(null)

    // Автоматически выбираем последнюю анкету (но можно выбрать "Без анкеты")
    useEffect(() => {
        if (anketa && anketa.length > 0 && !selectedAnketaId) {
            const sorted = [...anketa].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            // Автоматически выбираем последнюю, но пользователь может выбрать "Без анкеты"
            setSelectedAnketaId(sorted[0].id)
            setFormat((prev: TAppointmentFormat) => ({ ...prev, anketa_id: sorted[0].id }))
        } else if ((!anketa || anketa.length === 0) && !selectedAnketaId) {
            // Если анкет нет, устанавливаем "Без анкеты"
            setSelectedAnketaId(null)
            setFormat((prev: TAppointmentFormat) => ({ ...prev, anketa_id: undefined }))
        }
    }, [anketa, selectedAnketaId, setFormat])

    // Проверяем наличие врача и редиректим если нет
    useEffect(() => {
        if (!doctor) {
            router.push('/patient/my-appointments/make')
        }
    }, [doctor, router])

    // Если врач не выбран, показываем загрузку
    if (!doctor) {
        return (
            <PagesLayout title="Загрузка..." description="">
                <div className="flex justify-center items-center h-64">
                    <Loader />
                </div>
            </PagesLayout>
        )
    }

    // Генерируем даты на ближайшие дни
    const availableDates = useMemo(() => {
        const dates = []
        const today = new Date()
        for (let i = 0; i < days; i++) {
            const date = new Date(today)
            date.setDate(today.getDate() + i)
            dates.push({
                date: date.toLocaleDateString('en-CA'), // YYYY-MM-DD в локальном часовом поясе
                displayDate: date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }),
                dayOfWeek: date.toLocaleDateString('ru-RU', { weekday: 'short' })
            })
        }
        return dates
    }, [days])

    // Состояние для выбранной даты (устанавливаем первую дату по умолчанию)
    const [selectedDate, setSelectedDate] = useState<string>()
    const [appointmentFormat, setAppointmentFormat] = useState<'online' | 'offline' | 'both'>('both')

    // Получаем доступные слоты
    const { slots, loading, error } = useAvailableSlots(
        doctor?.id || doctor?.user_id || '',
        selectedDate || '',
        doctor?.user_id || doctor?.id || ''
    )

    // Определяем доступные форматы приема на основе слотов врача
    const availableFormats = useMemo(() => {
        if (!slots?.slots || slots.slots.length === 0) {
            return { online: false, offline: false };
        }

        // Слоты с типом 'both' доступны для обоих форматов
        const hasOnline = slots.slots.some((slot) =>
            slot.appointment_type === 'online' || slot.appointment_type === 'both'
        );
        const hasOffline = slots.slots.some((slot) =>
            slot.appointment_type === 'offline' || slot.appointment_type === 'both'
        );

        return { online: hasOnline, offline: hasOffline };
    }, [slots]);

    useEffect(() => {
        if (availableFormats.online && availableFormats.offline) {
            // Оба доступны - оставляем 'both'
            if (appointmentFormat === 'both') return;
        } else if (availableFormats.online && !availableFormats.offline) {
            // Только онлайн
            if (appointmentFormat !== 'online') {
                setAppointmentFormat('online');
                setFormat((prev: import('@/context/AppointmentContext').TAppointmentFormat) => ({ ...prev, format: 'Онлайн' }));
            }
        } else if (!availableFormats.online && availableFormats.offline) {
            // Только офлайн
            if (appointmentFormat !== 'offline') {
                setAppointmentFormat('offline');
                setFormat((prev: import('@/context/AppointmentContext').TAppointmentFormat) => ({ ...prev, format: 'Лично' }));
            }
        }
    }, [availableFormats, appointmentFormat, format, setFormat]);

    // Проверяем, все ли необходимые поля заполнены
    const isFormValid = useMemo(() => {
        // Базовые поля (анкета теперь необязательна)
        const hasBasicFields = !!(
            format.date &&          // Дата выбрана
            format.time &&          // Время выбрано
            format.slotId &&        // Слот выбран
            format.format           // Формат приема выбран
        );

        // Дополнительная проверка для онлайн формата
        const hasOnlineRequirements = format.format !== 'Онлайн' || !!(format.platform);

        return hasBasicFields && hasOnlineRequirements;
    }, [format]);

    // Определяем, какие поля не заполнены
    const getMissingFields = () => {
        const missing = [];
        if (!format.date) missing.push('дату');
        if (!format.time || !format.slotId) missing.push('время');
        if (!format.format) missing.push('формат приема');
        if (format.format === 'Онлайн' && !format.platform) missing.push('платформу');

        return missing;
    };

    return (
        <PagesLayout title="Выбор даты и времени" description="Выберите удобное время и формат для приема" isBackButton={true}>
            <PageStateWrapper
                loading={loading}
                loadingText="Загрузка данных записи"
                error={error}
                className="container"
            >
                <div className='container grid lg:grid-cols-3 gap-4 pb-10'>
                    <div className='col-span-3 lg:col-span-1 border p-4 space-y-4 h-fit bg-white rounded-xl'>
                        <div className='flex flex-col xs:flex-row lg:flex-col 2xl:flex-row 2xl:items-center gap-x-4 gap-y-2'>
                            {doctor.avatar_url ? (
                                <Image
                                    src={doctor.avatar_url}
                                    alt={doctor.first_name + ' ' + doctor.middle_name + ' ' + doctor.last_name || 'аватар'}
                                    width={150}
                                    height={150}
                                    className="rounded-full object-cover"
                                />
                            ) : (
                                <div className="w-36 h-36 lg:w-28 lg:h-28 mx-auto sm:mx-0 bg-primary hover:bg-primary/90 rounded-full flex items-center justify-center">
                                    <UserIcon className="w-32 h-32 lg:w-24 lg:h-24 text-white" />
                                </div>)}

                            <div className='flex flex-col items-center sm:block text-center sm:text-left'>
                                <h1>
                                    <p className='text-lg sm:text-xl font-bold'>{doctor?.first_name || ''} {doctor?.last_name || ''} {doctor?.middle_name || ''}</p>
                                    <p className='text-lg sm:text-xl font-bold text-primary'>{doctor?.roles?.join(', ') || 'не указано'}</p>
                                </h1>
                                <div className='pt-2 border-t my-2'>
                                    <p className='text-md font-semibold'>
                                        {(() => {
                                            // Если выбран конкретный слот, показываем его продолжительность
                                            if (format.slotId && slots?.slots) {
                                                const selectedSlot = slots.slots.find((slot) => slot.id === format.slotId);
                                                if (selectedSlot) {
                                                    return `${selectedSlot.duration_minutes} минут консультация`;
                                                }
                                            }

                                            // Если слот не выбран, показываем общую информацию о продолжительности
                                            if (slots?.slots && slots.slots.length > 0) {
                                                const durations = slots.slots
                                                    .map((slot) => slot.duration_minutes)
                                                    .filter((duration): duration is number => duration !== undefined);

                                                if (durations.length === 0) {
                                                    return 'Время приема не указано';
                                                }

                                                const uniqueDurations = [...new Set(durations)];

                                                if (uniqueDurations.length === 1) {
                                                    // Все слоты одинаковой продолжительности
                                                    return `${uniqueDurations[0]} минут консультация`;
                                                } else {
                                                    // Разная продолжительность слотов
                                                    const min = Math.min(...durations);
                                                    const max = Math.max(...durations);
                                                    return `${min}-${max} минут консультация`;
                                                }
                                            }

                                            return 'Время приема не указано';
                                        })()}
                                    </p>
                                </div>

                                <div className='flex items-center gap-4 border-t'>
                                    <p className='text-md font-semibold'>плата за прием</p>
                                    <p className='text-md font-semibold text-primary'>{doctor?.price ? `${doctor.price} тг` : 'не указано'}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className='col-span-3  lg:col-span-2 border p-4 space-y-4 bg-white rounded-xl'>
                        <h1 className='text-2xl font-bold'>Заполните данные</h1>

                        <div className='space-y-2'>
                            <p className='text-lg font-semibold'>Выберите дату</p>
                            <select
                                className='w-full p-2 border border-gray-300 rounded-lg'
                                value={days}
                                onChange={(e) => setDays(Number(e.target.value))}
                            >
                                <option value={3}>ближайшие 3 дня</option>
                                <option value={7}>ближайшие 7 дней</option>
                                <option value={14}>ближайшие 14 дней</option>
                                <option value={30}>ближайшие 30 дней</option>
                            </select>

                            <div className='grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-1 gap-y-2 md:gap-4'>
                                {availableDates.map((dateInfo) => (
                                    <MyButton
                                        key={dateInfo.date}
                                        className={`flex flex-col items-center xl:py-4 border rounded-lg hover:bg-teal-50/50 ${selectedDate === dateInfo.date ? 'border-primary bg-teal-100' : ''}`}
                                        onClick={() => {
                                            setSelectedDate(dateInfo.date)
                                            setFormat((prev: import('@/context/AppointmentContext').TAppointmentFormat) => ({
                                                ...prev,
                                                date: dateInfo.date,
                                                time: '',
                                                slotId: '',
                                                duration_minutes: undefined,
                                                slotTitle: ''
                                            })) // Сохраняем фактическую дату и сбрасываем данные слота
                                        }}
                                    >
                                        <p className='text-lg'>{dateInfo.displayDate}</p>
                                        <p className='text-md text-gray-500'>{dateInfo.dayOfWeek}</p>
                                    </MyButton>
                                ))}
                            </div>
                        </div>

                        <div className=''>
                            <p className='text-lg font-bold'>Выберите время</p>
                            <div className='grid grid-cols-3 gap-4'>
                                {slots && slots.slots ? (
                                    (() => {
                                        const now = new Date();
                                        const today = now.toLocaleDateString('en-CA');
                                        const currentTime = now.getHours() * 60 + now.getMinutes();

                                        const filteredSlots = slots.slots.filter((slot) => {
                                            // 1. Фильтр по формату приема
                                            const formatMatch = appointmentFormat === 'both' ||
                                                slot.appointment_type === appointmentFormat ||
                                                slot.appointment_type === 'both';

                                            // 2. Фильтр по времени - скрываем прошедшие слоты
                                            const slotDate = slot.start_time.split('T')[0]; // YYYY-MM-DD

                                            let isNotPassed = true;
                                            if (slotDate === today) {
                                                // Если слот сегодня - сравниваем время
                                                const slotTime = (() => {
                                                    const timeStr = slot.start_time.split('T')[1].substring(0, 5); // "11:00"
                                                    const [hours, minutes] = timeStr.split(':').map(Number);
                                                    return hours * 60 + minutes;
                                                })();
                                                isNotPassed = slotTime > currentTime;
                                            }
                                            // Если слот не сегодня (в будущем) - всегда доступен

                                            // 3. Фильтр по доступности - если поля нет, считаем доступным
                                            const isAvailable = slot.is_available !== false && slot.status !== 'booked' && slot.status !== 'cancelled';
                                            return formatMatch && isNotPassed; // Временно убираем проверку доступности
                                        });

                                        if (filteredSlots.length === 0) {
                                            return (
                                                <div className="col-span-3 text-center py-8 text-gray-500">
                                                    <NoContent title='Нет доступного времени' description='На данную дату нет свободного времени для записи. Пожалуйста, выберите другую дату' />
                                                </div>
                                            );
                                        }

                                        return filteredSlots.map((slot) => {
                                            const startTime = slot.start_time.split('T')[1].substring(0, 5);
                                            return (
                                                <MyButton
                                                    key={slot.id}
                                                    className={`flex flex-col items-center xl:py-4 border rounded-lg hover:bg-teal-50 ${format.time === startTime ? 'border-primary bg-teal-100' : ''}`}
                                                    onClick={() => setFormat((prev: TAppointmentFormat) => ({
                                                        ...prev,
                                                        time: startTime,
                                                        slotId: slot.id,
                                                        duration_minutes: slot.duration_minutes,
                                                        slotTitle: slot.title
                                                    }))}
                                                >
                                                    <p className="text-lg font-semibold">{startTime}</p>
                                                    <p className="text-md text-primary">{slot.duration_minutes} мин</p>
                                                    {slot.price && (
                                                        <p className="text-xs text-blue-500">{slot.price} тг</p>
                                                    )}
                                                </MyButton>
                                            );
                                        });
                                    })()
                                ) : (
                                    <div className="col-span-3 text-center py-8 text-gray-500">
                                        {selectedDate ?
                                            <NoContent title='Нет доступного времени' description='На данную дату нет свободного времени для записи. Пожалуйста, выберите другую дату' /> :
                                            <NoContent title='Выберите дату' description='Доступное время для записи появятся после выбора даты' />}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className='space-y-2'>
                            <p className='text-lg font-semibold'>
                                <span className='text-gray-500'>Формат приема </span>
                                {!selectedDate && (
                                    <span className='text-gray-500 ml-2'> (выберите дату приема)</span>
                                )}
                            </p>

                            <div className='flex gap-4'>
                                <MyButton
                                    className={`flex flex-col gap-1 xl:gap-2 items-center w-1/2 py-4 xl:py-10 border rounded-lg hover:bg-teal-50/30
                                    ${appointmentFormat === 'online' ? 'border-primary bg-teal-100' : ''}
                                    ${!availableFormats.online ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    onClick={() => {
                                        if (availableFormats.online) {
                                            setAppointmentFormat('online');
                                            setFormat((prev: TAppointmentFormat) => ({ ...prev, format: 'Онлайн' }));
                                        }
                                    }}
                                    disabled={!availableFormats.online}
                                >
                                    <FaVideo className={`${appointmentFormat === 'online' ? 'text-blue-500' : availableFormats.online ? 'text-gray-500' : 'text-gray-300'}`} />
                                    <p className={`${appointmentFormat === 'online' ? 'text-blue-500' : availableFormats.online ? '' : 'text-gray-400'}`}>Онлайн</p>
                                    <p className={availableFormats.online ? '' : 'text-gray-400'}>
                                        {availableFormats.online ? 'Онлайн прием' : 'Недоступно'}
                                    </p>
                                </MyButton>

                                <MyButton
                                    className={`flex flex-col gap-1 xl:gap-2 items-center w-1/2 py-4 xl:py-10 border rounded-lg hover:bg-teal-50/30
                                    ${appointmentFormat === 'offline' ? 'border-primary bg-teal-100' : ''}
                                    ${!availableFormats.offline ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    onClick={() => {
                                        if (availableFormats.offline) {
                                            setAppointmentFormat('offline');
                                            setFormat((prev: TAppointmentFormat) => ({ ...prev, format: 'Визит' }));
                                        }
                                    }}
                                    disabled={!availableFormats.offline}
                                >
                                    <FaMapMarkerAlt className={`${appointmentFormat === 'offline' ? 'text-blue-500' : availableFormats.offline ? 'text-gray-500' : 'text-gray-300'}`} />
                                    <p className={`${appointmentFormat === 'offline' ? 'text-blue-500' : availableFormats.offline ? '' : 'text-gray-400'}`}>Визит</p>
                                    <p className={availableFormats.offline ? '' : 'text-gray-400'}>
                                        {availableFormats.offline ? 'Посетить клинику' : 'Недоступно'}
                                    </p>
                                </MyButton>
                            </div>

                            {/* Сообщение о недоступных форматах */}
                            {!loading && !error && slots && (
                                <div className="rounded-lg bg-teal-50/80 p-3 text-sm text-gray-600">
                                    {availableFormats.online && availableFormats.offline && (
                                        <p className="text-md"> Врач принимает как онлайн, так и офлайн</p>
                                    )}
                                    {availableFormats.online && !availableFormats.offline && (
                                        <p className="text-md"> Врач принимает только онлайн</p>
                                    )}
                                    {!availableFormats.online && availableFormats.offline && (
                                        <p className="text-md"> Врач принимает только при личном визите</p>
                                    )}
                                    {!availableFormats.online && !availableFormats.offline && (
                                        <p className="text-md"> На выбранную дату нет доступных приемов</p>
                                    )}
                                </div>
                            )}
                        </div>

                        {
                            format.format === 'Онлайн' && (
                                <div className=''>
                                    <p className='text-lg font-bold'>Какая платформа вам более удобна?</p>
                                    <div className='grid grid-cols-3 gap-4'>
                                        <MyButton className={`flex flex-col items-center justify-center xl:py-4 border rounded-lg hover:bg-teal-50/30  ${format.platform === 'ZOOM' ? 'border-primary bg-teal-100' : ''}`}
                                            onClick={() => setFormat((prev: TAppointmentFormat) => ({ ...prev, platform: 'ZOOM' }))}
                                        >
                                            <p className='text-lg'>ZOOM</p>
                                        </MyButton>
                                        <MyButton className={`flex flex-col items-center justify-center xl:py-4 border rounded-lg hover:bg-teal-50/30  ${format.platform === 'WhatsApp' ? 'border-primary bg-teal-100' : ''}`}
                                            onClick={() => setFormat((prev: TAppointmentFormat) => ({ ...prev, platform: 'WhatsApp' }))}
                                        >
                                            <p className='text-lg'>WhatsApp</p>
                                        </MyButton>
                                        <MyButton className={`flex flex-col items-center justify-center xl:py-4 border rounded-lg hover:bg-teal-50/30  ${format.platform === 'Google Meet' ? 'border-primary bg-teal-100' : ''}`}
                                            onClick={() => setFormat((prev: TAppointmentFormat) => ({ ...prev, platform: 'Google Meet' }))}
                                        >
                                            <p className='text-lg'>Google Meet</p>
                                        </MyButton>
                                    </div>
                                </div>
                            )}

                        {/* Секция выбора анкеты */}
                        <div className='space-y-2'>
                            <p className='text-lg font-semibold'>Выберите анкету для приема (необязательно)</p>
                            {anketaLoading ? (
                                <div className="flex justify-center py-4">
                                    <Loader />
                                </div>
                            ) : anketaError ? (
                                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                                    <p className="text-red-600">Ошибка загрузки анкет: {anketaError}</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <select
                                        value={selectedAnketaId || 'none'}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            if (value === 'none') {
                                                setSelectedAnketaId(null)
                                                setFormat((prev: TAppointmentFormat) => ({ ...prev, anketa_id: undefined }))
                                            } else {
                                                setSelectedAnketaId(value)
                                                setFormat((prev: TAppointmentFormat) => ({ ...prev, anketa_id: value }))
                                            }
                                        }}
                                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    >
                                        <option value="none">Без анкеты</option>
                                        {anketa && anketa.length > 0 && anketa.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map((a, index) => (
                                            <option key={a.id} value={a.id}>
                                                {index === 0 ? 'Последняя: ' : ''}Анкета от {new Date(a.created_at).toLocaleString('ru-RU')}
                                            </option>
                                        ))}
                                    </select>
                                    <p className='text-md text-gray-500'>
                                        Вы можете записаться с анкетой или без неё
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Поле для заметок пациента */}
                        <div className='space-y-2'>
                            <p className='text-lg font-semibold'>Заметки к приему</p>
                            <textarea
                                className='w-full p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                                rows={3}
                                placeholder='Опишите свои симптомы или жалобы (например, "Болит голова", "Проблемы со сном")'
                                value={format.patient_notes || ''}
                                onChange={(e) => setFormat((prev: TAppointmentFormat) => ({ ...prev, patient_notes: e.target.value }))}
                            />
                            <p className='text-md text-gray-500'>
                                Эта информация поможет врачу лучше подготовиться к приему
                            </p>
                        </div>



                        <MyButton
                            className={`w-full py-2 text-lg text-white ${isFormValid ? 'bg-blue-700 hover:bg-blue-800' : 'bg-gray-400 cursor-not-allowed'}`}
                            onClick={() => {
                                if (isFormValid) {
                                    router.push('/patient/my-appointments/make/payment')
                                }
                            }}
                            disabled={!isFormValid}
                        >
                            {isFormValid ? 'Перейти к оплате' : (() => {
                                const missingFields = getMissingFields();
                                return missingFields.length > 0
                                    ? `Выберите: ${missingFields.join(', ')}`
                                    : 'Заполните все поля';
                            })()}
                        </MyButton>
                    </div>
                </div >
            </PageStateWrapper>
        </PagesLayout >
    )
} 