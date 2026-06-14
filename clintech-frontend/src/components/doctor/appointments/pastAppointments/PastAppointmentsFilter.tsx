'use client'
import { useState } from 'react'
import MySelect from '@/components/ui/MySelect'
import DatePicker from '@/components/ui/DatePicker'
import { FaFilter, FaSearch } from 'react-icons/fa'
import MyButton from '@/components/ui/MyButton'
import MyInput from '@/components/ui/MyInput'
import { TAppointment } from '@/types/appointments'
import { TPatient } from '@/types/patient'

interface PastAppointmentsFilterProps {
    // Состояния поиска и фильтров
    searchText: string
    setSearchText: (value: string) => void
    statusFilter: string
    setStatusFilter: (value: string) => void
    dateRange: { from: string; to: string }
    setDateRange: (range: { from: string; to: string }) => void

    // Данные для отображения
    pastAppointments: TAppointment[]
    patientsCache: Record<string, TPatient>
    loadingPatients: boolean

    // Функции
    getDefaultDateRange: () => { from: string; to: string }
    handleDateRangeChange: (field: 'from' | 'to', value: string) => void

    // Опции для селекта
    statusOptions: Array<{ value: string; label: string }>
}

export default function PastAppointmentsFilter({
    searchText,
    setSearchText,
    statusFilter,
    setStatusFilter,
    dateRange,
    setDateRange,
    pastAppointments,
    patientsCache,
    loadingPatients,
    getDefaultDateRange,
    handleDateRangeChange,
    statusOptions
}: PastAppointmentsFilterProps) {
    const [isFilterOpen, setIsFilterOpen] = useState<boolean>(false)

    return (
        <>
            <div className="flex flex-row items-center justify-between mb-4 gap-1">
                <div className="flex items-center gap-2">
                    <FaSearch className="text-primary" />
                    <h3 className="text-lg font-semibold">Поиск и фильтры</h3>
                    {loadingPatients && (
                        <span className="text-sm text-gray-500">(загрузка данных пациентов...)</span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <MyButton
                        onClick={() => setIsFilterOpen(!isFilterOpen)}
                        className="flex items-center gap-1 text-sm px-3 py-1 bg-primary/10 text-primary hover:bg-primary/20"
                    >
                        <FaFilter className="mr-1" />
                        <span className="hidden sm:block">
                            {isFilterOpen ? 'Скрыть' : 'Показать'} фильтры
                        </span>
                    </MyButton>
                </div>
            </div>

            {/* ✅ Поле поиска */}
            <div className="mb-4">
                <MyInput
                    placeholder="Поиск по имени пациента, теме приема, телефону, email..."
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    className="w-full"
                />
                {searchText && !loadingPatients && (
                    <p className="text-xs text-gray-500 mt-1">
                        Поиск среди {Object.keys(patientsCache).length} загруженных пациентов
                    </p>
                )}
            </div>

            {isFilterOpen && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* Период от */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Период от:
                        </label>
                        <DatePicker
                            value={dateRange.from}
                            onChange={(date) => handleDateRangeChange('from', date)}
                            placeholder="Выберите дату"
                        />
                    </div>

                    {/* Период до */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Период до:
                        </label>
                        <DatePicker
                            value={dateRange.to}
                            onChange={(date) => handleDateRangeChange('to', date)}
                            placeholder="Выберите дату"
                            maxDate={new Date().toLocaleDateString('en-CA')}
                        />
                    </div>

                    {/* Фильтр по статусу */}
                    <div>
                        <MySelect
                            label="Статус"
                            options={statusOptions}
                            value={statusFilter}
                            onChange={(value) => setStatusFilter(value as string)}
                            placeholder="Выберите статус"
                        />
                    </div>

                    {/* Кнопка сброса */}
                    <div className="flex items-end">
                        <MyButton
                            onClick={() => {
                                const defaultRange = getDefaultDateRange()
                                setDateRange(defaultRange)
                                setStatusFilter('all')
                                setSearchText('')
                            }}
                            className="w-full border bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-50"
                        >
                            Сбросить
                        </MyButton>
                    </div>
                </div>
            )}

            <div className="mt-3 text-sm text-gray-600">
                Найдено приемов: <span className="font-medium">{pastAppointments.length}</span>
                {searchText.trim() && (
                    <span className="text-blue-600 ml-2">
                        (по запросу "{searchText}")
                    </span>
                )}
            </div>
        </>
    )
}
