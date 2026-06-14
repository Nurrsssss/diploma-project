'use client'
import React, { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import PagesLayout from '@/components/layout/general/PagesLayout'
import NoContent from '@/components/ui/NoContent'
import { useAppointment } from '@/context/AppointmentContext'
import { useDoctors } from '@/hooks/doctor/useDoctors'
import { TDoctor } from '@/types/doctors'
import DoctorCard from '@/components/patient/appointments/make/DoctorCard'
import DoctorFilters, { DoctorFiltersState } from '@/components/patient/appointments/make/DoctorFilters'
import DoctorSearchStats, { defaultFiltersState } from '@/components/patient/appointments/make/DoctorSearchStats'
import PageStateWrapper from '@/components/ui/PageStateWrapper'
import { FaSearch, FaUserMd } from 'react-icons/fa'
import Pagination from '@/components/common/Pagination'

export default function MakeAppointmentPage() {
    const router = useRouter()
    const { setDoctor } = useAppointment()
    const { doctors, loading, error } = useDoctors()

    // Состояние для пагинации
    const [page, setPage] = useState<number>(1)
    const [doctorPerPage, setDoctorPerPage] = useState<number>(10)

    // Состояние для фильтрации
    const [filteredDoctors, setFilteredDoctors] = useState<TDoctor[]>([])
    const [filtersState, setFiltersState] = useState<DoctorFiltersState>(defaultFiltersState)

    // Обновляем отфильтрованных врачей при изменении основного списка
    useEffect(() => {
        if (doctors) {
            setFilteredDoctors(doctors)
        }
    }, [doctors])

    // Вычисляем индексы для пагинации (теперь на основе отфильтрованного списка)
    const indexOfLastDoctor = page * doctorPerPage
    const indexOfFirstDoctor = indexOfLastDoctor - doctorPerPage
    const currentDoctors = filteredDoctors?.slice(indexOfFirstDoctor, indexOfLastDoctor)
    const totalPages = Math.max(1, doctorPerPage > 0 ? Math.ceil((filteredDoctors?.length || 0) / doctorPerPage) : 1)

    // Корректируем номер страницы если необходимо
    useEffect(() => {
        if (page > totalPages) {
            setPage(totalPages)
        } else if (page < 1) {
            setPage(1)
        }
    }, [totalPages, page])

    // Сбрасываем страницу на первую при изменении фильтров
    useEffect(() => {
        setPage(1)
    }, [filteredDoctors])

    const proceedWithDoctor = useCallback((doctor: TDoctor) => {
        setDoctor(doctor)
        router.push('/patient/my-appointments/make/format')
    }, [setDoctor, router])

    const handleSelectDoctor = useCallback((doctor: TDoctor) => {
        // Убрали обязательную проверку анкет - можно записаться без анкеты
        // Просто продолжаем с выбранным врачом
        proceedWithDoctor(doctor)
    }, [proceedWithDoctor])

    const handleFiltersChange = useCallback((filtered: TDoctor[]) => {
        setFilteredDoctors(filtered)
    }, [])

    const handleFiltersStateChange = useCallback((filters: DoctorFiltersState) => {
        setFiltersState(filters)
    }, [])

    const handleClearFilter = useCallback((filterKey: keyof DoctorFiltersState) => {
        setFiltersState(prev => ({
            ...prev,
            [filterKey]: filterKey === 'sortBy' ? 'name' : filterKey === 'sortOrder' ? 'asc' : ''
        }))
    }, [])

    const handleClearAllFilters = useCallback(() => {
        setFiltersState(defaultFiltersState)
    }, [])

    return (
        <PagesLayout
            title="Выберите специалиста"
            description="Запишитесь на прием к квалифицированным специалистам здравоохранения"
            isBackButton={true}
        >
            <div className="container space-y-4">
                <PageStateWrapper
                    loading={loading}
                    error={error}
                    isEmpty={!doctors || doctors.length === 0}
                    emptyTitle="Список врачей пуст"
                    emptyDescription="В данный момент нет доступных врачей"
                    button="Вернуться назад"
                    buttonHref="/patient/my-appointments"
                    emptyIcon={<FaUserMd size={48} />}
                    onRetry={() => window.location.reload()}
                    loadingText="Загрузка врачей..."
                    centerContent={false}
                    className="container"
                >
                    {/* Фильтры поиска */}
                    <DoctorFilters
                        doctors={doctors}
                        filters={filtersState}
                        onFiltersChange={handleFiltersChange}
                        onFiltersStateChange={handleFiltersStateChange}
                    />

                    {/* Статистика поиска */}
                    <DoctorSearchStats
                        totalDoctors={doctors.length}
                        filteredDoctors={filteredDoctors.length}
                        filtersState={filtersState}
                        onClearFilter={handleClearFilter}
                        onClearAllFilters={handleClearAllFilters}
                    />

                    {/* Информация о результатах */}
                    <div className="flex justify-between items-center gap-2 text-sm text-gray-600">
                        <div>
                            Показано <span className="font-semibold">{currentDoctors?.length || 0}</span> из <span className="font-semibold">{filteredDoctors?.length || 0}</span> врачей
                        </div>
                        <div>
                            Страница {page} из {totalPages}
                        </div>
                    </div>

                    {/* Список врачей */}
                    <div className="space-y-4 pb-4">
                        {currentDoctors?.length > 0 ? (
                            currentDoctors.map((doctor) => (
                                <DoctorCard
                                    key={doctor.id}
                                    doctor={doctor}
                                    onSelect={handleSelectDoctor}
                                    isLoading={false}
                                />
                            ))
                        ) : filteredDoctors?.length === 0 && doctors?.length > 0 ? (
                            <NoContent
                                title="Врачи не найдены"
                                description="По вашему запросу врачи не найдены. Попробуйте изменить параметры поиска или фильтры"
                                icon={<FaSearch size={48} className='text-primary mb-4' />}
                            />
                        ) : null}
                    </div>

                    {/* Пагинация */}
                    {currentDoctors?.length > 0 && totalPages > 1 && (
                        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
                    )}
                </PageStateWrapper>
            </div>
        </PagesLayout >
    )
}
