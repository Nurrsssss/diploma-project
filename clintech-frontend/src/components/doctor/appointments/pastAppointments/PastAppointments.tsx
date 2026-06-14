'use client'
import React, { useState, useEffect, useMemo } from 'react'
import NoContent from '@/components/ui/NoContent'
import Pagination from '@/components/common/Pagination'
import { useAppointments } from '@/hooks/appointment/useAppointments'
import { getActualSlotStatus } from '@/utils/appointments'

import { usePatientCache } from '@/hooks/patient/usePatientsCache'
import PastAppointmentsFilter from './PastAppointmentsFilter'
import PageStateWrapper from '@/components/ui/PageStateWrapper'
import { PastAppointmentCard } from './PastAppointmentsCard'


export default function PastAppointments() {
    const [currentPage, setCurrentPage] = useState(1)
    const [statusFilter, setStatusFilter] = useState<string>('all')
    const [searchText, setSearchText] = useState<string>('')

    // Вычисляем значения по умолчанию
    const getDefaultDateRange = () => {
        const today = new Date().toLocaleDateString('en-CA')
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
        return {
            from: thirtyDaysAgo.toLocaleDateString('en-CA'),
            to: today
        }
    }

    const [dateRange, setDateRange] = useState<{ from: string; to: string }>(getDefaultDateRange())
    // Загружаем все приемы без фильтрации (всю фильтрацию делаем на клиенте)
    const { appointments, loading, error } = useAppointments()
    // ✅ Кэшируем данные пациентов для поиска по именам
    const { patientsCache, loadingPatients } = usePatientCache(appointments)

    // Фильтруем только прошедшие приемы с пациентами (не показываем пустые слоты)
    const pastAppointments = useMemo(() => {
        const now = new Date()
        const filtered = appointments.filter(appointment => {
            const endTime = new Date(appointment.end_time)

            // 1. Показываем только приемы которые были с пациентами (исключаем available слоты)
            const hadPatient = appointment.status !== 'available'
            if (!hadPatient) return false

            // 2. Показываем только прошедшие приемы
            if (endTime >= now) return false

            // 3. Фильтруем по диапазону дат - улучшенная логика
            const appointmentDateStr = appointment.start_time.split('T')[0]

            if (dateRange.from && appointmentDateStr < dateRange.from) {
                return false
            }

            if (dateRange.to && appointmentDateStr > dateRange.to) {
                return false
            }

            // 4. Фильтруем по статусу (если задан конкретный)
            if (statusFilter !== 'all') {
                const actualStatus = getActualSlotStatus(appointment)
                if (actualStatus !== statusFilter) return false
            }

            // 5. ✅ Фильтруем по поисковому запросу (по имени пациента, теме приема и др.)
            if (searchText.trim()) {
                const search = searchText.toLowerCase().trim()

                // Поиск по теме приема
                const titleMatch = appointment.title?.toLowerCase().includes(search) || false

                // Поиск по ID пациента (для случаев когда знают ID)
                const patientIdMatch = appointment.patient_id?.toLowerCase().includes(search) || false

                // Поиск по заметкам пациента
                const patientNotesMatch = appointment.patient_notes?.toLowerCase().includes(search) || false

                // Поиск по заметкам врача
                const doctorNotesMatch = appointment.doctor_notes?.toLowerCase().includes(search) || false

                // ✅ Поиск по имени пациента из кэша
                let patientNameFromCacheMatch = false
                if (appointment.patient_id && patientsCache[appointment.patient_id]) {
                    const patient = patientsCache[appointment.patient_id]
                    const fullName = `${patient.first_name || ''} ${patient.middle_name || ''} ${patient.last_name || ''}`.toLowerCase()
                    const phone = patient.phone?.toLowerCase() || ''
                    const email = patient.email?.toLowerCase() || ''

                    patientNameFromCacheMatch = fullName.includes(search) || phone.includes(search) || email.includes(search)
                }

                if (!titleMatch && !patientIdMatch && !patientNotesMatch && !doctorNotesMatch && !patientNameFromCacheMatch) {
                    return false
                }
            }

            return true
        }).sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime()) // Сортируем по убыванию даты

        return filtered;
    }, [appointments, dateRange, statusFilter, searchText, patientsCache])

    // Пагинация
    const itemsPerPage = 10
    const totalPages = Math.ceil(pastAppointments.length / itemsPerPage)
    const paginatedAppointments = pastAppointments.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    )

    useEffect(() => {
        setCurrentPage(1) // Сбрасываем на первую страницу при изменении фильтров
    }, [statusFilter, dateRange, searchText])

    const statusOptions = [
        { value: 'all', label: 'Все статусы' },
        { value: 'completed', label: 'Завершенные' },
        { value: 'cancelled', label: 'Отмененные' }
    ]

    const handleDateRangeChange = (field: 'from' | 'to', value: string) => {
        setDateRange(prev => ({ ...prev, [field]: value }))
    }

    return (
        <PageStateWrapper
            loading={loading}
            error={error}
            loadingText='Загрузка прошедших приемов...'
            retryText='Попробовать снова'
            emptyTitle='В выбранном периоде нет прошедших приемов с пациентами. Попробуйте изменить фильтры или период.'
        >
            <div className="space-y-6">
                {/* Фильтры */}
                <div className="bg-white rounded-lg p-4">
                    <h2 className="text-xl font-bold mb-2">Прошедшие приемы</h2>
                    <p className="text-gray-600 text-sm mb-4">Показываются приемы с пациентами за выбранный период. По умолчанию - последние 30 дней.</p>

                    <PastAppointmentsFilter
                        searchText={searchText}
                        setSearchText={setSearchText}
                        statusFilter={statusFilter}
                        setStatusFilter={setStatusFilter}
                        dateRange={dateRange}
                        setDateRange={setDateRange}
                        pastAppointments={pastAppointments}
                        patientsCache={patientsCache}
                        loadingPatients={loadingPatients}
                        getDefaultDateRange={getDefaultDateRange}
                        handleDateRangeChange={handleDateRangeChange}
                        statusOptions={statusOptions}
                    />
                </div>

                {/* Список приемов */}
                {paginatedAppointments.length > 0 ? (
                    <div className="space-y-4">
                        <h2 className="text-2xl font-bold">Список прошедших приемов</h2>
                        {paginatedAppointments.map((appointment) => (
                            <PastAppointmentCard
                                key={appointment.id}
                                appointment={appointment}
                            />
                        ))}
                    </div>
                ) : (
                    <NoContent
                        title={searchText.trim() ? "Приемы не найдены" : "Прошедшие приемы не найдены"}
                        description={
                            searchText.trim()
                                ? `По запросу "${searchText}" ничего не найдено. Попробуйте изменить поисковый запрос.`
                                : "В выбранном периоде нет прошедших приемов с пациентами. Попробуйте изменить фильтры или период."
                        }
                    />

                )
                }

                {/* Пагинация */}
                {
                    totalPages > 1 && (
                        <Pagination
                            page={currentPage}
                            totalPages={totalPages}
                            onPageChange={setCurrentPage}
                        />
                    )
                }
            </div >
        </PageStateWrapper >
    )
} 