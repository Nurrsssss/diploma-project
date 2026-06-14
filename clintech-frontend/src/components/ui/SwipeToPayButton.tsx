'use client'
import React, { useState, useRef, useEffect } from 'react'
import { FaCreditCard, FaArrowRight, FaCheck } from 'react-icons/fa'
import Loader from './Loader'

interface SwipeToPayButtonProps {
    amount: number
    onSwipeComplete: () => void
    disabled?: boolean
    isProcessing?: boolean
    className?: string
}

const SwipeToPayButton: React.FC<SwipeToPayButtonProps> = ({
    amount,
    onSwipeComplete,
    disabled = false,
    isProcessing = false,
    className = ''
}) => {
    const [isDragging, setIsDragging] = useState(false)
    const [dragX, setDragX] = useState(0)
    const [isCompleted, setIsCompleted] = useState(false)
    const buttonRef = useRef<HTMLDivElement>(null)
    const sliderRef = useRef<HTMLDivElement>(null)
    const startX = useRef(0)
    const maxDragX = useRef(0)

    // Обновляем максимальную дистанцию при изменении размера
    useEffect(() => {
        const updateMaxDrag = () => {
            if (buttonRef.current && sliderRef.current) {
                const containerWidth = buttonRef.current.offsetWidth
                const sliderWidth = sliderRef.current.offsetWidth
                maxDragX.current = containerWidth - sliderWidth - 8 // 8px для padding
            }
        }

        updateMaxDrag()
        window.addEventListener('resize', updateMaxDrag)
        return () => window.removeEventListener('resize', updateMaxDrag)
    }, [])

    // Сброс состояния при изменении disabled/processing
    useEffect(() => {
        if (disabled || isProcessing) {
            setDragX(0)
            setIsCompleted(false)
            setIsDragging(false)
        }
    }, [disabled, isProcessing])

    const handleStart = (clientX: number) => {
        if (disabled || isProcessing || isCompleted) return

        setIsDragging(true)
        startX.current = clientX - dragX
        
        // Добавляем тактильную обратную связь
        if (navigator.vibrate) {
            navigator.vibrate(50)
        }
    }

    const handleMove = (clientX: number) => {
        if (!isDragging || disabled || isProcessing || isCompleted) return

        const newDragX = Math.max(0, Math.min(maxDragX.current, clientX - startX.current))
        setDragX(newDragX)

        // Проверяем, достиг ли пользователь конца
        const progress = newDragX / maxDragX.current
        if (progress > 0.85) { // 85% для срабатывания
            setIsCompleted(true)
            setIsDragging(false)
            
            // Тактильная обратная связь при завершении
            if (navigator.vibrate) {
                navigator.vibrate([100, 50, 100])
            }
            
            // Анимация завершения
            setDragX(maxDragX.current)
            
            // Вызываем callback через небольшую задержку для анимации
            setTimeout(() => {
                onSwipeComplete()
            }, 300)
        }
    }

    const handleEnd = () => {
        if (!isDragging || isCompleted) return

        setIsDragging(false)
        
        // Если не завершено, возвращаем в начальную позицию
        setDragX(0)
    }

    // Touch events
    const handleTouchStart = (e: React.TouchEvent) => {
        handleStart(e.touches[0].clientX)
    }

    const handleTouchMove = (e: React.TouchEvent) => {
        handleMove(e.touches[0].clientX)
    }

    const handleTouchEnd = () => {
        handleEnd()
    }

    // Mouse events
    const handleMouseDown = (e: React.MouseEvent) => {
        handleStart(e.clientX)
    }

    const handleMouseMove = (e: React.MouseEvent) => {
        handleMove(e.clientX)
    }

    const handleMouseUp = () => {
        handleEnd()
    }

    // Mouse events для document (чтобы работало даже если курсор выходит за пределы)
    useEffect(() => {
        const handleDocumentMouseMove = (e: MouseEvent) => {
            if (isDragging) {
                handleMove(e.clientX)
            }
        }

        const handleDocumentMouseUp = () => {
            if (isDragging) {
                handleEnd()
            }
        }

        if (isDragging) {
            document.addEventListener('mousemove', handleDocumentMouseMove)
            document.addEventListener('mouseup', handleDocumentMouseUp)
        }

        return () => {
            document.removeEventListener('mousemove', handleDocumentMouseMove)
            document.removeEventListener('mouseup', handleDocumentMouseUp)
        }
    }, [isDragging])

    const progress = maxDragX.current > 0 ? dragX / maxDragX.current : 0
    const opacity = Math.max(0.3, 1 - progress * 0.7)

    return (
        <div className={`relative ${className}`}>
            {/* Основной контейнер кнопки */}
            <div
                ref={buttonRef}
                className={`
                    relative h-16 bg-gradient-to-r from-red-600 to-red-700 
                    rounded-2xl overflow-hidden cursor-pointer select-none
                    transition-all duration-300 shadow-lg
                    ${disabled || isProcessing ? 'opacity-50 cursor-not-allowed' : ''}
                    ${isCompleted ? 'bg-gradient-to-r from-green-600 to-green-700' : ''}
                `}
                style={{
                    background: isCompleted 
                        ? 'linear-gradient(90deg, #059669, #047857)' 
                        : `linear-gradient(90deg, rgba(220, 38, 38, ${opacity}) 0%, rgba(185, 28, 28, ${opacity}) 100%)`
                }}
            >
                {/* Прогресс-фон */}
                <div
                    className="absolute inset-0 bg-gradient-to-r from-red-500 to-red-600 transition-all duration-200"
                    style={{
                        transform: `translateX(-${100 - progress * 100}%)`,
                        opacity: 0.6
                    }}
                />

                {/* Текст */}
                <div className="absolute inset-0 flex items-center justify-center">
                    <span 
                        className="text-white font-bold text-lg transition-opacity duration-200"
                        style={{ opacity }}
                    >
                        {isProcessing ? 'Бронирование записи...' : 
                         isCompleted ? 'Завершено!' : 
                         `оплатить ${amount.toLocaleString()} тг`}
                    </span>
                </div>

                {/* Свайп-слайдер */}
                <div
                    ref={sliderRef}
                    className={`
                        absolute left-1 top-1 bottom-1 w-14 
                        bg-white rounded-xl shadow-lg
                        flex items-center justify-center
                        transition-all duration-200 z-10
                        ${isDragging ? 'scale-105' : ''}
                        ${isCompleted ? 'bg-green-100' : ''}
                    `}
                    style={{
                        transform: `translateX(${dragX}px)`,
                        transition: isDragging ? 'none' : 'transform 0.3s ease-out, background-color 0.3s'
                    }}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    
                >
                    {isProcessing ? (
                        <Loader />
                    ) : isCompleted ? (
                        <FaCheck className="text-green-600 text-xl" />
                    ) : (
                        <div className="flex items-center">
                            <FaCreditCard className="text-red-600 text-lg mr-1" />
                            <FaArrowRight 
                                className={`text-red-600 text-sm transition-transform duration-200 ${
                                    isDragging ? 'translate-x-1' : ''
                                }`} 
                            />
                        </div>
                    )}
                </div>

                {/* Направляющие точки */}
                <div className="absolute right-4 top-1/2 transform -translate-y-1/2 flex space-x-1">
                    {[...Array(3)].map((_, i) => (
                        <div
                            key={i}
                            className={`w-1 h-1 rounded-full transition-all duration-200 ${
                                progress > (i + 1) * 0.25 ? 'bg-white' : 'bg-white/40'
                            }`}
                            style={{
                                opacity: Math.max(0.4, opacity)
                            }}
                        />
                    ))}
                </div>
            </div>

            {/* Подсказка */}
            {!isCompleted && !isProcessing && (
                <p className="text-center text-gray-500 text-sm mt-2">
                    Проведите пальцем вправо для подтверждения оплаты
                </p>
            )}
        </div>
    )
}

export default SwipeToPayButton 