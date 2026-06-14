'use client'
import MyButton from '@/components/ui/MyButton'
import React from 'react'
import { FaPrint, FaCalendar } from 'react-icons/fa'
import { MdVideocam } from 'react-icons/md'
import Image from 'next/image'
import Link from 'next/link'
import PagesLayout from '@/components/layout/general/PagesLayout'
import { useRouter } from 'next/navigation'
import { useAppointment } from '@/context/AppointmentContext'
import NoContent from '@/components/ui/NoContent'
import { UserIcon } from 'lucide-react'


export default function ResultPage() {
    const router = useRouter()
    const { doctor, format, payment, result } = useAppointment()

    // Берем продолжительность консультации из данных слота
    const consultationDuration = format.duration_minutes || 30;

    // Если нет результата или ошибка, показываем соответствующее сообщение
    if (!result.result) {
        return (
            <PagesLayout>
                <div className='container bg-white rounded-xl p-4 !py-4 shadow-xl'>
                    <div className='text-center space-y-4'>
                        <NoContent title='Результат не найден' description='Перейдите к записи на прием' />
                        <MyButton
                            className='mx-auto bg-primary hover:bg-primary/90 text-white'
                            onClick={() => router.push('/patient/my-appointments/make')}
                        >
                            Записаться на прием
                        </MyButton>
                    </div>
                </div>
            </PagesLayout>
        )
    } 

    if (result.result === 'error') {
        return (
            <PagesLayout>
                <div className='container bg-white rounded-xl p-4 !py-4 shadow-xl'>
                    <div className='text-center space-y-4'>
                        <NoContent
                            title='Ошибка при бронировании'
                            description='К сожалению, произошла ошибка при обработке вашего платежа. Попробуйте еще раз.'
                        />
                        <div className='flex gap-3 justify-center'>
                            <MyButton
                                className='bg-primary hover:bg-primary/90 text-white'
                                onClick={() => router.back()}
                            >
                                Попробовать снова
                            </MyButton>
                            <MyButton
                                className='border border-primary text-primary'
                                onClick={() => router.push('/patient/my-appointments/make')}
                            >
                                Выбрать другое время
                            </MyButton>
                        </div>
                    </div>
                </div>
            </PagesLayout>
        )
    }

    return (
        <PagesLayout>
            <div className='container bg-white rounded-xl p-4 !py-4 shadow-xl'>
                <div className='text-center space-y-2 border-b border-gray-200 pb-4'>
                    {
                        result.result === 'success' ? (
                            <>
                                <h1 className='text-2xl lg:text-3xl font-bold'>Ваша оплата успешно прошла</h1>
                                <div className='p-4 xl:p-8'>
                                    <div className='flex flex-col md:flex-row md:items-center justify-between gap-y-2'>
                                        <div className='xs:flex items-center gap-4'>
                                            {doctor?.avatar_url ? (
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
                                            <h1 className='flex flex-col justify-center'>
                                                <p className='text-center xs:text-start text-lg lg:text-xl font-bold'>{doctor?.first_name} {doctor?.middle_name || ''} {doctor?.last_name}</p>
                                                <p className='text-center xs:text-start text-lg lg:text-xl font-bold text-blue-500'>{doctor?.roles.join(', ')}</p>
                                                <MyButton className='md:hidden w-fit mx-auto rounded-2xl text-md bg-blue-500/40 text-blue-800'>
                                                    предостоящий прием
                                                </MyButton>
                                            </h1>
                                        </div>
                                        <MyButton className='hidden md:flex items-center gap-2 rounded-2xl text-md bg-blue-500/40 text-blue-800 font-semibold'>
                                            предостоящий прием
                                        </MyButton>
                                    </div>

                                    <div className="bg-white lg my-4">
                                        <div className="grid grid-cols-2 text-sm md:text-base xl:grid-cols-4 gap-2 md:gap-4 lg:gap-6 mb-6">
                                            <div className="flex items-center gap-2 text-gray-700">
                                                <span className='font-semibold'>Дата:</span>
                                                <span>{format.date ? new Date(format.date).toLocaleDateString('ru-RU', {
                                                    year: 'numeric',
                                                    month: 'long',
                                                    day: 'numeric'
                                                }) : 'Дата уточняется'}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-gray-700">
                                                <span className='font-semibold'>Время:</span>
                                                <span>{format.time} ({consultationDuration} мин)</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-gray-700">
                                                <span className='font-semibold'>Формат:</span>
                                                <span>{format.format === 'Онлайн' ? "Онлайн" : "В клинике"}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-gray-700">
                                                <span className='font-semibold'>Способ оплаты:</span>
                                                <span>{payment.payment}</span>
                                            </div>
                                        </div>

                                        {
                                            format.format === 'Онлайн' ? (
                                                <>
                                                    <div className="mb-1 text-lg font-semibold flex items-center gap-2">
                                                        <span>Ссылка на онлайн прием:</span>
                                                    </div>
                                                    <div className="bg-blue-50 border border-blue-300 rounded px-3 py-2 break-all">
                                                        {result.link ? (
                                                            <Link
                                                                href={result.link}
                                                                className="text-blue-600 underline text-lg"
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                            >
                                                                {result.link}
                                                            </Link>
                                                        ) : (
                                                            <p className='text-gray-500'>Ссылка будет отправлена за 15 минут до приема</p>
                                                        )}
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    <div className="bg-blue-50 border border-blue-300 rounded px-3 py-2 break-all">
                                                        <p className='text-center'>Ждем вас в клинике. Убедительная <br /> просьба, не опаздывать</p>
                                                    </div>
                                                </>
                                            )}
                                    </div>

                                    <div className='md:w-fit flex flex-col md:flex-row py-2 gap-2 md:mx-auto'>
                                        {format.format === 'Онлайн' && result.link && (
                                            <MyButton
                                                className='flex text-xl items-center gap-2 py-2 px-4  text-md xl:text-xl shadow- bg-gradient-to-r from-blue-500/70 to-purple-500/70 text-white'
                                                onClick={() => window.open(result.link, '_blank')}
                                            >
                                                <MdVideocam />
                                                Присоединиться к звонку
                                            </MyButton>
                                        )}

                                        <MyButton
                                            className='flex items-center text-xl gap-2 py-2 px-4  text-md xl:text-xl shadow- border border-blue-500 text-blue-500'
                                            onClick={() => {
                                                // Имитация скачивания чека
                                                const receiptData = {
                                                    appointmentId: result.appointmentId,
                                                    doctor: `${doctor?.first_name} ${doctor?.middle_name || ''} ${doctor?.last_name}`.trim(),
                                                    date: format.date ? new Date(format.date).toLocaleDateString('ru-RU', {
                                                        year: 'numeric',
                                                        month: 'long',
                                                        day: 'numeric'
                                                    }) : 'Дата уточняется',
                                                    time: format.time,
                                                    type: format.slotTitle || 'Консультация',
                                                    format: format.format,
                                                    paymentMethod: payment.payment
                                                };

                                                const dataStr = JSON.stringify(receiptData, null, 2);
                                                const dataBlob = new Blob([dataStr], { type: 'application/json' });
                                                const url = URL.createObjectURL(dataBlob);
                                                const link = document.createElement('a');
                                                link.href = url;
                                                link.download = `receipt-${result.appointmentId}.json`;
                                                link.click();
                                                URL.revokeObjectURL(url);
                                            }}
                                        >
                                            <FaPrint />
                                            скачать чек
                                        </MyButton>

                                        <MyButton className='flex text-xl items-center gap-2 py-2 px-4  text-md xl:text-xl shadow- bg-gradient-to-r from-blue-800 to-purple-800 text-white'
                                            onClick={() => router.push('/patient/my-appointments')}
                                        >
                                            <FaCalendar />
                                            Мои приемы
                                        </MyButton>
                                    </div>
                                </div>

                            </>
                        ) : (
                            <>
                                <NoContent title='К сожалению, произошла ошибка' description='Попробуйте записаться на прием позже' />
                                <MyButton className='flex items-center  mx-auto gap-2 py-2 px-4  text-md xl:text-xl shadow- bg-gradient-to-r from-blue-800 to-purple-800 text-white'
                                    onClick={() => router.push('/patient/my-appointments/make')}
                                >
                                    <FaCalendar />
                                    Записаться на прием
                                </MyButton>
                            </>
                        )
                    }



                </div>
            </div>
        </PagesLayout>
    )
}