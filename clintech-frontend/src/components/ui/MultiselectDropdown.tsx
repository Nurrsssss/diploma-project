'use client'
import React, { useState, useRef, useEffect } from 'react'
import { ChevronDown, X } from 'lucide-react'
import { FieldError, FieldErrors } from 'react-hook-form'

interface Option {
    label: string;
    value: string;
}

interface MultiselectDropdownProps {
    label?: string;
    id?: string;
    options: Option[];
    value?: string[];
    onChange?: (value: string[]) => void;
    className?: string;
    errors?: FieldError | FieldErrors | string | any;
    disabled?: boolean;
    placeholder?: string;
    maxHeight?: string;
}

export default function MultiselectDropdown({
    label,
    id,
    options,
    value = [],
    onChange,
    className = '',
    errors,
    disabled = false,
    placeholder = 'Выберите опции',
    maxHeight = '200px'
}: MultiselectDropdownProps) {
    const [isOpen, setIsOpen] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)

    // Закрытие при клике вне компонента
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
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
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
            document.removeEventListener('keydown', handleEscapeKey)
        }
    }, [isOpen])

    const handleOptionToggle = (optionValue: string) => {
        if (!onChange || disabled) return

        const newValue = value.includes(optionValue)
            ? value.filter(v => v !== optionValue)
            : [...value, optionValue]
        
        onChange(newValue)
    }

    const handleRemoveTag = (optionValue: string) => {
        if (!onChange || disabled) return
        
        const newValue = value.filter(v => v !== optionValue)
        onChange(newValue)
    }

    const getSelectedLabels = () => {
        return options
            .filter(option => value.includes(option.value))
            .map(option => option.label)
    }

    const getErrorMessage = () => {
        if (!errors) return null
        if (typeof errors === 'string') return errors
        if (typeof errors === 'object' && 'message' in errors && typeof errors.message === 'string') {
            return errors.message
        }
        if (typeof errors === 'object' && errors.message) {
            return errors.message
        }
        if (typeof errors === 'object' && errors.type) {
            return 'Поле обязательно для заполнения'
        }
        return null
    }

    const selectedLabels = getSelectedLabels()

    return (
        <div className="w-full relative" ref={dropdownRef}>
            {label && (
                <label
                    htmlFor={id}
                    className="mb-2 text-[12px] text-[#374151] font-medium block"
                >
                    {label}
                </label>
            )}

            {/* Поле ввода */}
            <div
                className={`
                    relative w-full px-4 py-2 text-[16px] font-sans border rounded-lg 
                    cursor-pointer transition-all duration-200 mt-2 min-h-[42px]
                    ${isOpen ? 'border-darkPurple ring-2 ring-darkPurple ring-opacity-20' : 'border-[#D1D5DB]'}
                    ${errors ? 'border-red-500' : ''}
                    ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'hover:border-gray-400'}
                    ${className}
                `}
                onClick={() => {
                    if (!disabled) {
                        setIsOpen(!isOpen)
                    }
                }}
            >
                <div className="flex items-center justify-between min-h-[42px]">
                    <div className="flex-1 flex flex-wrap gap-1 items-center min-w-0">
                        {selectedLabels.length > 0 ? (
                            selectedLabels.map((label, index) => {
                                const option = options.find(opt => opt.label === label)
                                return (
                                    <span
                                        key={option?.value || index}
                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-darkPurple/10 text-darkPurple text-xs rounded-md max-w-full break-words"
                                    >
                                        <span className="truncate max-w-[120px]">{label}</span>
                                        {!disabled && (
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.preventDefault()
                                                    e.stopPropagation()
                                                    handleRemoveTag(option?.value || '')
                                                }}
                                                className="ml-1 hover:bg-darkPurple/20 rounded-full p-0.5 transition-colors flex-shrink-0"
                                            >
                                                <X size={10} />
                                            </button>
                                        )}
                                    </span>
                                )
                            })
                        ) : (
                            <span className="text-[#CCCCCC] font-sans text-[16px]">
                                {placeholder}
                            </span>
                        )}
                    </div>
                    <ChevronDown 
                        className={`w-4 h-4 text-gray-400 transition-transform duration-200 flex-shrink-0 ml-2 ${
                            isOpen ? 'transform rotate-180' : ''
                        }`}
                    />
                </div>
            </div>

            {/* Dropdown */}
            {isOpen && !disabled && (
                <div 
                    className="absolute z-[9999] w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-xl"
                    style={{ 
                        maxHeight, 
                        overflowY: 'auto',
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
                    }}
                >
                    {options.length > 0 ? (
                        options.map((option) => {
                            const isSelected = value.includes(option.value)
                            return (
                                <div
                                    key={option.value}
                                    className="flex items-center px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0 bg-white"
                                    onClick={(e) => {
                                        e.preventDefault()
                                        e.stopPropagation()
                                        handleOptionToggle(option.value)
                                    }}
                                >
                                    <div className="flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={(e) => {
                                                e.stopPropagation()
                                                handleOptionToggle(option.value)
                                            }}
                                            className="w-4 h-4 text-darkPurple border-gray-300 rounded focus:ring-darkPurple focus:ring-2"
                                        />
                                        <label className="ml-3 text-sm font-medium text-gray-700 cursor-pointer select-none">
                                            {option.label}
                                        </label>
                                    </div>
                                </div>
                            )
                        })
                    ) : (
                        <div className="px-4 py-3 text-gray-500 text-sm">
                            Нет доступных опций
                        </div>
                    )}
                </div>
            )}

            {/* Сообщение об ошибке */}
            {getErrorMessage() && (
                <span className="text-red-500 text-sm mt-1 block">
                    {getErrorMessage()}
                </span>
            )}
        </div>
    )
} 