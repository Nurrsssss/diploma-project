'use client'
import React, { useState, useRef, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'
import MyButton from './MyButton'

interface DatePickerProps {
    value?: string // YYYY-MM-DD format
    onChange: (date: string) => void
    label?: string
    minDate?: string
    maxDate?: string
    placeholder?: string
}

export default function DatePicker({
    value,
    onChange,
    label,
    minDate,
    maxDate,
    placeholder = "Выберите дату"
}: DatePickerProps) {
    const [currentMonth, setCurrentMonth] = useState(() => {
        if (value) {
            const selectedDate = new Date(value)
            return new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
        }
        const today = new Date()
        return new Date(today.getFullYear(), today.getMonth(), 1)
    })

    const [isOpen, setIsOpen] = useState(false)
    const calendarRef = useRef<HTMLDivElement>(null)

    // Закрытие календаря при клике вне его области
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
                // Только для десктопной версии, мобильная версия управляется кнопками
                if (window.innerWidth >= 768) {
                    setIsOpen(false)
                }
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
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
            document.removeEventListener('keydown', handleEscapeKey)
        }
    }, [isOpen])

    const formatDisplayDate = (dateString: string) => {
        // Используем локальную дату без смещения временной зоны
        const [year, month, day] = dateString.split('-').map(Number)
        const date = new Date(year, month - 1, day)
        return date.toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        })
    }

    const formatHeaderDate = (date: Date) => {
        return date.toLocaleDateString('ru-RU', {
            month: 'long',
            year: 'numeric'
        })
    }

    const getDaysInMonth = (date: Date) => {
        return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
    }

    const getFirstDayOfMonth = (date: Date) => {
        const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).getDay()
        return firstDay === 0 ? 6 : firstDay - 1 // Преобразуем воскресенье (0) в 6
    }

    const isDateDisabled = (dateString: string) => {
        if (minDate && dateString < minDate) return true
        if (maxDate && dateString > maxDate) return true
        return false
    }

    const handleDateClick = (day: number) => {
        // Используем локальную дату без временных зон
        const year = currentMonth.getFullYear()
        const month = currentMonth.getMonth()
        const selectedDate = new Date(year, month, day)

        // Форматируем дату в YYYY-MM-DD без смещения временной зоны
        const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

        if (!isDateDisabled(dateString)) {
            onChange(dateString)
            setIsOpen(false)
        }
    }

    const navigateMonth = (direction: 'prev' | 'next') => {
        setCurrentMonth(prev => {
            const newMonth = new Date(prev)
            if (direction === 'prev') {
                newMonth.setMonth(prev.getMonth() - 1)
            } else {
                newMonth.setMonth(prev.getMonth() + 1)
            }
            return newMonth
        })
    }

    const goToToday = () => {
        const today = new Date()
        setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1))

        // Форматируем сегодняшнюю дату без временных зон
        const year = today.getFullYear()
        const month = today.getMonth()
        const day = today.getDate()
        const todayString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

        if (!isDateDisabled(todayString)) {
            onChange(todayString)
            setIsOpen(false)
        }
    }

    const renderCalendarGrid = (isMobile = false) => {
        const daysInMonth = getDaysInMonth(currentMonth)
        const firstDay = getFirstDayOfMonth(currentMonth)
        const days = []

        // Добавляем пустые ячейки для дней предыдущего месяца
        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} className={isMobile ? "h-10" : "w-10 h-10"} />)
        }

        // Добавляем дни текущего месяца
        for (let day = 1; day <= daysInMonth; day++) {
            // Форматируем дату без временных зон
            const year = currentMonth.getFullYear()
            const month = currentMonth.getMonth()
            const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

            const isSelected = value === dateString
            const isDisabled = isDateDisabled(dateString)

            // Проверяем, является ли день сегодняшним
            const today = new Date()
            const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
            const isToday = dateString === todayString

            days.push(
                <MyButton
                    key={day}
                    type="button"
                    onClick={() => handleDateClick(day)}
                    disabled={isDisabled}
                    className={`${isMobile ? "h-10" : "w-10 h-10"} rounded-lg text-sm font-medium transition-all duration-200 ${isSelected
                        ? 'bg-primary text-white shadow-lg scale-110'
                        : isToday
                            ? 'bg-blue-100 text-blue-700 border border-blue-300'
                            : isDisabled
                                ? 'text-gray-300 cursor-not-allowed'
                                : 'text-gray-700 hover:bg-gray-100 hover:scale-105'
                        }`}
                >
                    {day}
                </MyButton>
            )
        }

        return days
    }

    return (
        <div className="relative " ref={calendarRef}>

            {label && (
                <label
                    htmlFor="date-picker"
                    className="mb-2 text-[12px] text-[#374151] font-medium"
                >
                    {label}
                </label>
            )
}

            <MyButton
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center shadow-md justify-between border border-gray-300 rounded-xl bg-white hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200"
            >
                <div className="flex items-center gap-3">
                    <Calendar className="hidden sm:block  w-5 h-5 text-gray-500" />
                    <span className={`text-xs ${value ? 'text-gray-900' : 'text-gray-500'}`}>
                        {value ? formatDisplayDate(value) : placeholder}
                    </span>
                </div>
                <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''
                    }`} />
            </MyButton>

            {
                isOpen && (
                    <>
                        {/* Mobile Modal Version */}
                        <div className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                            <div className="bg-white rounded-xl shadow-lg w-full max-w-sm p-4">
                                {/* Заголовок календаря */}
                                <div className="flex items-center justify-between mb-4">
                                    <button
                                        type="button"
                                        onClick={() => navigateMonth('prev')}
                                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>

                                    <h3 className="font-semibold text-gray-900 capitalize text-base">
                                        {formatHeaderDate(currentMonth)}
                                    </h3>

                                    <button
                                        type="button"
                                        onClick={() => navigateMonth('next')}
                                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>

                                {/* Дни недели */}
                                <div className="grid grid-cols-7 gap-1 mb-2">
                                    {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((day) => (
                                        <div key={day} className="h-8 flex items-center justify-center text-xs font-medium text-gray-500">
                                            {day}
                                        </div>
                                    ))}
                                </div>

                                {/* Календарная сетка */}
                                <div className="grid grid-cols-7 gap-1 mb-4">
                                    {renderCalendarGrid(true)}
                                </div>

                                {/* Кнопки */}
                                <div className="flex justify-between">
                                    <button
                                        type="button"
                                        onClick={() => setIsOpen(false)}
                                        className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                                    >
                                        Отмена
                                    </button>
                                    <button
                                        type="button"
                                        onClick={goToToday}
                                        className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                                    >
                                        Сегодня
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Desktop Dropdown Version */}
                        <div className="hidden md:block absolute top-full left-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-lg z-50 p-4 min-w-[320px]">
                            {/* Заголовок календаря */}
                            <div className="flex items-center justify-between mb-4">
                                <button
                                    type="button"
                                    onClick={() => navigateMonth('prev')}
                                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>

                                <h3 className="font-semibold text-gray-900 capitalize text-base">
                                    {formatHeaderDate(currentMonth)}
                                </h3>

                                <button
                                    type="button"
                                    onClick={() => navigateMonth('next')}
                                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Дни недели */}
                            <div className="grid grid-cols-7 gap-1 mb-2">
                                {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((day) => (
                                    <div key={day} className="w-10 h-8 flex items-center justify-center text-xs font-medium text-gray-500">
                                        {day}
                                    </div>
                                ))}
                            </div>

                            {/* Календарная сетка */}
                            <div className="grid grid-cols-7 gap-1 mb-4">
                                {renderCalendarGrid(false)}
                            </div>

                            {/* Кнопка "Сегодня" */}
                            <div className="flex justify-center">
                                <button
                                    type="button"
                                    onClick={goToToday}
                                    className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                                >
                                    Сегодня
                                </button>
                            </div>
                        </div>
                    </>
                )
            }
        </div >
    )
} 