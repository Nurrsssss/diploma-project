'use client'
import { TDoctor } from '@/types/doctors'
import React from 'react'
import { FaUserMd, FaGraduationCap, FaCertificate, FaCalendar, FaMapMarkerAlt } from 'react-icons/fa'
import PageStateWrapper from '@/components/ui/PageStateWrapper'

interface DoctorFullInfoProps {
    doctor: TDoctor | null
    loading?: boolean
}

export default function DoctorFullInfo({ doctor, loading }: DoctorFullInfoProps) {
    return (
        <PageStateWrapper
            loading={loading}
            loadingText="Загрузка данных врача"
            isEmpty={!doctor}
            emptyTitle="Нет данных о враче"
            emptyDescription="Информация о враче не найдена. Пожалуйста, попробуйте обновить страницу"
        >

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
                {/* Заголовок */}
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 sm:mb-6">Данные врача</h2>

                {/* Основная информация */}
                <div className="space-y-3 sm:space-y-4">
                    {/* ФИО */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 py-3 border-b border-gray-100">
                        <div className="flex items-center gap-3 min-w-0">
                            <FaUserMd className="text-gray-400 text-sm flex-shrink-0" />
                            <span className="text-gray-600 text-sm flex-shrink-0">ФИО:</span>
                        </div>
                        <span className="font-semibold text-gray-900 break-words pl-6 sm:pl-0">
                            {doctor?.last_name} {doctor?.first_name} {doctor?.middle_name || ''}
                        </span>
                    </div>

                    {/* Специализации */}
                    <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3 py-3 border-b border-gray-100">
                        <div className="flex items-start gap-3 min-w-0 flex-shrink-0">
                            <FaUserMd className="text-gray-400 text-sm flex-shrink-0 mt-0.5" />
                            <span className="text-gray-600 text-sm flex-shrink-0">Специализации:</span>
                        </div>
                        <div className="text-sm font-semibold text-gray-900 break-words pl-6 sm:pl-0 flex-1">
                            {doctor?.roles && doctor?.roles.length > 0 ? doctor?.roles.join(', ') : 'Не указано'}
                        </div>
                    </div>

                    {/* Описание */}
                    {doctor?.description && (
                        <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3 py-3 border-b border-gray-100">
                            <div className="flex items-start gap-3 min-w-0 flex-shrink-0">
                                <FaUserMd className="text-gray-400 text-sm flex-shrink-0 mt-0.5" />
                                <span className="text-gray-600 text-sm flex-shrink-0">Описание:</span>
                            </div>
                            <div className="text-sm font-semibold text-gray-900 break-words pl-6 sm:pl-0 flex-1">
                                {doctor?.description}
                            </div>
                        </div>
                    )}

                    {/* Цена */}
                    {doctor?.price && (
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 py-3 border-b border-gray-100">
                            <div className="flex items-center gap-3 min-w-0">
                                <FaCalendar className="text-gray-400 text-sm flex-shrink-0" />
                                <span className="text-gray-600 text-sm flex-shrink-0">Стоимость приема:</span>
                            </div>
                            <span className="font-semibold text-gray-900 break-words pl-6 sm:pl-0">
                                {doctor?.price} ₸
                            </span>
                        </div>
                    )}

                    {/* Образование */}
                    {doctor?.education && doctor?.education.length > 0 && (
                        <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3 py-3 border-b border-gray-100">
                            <div className="flex items-start gap-3 min-w-0 flex-shrink-0">
                                <FaGraduationCap className="text-gray-400 text-sm flex-shrink-0 mt-0.5" />
                                <span className="text-gray-600 text-sm flex-shrink-0">Образование:</span>
                            </div>
                            <div className="text-sm font-semibold text-gray-900 break-words pl-6 sm:pl-0 flex-1">
                                {doctor?.education.map((edu, index) => (
                                    <div key={index} className="mb-1 last:mb-0">
                                        <span className="mr-1 text-gray-600 text-sm flex-shrink-0">
                                            {index + 1}.
                                        </span>
                                        <span className="font-semibold text-gray-900 break-words pl-6 sm:pl-0 flex-1">
                                            {edu}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Сертификаты */}
                    {doctor?.certificates && doctor?.certificates.length > 0 && (
                        <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3 py-3 border-b border-gray-100">
                            <div className="flex items-start gap-3 min-w-0 flex-shrink-0">
                                <FaCertificate className="text-gray-400 text-sm flex-shrink-0 mt-0.5" />
                                <span className="text-gray-600 text-sm flex-shrink-0">Сертификаты:</span>
                            </div>
                            <div className="text-sm font-semibold text-gray-900 break-words pl-6 sm:pl-0 flex-1">
                                {doctor?.certificates.map((cert, index) => (
                                    <div key={index} className="mb-1 last:mb-0">
                                        <span className="mr-1 text-gray-600 text-sm flex-shrink-0">
                                            {index + 1}.
                                        </span>
                                        <span className="font-semibold text-gray-900 break-words pl-6 sm:pl-0 flex-1">
                                            {cert}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Контактная информация */}
                    {doctor?.contactInfo && (
                        <>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 py-3 border-b border-gray-100">
                                <div className="flex items-center gap-3 min-w-0">
                                    <FaMapMarkerAlt className="text-gray-400 text-sm flex-shrink-0" />
                                    <span className="text-gray-600 text-sm flex-shrink-0">Отделение:</span>
                                </div>
                                <span className="font-semibold text-gray-900 break-words pl-6 sm:pl-0">
                                    {doctor?.contactInfo.department || 'Не указано'}
                                </span>
                            </div>

                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 py-3 border-b border-gray-100">
                                <div className="flex items-center gap-3 min-w-0">
                                    <FaMapMarkerAlt className="text-gray-400 text-sm flex-shrink-0" />
                                    <span className="text-gray-600 text-sm flex-shrink-0">Адрес:</span>
                                </div>
                                <span className="font-semibold text-gray-900 break-words pl-6 sm:pl-0">
                                    {doctor?.contactInfo.address || 'Не указано'}
                                </span>
                            </div>
                        </>
                    )}

                    {/* Расписание */}
                    {doctor?.schedule && doctor?.schedule.length > 0 && (
                        <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3 py-3 border-b border-gray-100">
                            <div className="flex items-start gap-3 min-w-0 flex-shrink-0">
                                <FaCalendar className="text-gray-400 text-sm flex-shrink-0 mt-0.5" />
                                <span className="text-gray-600 text-sm flex-shrink-0">Расписание:</span>
                            </div>
                            <div className="text-sm font-semibold text-gray-900 break-words pl-6 sm:pl-0 flex-1">
                                {doctor?.schedule.map((sch, index) => (
                                    <div key={index} className="mb-1 last:mb-0">
                                        {sch.day}: {sch.hours}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </PageStateWrapper>
    )
} 