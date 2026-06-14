'use client';

import React, { forwardRef, useState, useEffect, useRef } from 'react';

interface PhoneInputProps {
    label: string;
    id: string;
    placeholder?: string;
    errors?: any;
    className?: string;
    value?: string;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
    name?: string;
}

const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(
    ({ label, id, placeholder, errors, className = '', value, onChange, onBlur, name, ...props }, ref) => {
        const [displayValue, setDisplayValue] = useState('');
        const [rawValue, setRawValue] = useState('');
        const inputRef = useRef<HTMLInputElement | null>(null);

        // Форматируем номер телефона в маску
        const formatPhoneNumber = (rawValue: string) => {
            const digits = rawValue.replace(/\D/g, '');
            
            if (!digits) return '';
            
            let formatted = '+7-(';
            
            if (digits.length > 1) {
                formatted += digits.slice(1, 4);
            }
            formatted += ')-';
            
            if (digits.length > 4) {
                formatted += digits.slice(4, 7);
            }
            formatted += '-';
            
            if (digits.length > 7) {
                formatted += digits.slice(7, 9);
            }
            formatted += '-';
            
            if (digits.length > 9) {
                formatted += digits.slice(9, 11);
            }
            
            return formatted;
        };

        // Получаем только цифры из отформатированного значения
        const getDigitsOnly = (formattedValue: string) => {
            const digits = formattedValue.replace(/\D/g, '');
            return digits.startsWith('7') ? digits : '7' + digits;
        };

        // Обновляем отображаемое значение при изменении внешнего value
        useEffect(() => {
            if (value !== undefined) {
                const digits = value.replace(/\D/g, '');
                if (digits && digits.length > 0) {
                    // Если есть цифры, форматируем их
                    const fullNumber = digits.startsWith('7') ? digits : '7' + digits;
                    setRawValue(fullNumber);
                    setDisplayValue(formatPhoneNumber(fullNumber));
                } else {
                    setRawValue('');
                    setDisplayValue('');
                }
            }
        }, [value]);

        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            const inputValue = e.target.value;
            
            // Извлекаем только цифры
            const digits = inputValue.replace(/\D/g, '');
            
            // Если пользователь очистил поле полностью
            if (!digits) {
                setDisplayValue('');
                const syntheticEvent = {
                    ...e,
                    target: {
                        ...e.target,
                        value: '',
                        name: name || id
                    }
                };
                if (onChange) {
                    onChange(syntheticEvent as React.ChangeEvent<HTMLInputElement>);
                }
                return;
            }
            
            // Ограничиваем до 11 цифр максимум
            let limitedDigits = digits.slice(0, 11);
            
            // Если первая цифра не 7, добавляем 7 в начало
            if (!limitedDigits.startsWith('7')) {
                limitedDigits = '7' + limitedDigits.slice(0, 10);
            }
            
            // Сохраняем чистые цифры
            setRawValue(limitedDigits);
            
            // Форматируем для отображения
            const formatted = formatPhoneNumber(limitedDigits);
            setDisplayValue(formatted);
            
            // Вызываем onChange для react-hook-form с чистыми цифрами

            if (onChange) {
                const syntheticEvent = {
                    target: {
                        name: name || id,
                        value: limitedDigits
                    }
                } as React.ChangeEvent<HTMLInputElement>;
                onChange(syntheticEvent);
            }
        };

        const digitsCountBeforeCaret = (formatted: string, caret: number) => {
            let count = 0;
            for (let i = 0; i < Math.max(0, caret); i++) {
                if (/\d/.test(formatted[i]!)) count++;
            }
            return count;
        };

        const caretFromDigitsCount = (formatted: string, digitsCount: number) => {
            if (digitsCount <= 0) return 0;
            let count = 0;
            for (let i = 0; i < formatted.length; i++) {
                if (/\d/.test(formatted[i]!)) count++;
                if (count === digitsCount) return i + 1;
            }
            return formatted.length;
        };

        const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
            // Разрешаем навигационные клавиши
            const allowedKeys = [
                'Backspace', 'Delete', 'Tab', 'Escape', 'Enter',
                'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
                'Home', 'End'
            ];
            
            if (allowedKeys.includes(e.key)) {
                // Кастомная логика удаления для удобства
                if ((e.key === 'Backspace' || e.key === 'Delete') && inputRef.current) {
                    e.preventDefault();
                    const el = inputRef.current;
                    const selectionStart = el.selectionStart ?? displayValue.length;
                    const selectionEnd = el.selectionEnd ?? selectionStart;
                    const currentDigits = rawValue || '7';

                    // Количество цифр слева от каретки
                    const leftDigits = digitsCountBeforeCaret(displayValue, selectionStart);
                    const rightDigits = digitsCountBeforeCaret(displayValue, selectionEnd);

                    let digitsArr = currentDigits.split('');

                    if (selectionStart !== selectionEnd) {
                        // Удаление выделенного диапазона цифр
                        const removeFrom = Math.max(1, leftDigits); // не удаляем ведущую 7
                        const removeTo = Math.max(1, rightDigits);
                        digitsArr.splice(removeFrom, removeTo - removeFrom);
                        if (digitsArr.length === 1) digitsArr = []; // если осталась только 7 — очищаем
                        const newDigits = digitsArr.join('');
                        const formatted = newDigits ? formatPhoneNumber(newDigits) : '';
                        setRawValue(newDigits);
                        setDisplayValue(formatted);
                        const newCaretDigits = removeFrom;
                        const newCaret = caretFromDigitsCount(formatted, newCaretDigits);
                        requestAnimationFrame(() => el.setSelectionRange(newCaret, newCaret));
                        // Пробрасываем наружу чистые цифры
                        if (onChange) {
                            const syntheticEvent = { target: { name: name || id, value: newDigits } } as React.ChangeEvent<HTMLInputElement>;
                            onChange(syntheticEvent);
                        }
                        return;
                    }

                    if (e.key === 'Backspace') {
                        const removeIndex = Math.max(1, leftDigits - 1); // удаляем цифру слева, не трогаем первую 7
                        if (currentDigits.length <= 1) {
                            // очищаем полностью
                            setRawValue('');
                            setDisplayValue('');
                            if (onChange) {
                                const syntheticEvent = { target: { name: name || id, value: '' } } as React.ChangeEvent<HTMLInputElement>;
                                onChange(syntheticEvent);
                            }
                            requestAnimationFrame(() => el.setSelectionRange(0, 0));
                            return;
                        }
                        const digitsArr2 = currentDigits.split('');
                        digitsArr2.splice(removeIndex, 1);
                        const newDigits = digitsArr2.join('');
                        const formatted = formatPhoneNumber(newDigits);
                        setRawValue(newDigits);
                        setDisplayValue(formatted);
                        const newCaretDigits = Math.max(1, leftDigits - 1);
                        const newCaret = caretFromDigitsCount(formatted, newCaretDigits);
                        requestAnimationFrame(() => el.setSelectionRange(newCaret, newCaret));
                        if (onChange) {
                            const syntheticEvent = { target: { name: name || id, value: newDigits } } as React.ChangeEvent<HTMLInputElement>;
                            onChange(syntheticEvent);
                        }
                        return;
                    }

                    if (e.key === 'Delete') {
                        const removeIndex = Math.max(1, leftDigits); // удаляем цифру справа от каретки
                        const digitsArr2 = currentDigits.split('');
                        if (removeIndex < digitsArr2.length) {
                            digitsArr2.splice(removeIndex, 1);
                            const newDigits = digitsArr2.join('');
                            const formatted = newDigits ? formatPhoneNumber(newDigits) : '';
                            setRawValue(newDigits);
                            setDisplayValue(formatted);
                            const newCaret = caretFromDigitsCount(formatted, leftDigits);
                            requestAnimationFrame(() => el.setSelectionRange(newCaret, newCaret));
                            if (onChange) {
                                const syntheticEvent = { target: { name: name || id, value: newDigits } } as React.ChangeEvent<HTMLInputElement>;
                                onChange(syntheticEvent);
                            }
                        }
                        return;
                    }
                    return;
                }
                return;
            }
            
            // Разрешаем Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
            if (e.ctrlKey && ['a', 'c', 'v', 'x'].includes(e.key.toLowerCase())) {
                return;
            }
            
            // Разрешаем только цифры
            if (!/[0-9]/.test(e.key)) {
                e.preventDefault();
            }
        };

        return (
            <div className={`flex flex-col ${className}`}>
                <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
                    {label}
                </label>
                
                {/* Единое поле с форматированным номером */}
                <input
                    {...props}
                    ref={(node) => { inputRef.current = node; if (typeof ref === 'function') ref(node!); else if (ref) (ref as React.MutableRefObject<HTMLInputElement | null>).current = node; }}
                    id={id}
                    name={name || id}
                    type="tel"
                    value={displayValue}
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                    onBlur={onBlur}
                    placeholder={placeholder || "+7-(777)-777-77-77"}
                    className={`
                        w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm
                        focus:outline-none focus:ring-primary focus:border-primary
                        ${errors ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : ''}
                    `}
                />
                {errors && (
                    <span className="text-red-500 text-sm mt-1">{errors.message}</span>
                )}
            </div>
        );
    }
);

PhoneInput.displayName = 'PhoneInput';

export default PhoneInput;
