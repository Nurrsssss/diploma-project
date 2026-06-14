'use client'
import React, { useState, useMemo, useRef, useEffect } from 'react'
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa'

interface DateRange {
    start_date: string
    end_date: string
}

interface DateRangePickerProps {
    value?: DateRange
    onChange: (range: DateRange) => void
    label?: string
    minDate?: string // YYYY-MM-DD format
    errors?: {
        start_date?: { message?: string }
        end_date?: { message?: string }
    }
}

export default function DateRangePicker({
    value,
    onChange,
    label = "Выберите период",
    minDate,
    errors
}: DateRangePickerProps) {
    const [currentMonth, setCurrentMonth] = useState(() => {
        const today = new Date()
        return new Date(today.getFullYear(), today.getMonth(), 1)
    })

    const [isOpen, setIsOpen] = useState(false)
    const [selectingStart, setSelectingStart] = useState(true)
    const calendarRef = useRef<HTMLDivElement>(null)

    // Закрытие календаря при клике вне его области
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }

        const handleEscapeKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsOpen(false)
            }
        }

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside)
            document.addEventListener('keydown', handleEscapeKey)
            return () => {
                document.removeEventListener('mousedown', handleClickOutside)
                document.removeEventListener('keydown', handleEscapeKey)
            }
        }
    }, [isOpen])

    // Генерируем календарь на текущий месяц
    const calendarDays = useMemo(() => {
        const year = currentMonth.getFullYear()
        const month = currentMonth.getMonth()

        // Первый день месяца и последний
        const firstDay = new Date(year, month, 1)
        const lastDay = new Date(year, month + 1, 0)

        // Начинаем с понедельника (1) вместо воскресенья (0)
        const startDate = new Date(firstDay)
        const startDayOfWeek = firstDay.getDay()
        const daysToSubtract = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1
        startDate.setDate(firstDay.getDate() - daysToSubtract)

        const days = []
        const current = new Date(startDate)

        // Генерируем 42 дня (6 недель × 7 дней)
        for (let i = 0; i < 42; i++) {
            days.push(new Date(current))
            current.setDate(current.getDate() + 1)
        }

        return days
    }, [currentMonth])

    // Форматирование даты в YYYY-MM-DD (без учета временных зон)
    const formatDate = (date: Date): string => {
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        return `${year}-${month}-${day}`
    }

    // Парсинг даты из строки YYYY-MM-DD (без учета временных зон)
    const parseDate = (dateStr: string): Date => {
        const [year, month, day] = dateStr.split('-').map(Number)
        return new Date(year, month - 1, day)
    }

    // Проверка, находится ли дата в диапазоне
    const isInRange = (date: Date): boolean => {
        if (!value?.start_date || !value?.end_date) return false

        const dateStr = formatDate(date)
        return dateStr >= value.start_date && dateStr <= value.end_date
    }

    // Проверка, является ли дата началом или концом диапазона
    const isRangeStart = (date: Date): boolean => {
        return value?.start_date === formatDate(date)
    }

    const isRangeEnd = (date: Date): boolean => {
        return value?.end_date === formatDate(date)
    }

    // Проверка, можно ли выбрать дату
    const canSelectDate = (date: Date): boolean => {
        if (minDate) {
            return formatDate(date) >= minDate
        }
        return true
    }

    // Обработка клика по дате
    const handleDateClick = (date: Date) => {
        if (!canSelectDate(date)) return

        const dateStr = formatDate(date)

        if (selectingStart || !value?.start_date) {
            // Выбираем начальную дату
            onChange({
                start_date: dateStr,
                end_date: value?.end_date || dateStr
            })
            setSelectingStart(false)
        } else {
            // Выбираем конечную дату
            const startDate = value.start_date

            if (dateStr < startDate) {
                // Если выбрана дата раньше начальной, меняем местами
                onChange({
                    start_date: dateStr,
                    end_date: startDate
                })
            } else {
                onChange({
                    start_date: startDate,
                    end_date: dateStr
                })
            }
            setSelectingStart(true)
            setIsOpen(false)
        }
    }

    // Навигация по месяцам
    const goToPrevMonth = () => {
        setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
    }

    const goToNextMonth = () => {
        setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
    }

    // Очистка выбора
    const clearSelection = () => {
        const today = new Date()
        const todayFormatted = formatDate(today)
        onChange({
            start_date: todayFormatted,
            end_date: todayFormatted
        })
        setSelectingStart(true)
    }

    // Форматирование для отображения
    const formatDisplayDate = (dateStr: string): string => {
        const date = parseDate(dateStr)
        return date.toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        })
    }

    const monthNames = [
        'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
        'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
    ]

    const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

    return (
        <div className="relative" ref={calendarRef}>
            {label && (
                <label className="block mb-2 text-xl text-[#374151] font-medium">
                    {label}
                </label>
            )}

            {/* Поле ввода */}
            <div
                className="mt-2 w-full px-4 py-2 text-[16px] border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-darkPurple cursor-pointer bg-white"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex items-center justify-between">
                    <span className={`${value?.start_date ? 'text-gray-900' : 'text-[#CCCCCC]'}`}>
                        {value?.start_date && value?.end_date ? (
                            `${formatDisplayDate(value.start_date)} — ${formatDisplayDate(value.end_date)}`
                        ) : (
                            'Выберите период'
                        )}
                    </span>
                    <FaChevronRight className={`transform transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                </div>
            </div>

            {/* Компактный календарь */}
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 bg-black bg-opacity-30 z-40"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Компактное модальное окно календаря */}
                    <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm transform transition-all duration-200 scale-100 opacity-100">
                            {/* Хедер */}
                            <div className="p-4 border-b border-gray-200">
                                <div className="flex items-center justify-between mb-2">
                                    <h2 className="text-lg font-semibold">Выберите период</h2>
                                    <button
                                        type="button"
                                        onClick={() => setIsOpen(false)}
                                        className="p-1 hover:bg-gray-100 rounded-lg"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                                {/* Показываем текущий выбор */}
                                {value?.start_date && value?.end_date && (
                                    <div className="text-xs text-gray-600 bg-blue-50 px-2 py-1 rounded">
                                        {formatDisplayDate(value.start_date)} — {formatDisplayDate(value.end_date)}
                                    </div>
                                )}
                            </div>

                            {/* Содержимое календаря */}
                            <div className="p-4">
                                {/* Хедер календаря */}
                                <div className="flex items-center justify-between mb-3">
                                    <button
                                        type="button"
                                        onClick={goToPrevMonth}
                                        className="p-1 hover:bg-gray-100 rounded"
                                    >
                                        <FaChevronLeft className="w-4 h-4" />
                                    </button>

                                    <h3 className="text-sm font-semibold">
                                        {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                                    </h3>

                                    <button
                                        type="button"
                                        onClick={goToNextMonth}
                                        className="p-1 hover:bg-gray-100 rounded"
                                    >
                                        <FaChevronRight className="w-4 h-4" />
                                    </button>
                                </div>

                                {/* Дни недели */}
                                <div className="grid grid-cols-7 gap-1 mb-2">
                                    {dayNames.map(day => (
                                        <div key={day} className="text-center text-xs font-medium text-gray-500 py-1">
                                            {day}
                                        </div>
                                    ))}
                                </div>

                                {/* Календарная сетка */}
                                <div className="grid grid-cols-7 gap-1 mb-3">
                                    {calendarDays.map((date, index) => {
                                        const isCurrentMonth = date.getMonth() === currentMonth.getMonth()
                                        const today = new Date()
                                        const isToday = formatDate(date) === formatDate(today)
                                        const isDisabled = !canSelectDate(date)
                                        const inRange = isInRange(date)
                                        const isStart = isRangeStart(date)
                                        const isEnd = isRangeEnd(date)

                                        return (
                                            <button
                                                key={index}
                                                type="button"
                                                onClick={() => handleDateClick(date)}
                                                disabled={isDisabled}
                                                className={`
                                                    relative h-7 text-xs rounded transition-colors
                                                    ${!isCurrentMonth ? 'text-gray-300' : ''}
                                                    ${isDisabled ? 'text-gray-300 cursor-not-allowed' : 'hover:bg-blue-100'}
                                                    ${isToday ? 'font-bold' : ''}
                                                    ${inRange ? 'bg-blue-100' : ''}
                                                    ${(isStart || isEnd) ? 'bg-blue-500 text-white hover:bg-blue-600' : ''}
                                                `}
                                            >
                                                {date.getDate()}
                                            </button>
                                        )
                                    })}
                                </div>

                                {/* Подсказка и кнопки */}
                                <div className="pt-3 border-t border-gray-200">
                                    <p className="text-xs text-gray-600 mb-3">
                                        {selectingStart && !value?.start_date ?
                                            'Выберите дату начала' :
                                            selectingStart && value?.start_date && !value?.end_date ?
                                                'Выберите дату окончания' :
                                                'Нажмите для изменения диапазона'
                                        }
                                    </p>

                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={clearSelection}
                                            className="flex-1 px-3 py-2 text-xs text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                                        >
                                            Очистить
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setIsOpen(false)}
                                            className="flex-1 px-3 py-2 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                                        >
                                            Готово
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* Ошибки */}
            {(errors?.start_date?.message || errors?.end_date?.message) && (
                <div className="mt-1">
                    {errors?.start_date?.message && (
                        <span className="text-red-500 text-sm block">{errors.start_date.message}</span>
                    )}
                    {errors?.end_date?.message && (
                        <span className="text-red-500 text-sm block">{errors.end_date.message}</span>
                    )}
                </div>
            )}
        </div>
    )
} 