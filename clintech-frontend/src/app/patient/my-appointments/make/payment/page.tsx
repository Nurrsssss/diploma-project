'use client'
import PagesLayout from '@/components/layout/general/PagesLayout'
import Image from 'next/image'
import SwipeToPayButton from '@/components/ui/SwipeToPayButton'
import { useRouter } from 'next/navigation'
import MyInput from '@/components/ui/MyInput'
import { FaRegCalendarAlt, FaRegClock, FaVideo, FaMobileAlt } from 'react-icons/fa'
import { useForm } from 'react-hook-form'
import { useAppointment, IAppointmentPayment } from '@/context/AppointmentContext'
import { useState, useEffect } from 'react'
import { UserIcon } from 'lucide-react'
import { useAppointments } from '@/hooks/appointment/useAppointments'
import MyButton from '@/components/ui/MyButton'
import PageStateWrapper from '@/components/ui/PageStateWrapper'
import { useLatestAnalysis } from '@/hooks/analysis/useLatestAnalysis'

export default function PaymentPage() {
    const router = useRouter()
    const { doctor, format, payment, setPayment, setResult } = useAppointment()
    const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<IAppointmentPayment>({
        mode: 'onChange',
        defaultValues: {
            payment: 'Каспи',
            phoneNumber: ''
        }
    })

    const phoneNumber = watch('phoneNumber')

    // Проверяем валидность номера телефона
    const isPhoneValid = phoneNumber && phoneNumber.match(/^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/) && phoneNumber.replace(/\D/g, '').length === 11
    const { isBooking, error: bookingError, bookAppointment } = useAppointments()
    const { loading: analysisLoading, error: analysisError, fetchLatestAnalysis } = useLatestAnalysis()
    const [isProcessing, setIsProcessing] = useState(false)

    // Проверяем, что все необходимые данные заполнены
    useEffect(() => {
        if (!doctor || !format.time || !format.slotId) {
            router.push('/patient/my-appointments/make')
        }
    }, [doctor, format, router])

    const onSubmit = async (data: IAppointmentPayment) => {
        try {
            setIsProcessing(true)

            if (!format.slotId) {
                throw new Error('Не выбран временной слот');
            }

            // Определяем тип приема
            const appointmentType = format.format === 'Онлайн' ? 'online' : 'offline';
            const patientNotes = format.patient_notes || '';

            // Используем anketa_id из формата (может быть null)
            const anketaId = format.anketa_id || null

            const success = await bookAppointment(format.slotId, {
                appointmentType: appointmentType as 'online' | 'offline',
                patientNotes: patientNotes,
                anketaId: anketaId
            });

            if (!success) {
                throw new Error(bookingError || 'Ошибка при бронировании записи');
            }

            // Сохраняем данные оплаты в контекст
            setPayment({
                payment: 'Каспи',
                phoneNumber: data.phoneNumber
            })

            // Устанавливаем результат с сгенерированным ID
            const realAppointmentId = `APP-${Date.now()}`;
            setResult({
                result: 'success',
                appointmentId: realAppointmentId,
                link: generateMeetingLink(realAppointmentId)
            })

            router.replace('/patient/my-appointments/make/result')
        } catch (error: any) {
            const errorMessage = error.message || bookingError || 'Ошибка при обработке платежа. Попробуйте еще раз.';
            alert(errorMessage);

            // Устанавливаем результат как ошибку
            setResult({
                result: 'error',
                appointmentId: '',
                link: undefined
            })
        } finally {
            setIsProcessing(false)
        }
    }

    // Функция для форматирования номера телефона +7 (707) 830-63-35
    const formatPhoneNumber = (value: string) => {
        // Удаляем все символы кроме цифр
        const numbers = value.replace(/\D/g, '');

        // Начинаем с +7
        let formatted = '+7';

        // Добавляем первые 3 цифры в скобках (707)
        if (numbers.length > 1) {
            formatted += ' (' + numbers.slice(1, 4);
        }

        // Закрываем скобки и добавляем пробел
        if (numbers.length >= 4) {
            formatted += ')';
        }

        // Добавляем следующие 3 цифры с пробелом
        if (numbers.length >= 4) {
            formatted += ' ' + numbers.slice(4, 7);
        }

        // Добавляем следующие 2 цифры с дефисом
        if (numbers.length >= 7) {
            formatted += '-' + numbers.slice(7, 9);
        }

        // Добавляем последние 2 цифры с дефисом
        if (numbers.length >= 9) {
            formatted += '-' + numbers.slice(9, 11);
        }

        return formatted;
    }

    // Функция для генерации ссылки на встречу
    const generateMeetingLink = (appointmentId: string) => {
        if (format.format !== 'Онлайн') return undefined;
        return `https://clintech-meet.com/room/${appointmentId}?doctor=${doctor?.user_id}&patient=current`;
    }

    // Рассчитываем стоимость
    const consultationPrice = doctor?.price || 15000; // Фикс цена если не указана
    const platformFee = Math.round(consultationPrice * 0.03); // 3% комиссия платформы
    const totalPrice = consultationPrice + platformFee;

    return (
        <PagesLayout title="Оплата приема" description="Дистанционная оплата через Каспи" isBackButton={true}>
            <PageStateWrapper
                loading={isProcessing || isBooking || analysisLoading}
                error={bookingError || analysisError}
                loadingText="Обработка платежа..."
                isEmpty={!doctor || !format.time || !format.slotId}
                emptyTitle="Данные для оплаты не найдены"
                emptyDescription="Пожалуйста, выберите врача и время для записи"
                centerContent={true}
                className="container"
            >
                <div className='container grid lg:grid-cols-3 gap-4 pb-10'>
                    <div className='col-span-3 lg:col-span-1 border p-4 space-y-4 h-fit bg-white rounded-xl'>
                        <div className='flex flex-col xs:flex-row lg:flex-col 2xl:flex-row 2xl:items-center gap-x-4 gap-y-2'>
                            {doctor && doctor.avatar_url ? (
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

                            <div className='space-y-2'>
                                <h1>
                                    <p className='text-xl font-bold'>{doctor ? `${doctor.first_name} ${doctor.middle_name || ''} ${doctor.last_name}` : ''}</p>
                                    <p className='text-xl font-bold text-blue-500'>{doctor ? doctor.roles.join(', ') : ''}</p>
                                </h1>
                                <div className="space-y-1 text-gray-600 grid grid-cols-2 md:grid-cols-1 gap-2">
                                    <div className="flex items-center gap-2">
                                        <FaRegCalendarAlt size={18} />
                                        <span className='text-md'>{format.date || 'не выбрано'}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <FaRegClock size={18} />
                                        <span className='text-md'>{format.time || 'не выбрано'}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <FaVideo size={18} />
                                        <span className='text-md'>{format.format || 'не выбрано'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className='pt-4 border-t my-4'>
                            <p className='text-lg font-semibold'>
                                {format.duration_minutes || 30} минут консультация
                            </p>
                            <p className='text-lg text-gray-600'>
                                {format.slotTitle || (format.format === 'Онлайн' ? 'Видеоконсультация' : 'Очная консультация')}
                            </p>
                            {format.format && (
                                <p className='text-lg text-blue-600 mt-1'>
                                    Формат: {format.format}
                                </p>
                            )}
                        </div>

                        <div className='border-t pt-4 space-y-2'>
                            <div className='flex justify-between'>
                                <span className='text-gray-600 text-lg'>Консультация:</span>
                                <span className='text-lg'>{consultationPrice.toLocaleString()} тг</span>
                            </div>
                            <div className='flex justify-between'>
                                <span className='text-gray-600 text-lg'>Комиссия платформы:</span>
                                <span className='text-lg'>{platformFee.toLocaleString()} тг</span>
                            </div>
                            <div className='flex justify-between font-bold text-lg border-t pt-2'>
                                <span className='text-lg'>Итого:</span>
                                <span className='text-blue-600'>{totalPrice.toLocaleString()} тг</span>
                            </div>
                        </div>
                    </div>

                    <div className='col-span-3 md:col-span-2 border p-4 space-y-6 bg-white rounded-xl'>
                        <h1 className='text-2xl font-bold'>Оплатите за прием</h1>

                        {/* Способ оплаты - только Каспи */}
                        <div className='space-y-3'>
                            <p className='text-lg font-semibold'>Способ оплаты</p>
                            <div className='bg-blue-100 border-2 border-blue-500 rounded-lg p-6'>
                                <div className='flex items-center gap-4'>
                                    <div className='bg-red-600 rounded-lg p-3'>
                                        <FaMobileAlt size={32} className='text-white' />
                                    </div>
                                    <div>
                                        <h3 className='text-xl font-bold text-blue-800'>Дистанционная оплата Каспи</h3>
                                        <p className='text-blue-600'>Быстро и безопасно через мобильное приложение</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Форма ввода номера телефона */}
                        <form
                            onSubmit={(e) => {
                                e.preventDefault() // Предотвращаем отправку по Enter - используем только свайп
                            }}
                            className='space-y-6'
                        >
                            <div className='space-y-4'>
                                <div>
                                    <MyInput
                                        label='Номер телефона для Каспи'
                                        placeholder='+7 (707) 830-63-35'
                                        required
                                        {...register('phoneNumber', {
                                            required: 'Введите номер телефона',
                                            pattern: {
                                                value: /^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/,
                                                message: 'Введите номер в формате +7 (707) 830-63-35'
                                            },
                                            validate: (value) => {
                                                const numbers = value.replace(/\D/g, '');
                                                if (numbers.length !== 11) {
                                                    return 'Номер телефона должен содержать 11 цифр';
                                                }
                                                if (!numbers.startsWith('7')) {
                                                    return 'Номер должен начинаться с +7';
                                                }
                                                return true;
                                            }
                                        })}
                                        onChange={(e) => {
                                            const formatted = formatPhoneNumber(e.target.value);
                                            e.target.value = formatted;
                                            setValue('phoneNumber', formatted, {
                                                shouldValidate: true,
                                                shouldDirty: true
                                            });
                                        }}
                                        errors={errors.phoneNumber}
                                    />
                                    <p className='text-sm text-gray-500 mt-1'>
                                        Укажите номер телефона, привязанный к вашему аккаунту Kaspi Bank
                                    </p>
                                </div>
                            </div>

                            {/* Информация о процессе оплаты */}
                            <div className='bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-lg'>
                                <h4 className='font-semibold text-yellow-800 mb-2'>Как происходит оплата:</h4>
                                <ol className='text-sm text-yellow-700 space-y-1 list-decimal list-inside'>
                                    <li>Введите номер телефона, привязанный к вашему Kaspi Bank</li>
                                    <li>Чтобы получить оплату зажмите ползунок и пролистайте вправо</li>
                                    <li>Подтвердите платеж в приложении Kaspi Bank</li>
                                    <li>Запись будет подтверждена автоматически</li>
                                </ol>
                            </div>

                            {/* Безопасность */}
                            <div className='flex gap-4 items-start bg-green-50 p-4 rounded-lg'>
                                <Image className='hidden xs:block' src='/image/logo.png' alt='security' width={30} height={30} />
                                <div>
                                    <p className='font-bold text-lg text-green-800'>Ваш платеж безопасен</p>
                                    <p className='text-sm text-green-700'>
                                        Оплата происходит через защищенные каналы Kaspi Bank.
                                        Мы не имеем доступа к данным вашей карты.
                                    </p>
                                </div>
                            </div>

                            {/* Свайп-кнопка оплаты для мобилки, обычная кнопка для десктопа */}
                            <div className="block md:hidden">
                                <SwipeToPayButton
                                    amount={totalPrice}
                                    onSwipeComplete={handleSubmit(onSubmit)}
                                    disabled={!isPhoneValid}
                                    isProcessing={isProcessing}
                                    className=""
                                />
                            </div>
                            <div className="hidden md:block">
                                <MyButton
                                    className={`w-full py-2 text-lg text-white ${isPhoneValid ? 'bg-blue-700 hover:bg-blue-800' : 'bg-gray-400 cursor-not-allowed'}`}
                                    onClick={handleSubmit(onSubmit)}
                                    disabled={!isPhoneValid || isProcessing}
                                >
                                    {isProcessing ? 'Обработка...' : `Оплатить ${totalPrice.toLocaleString()} тг`}
                                </MyButton>
                            </div>
                        </form>
                    </div>
                </div>
            </PageStateWrapper>
        </PagesLayout>
    )
}