'use client'
import React, { useEffect, useRef } from 'react';
import MyButton from '../ui/MyButton';

interface OTPInputProps {
    value: string;
    onChange: (value: string) => void;
    length?: number;
    disabled?: boolean;
    autoFocus?: boolean;
    className?: string;
}

export default function OTPInput({
    value,
    onChange,
    length = 4,
    disabled = false,
    autoFocus = true,
    className = '',
}: OTPInputProps) {
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    useEffect(() => {
        if (autoFocus && inputRefs.current[0]) {
            inputRefs.current[0]?.focus();
        }
    }, [autoFocus]);

    const handleChange = (index: number, inputValue: string) => {
        // принимаем только одну цифру
        const digit = (inputValue.match(/\d/) || [''])[0];
        const newValue = value.split('');
        newValue[index] = digit;
        const result = newValue.join('').slice(0, length);
        onChange(result);

        // Автоматический переход к следующему полю
        if (inputValue && index < length - 1) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace' && !value[index] && index > 0) {
            // Переход к предыдущему полю при удалении
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData('text/plain').replace(/\D/g, '').slice(0, length);
        onChange(pastedData);
        
        // Фокус на последнее заполненное поле или первое пустое
        const focusIndex = Math.min(pastedData.length, length - 1);
        inputRefs.current[focusIndex]?.focus();
    };

    return (
        <div className={`flex gap-2 justify-center ${className}`}>
            {Array.from({ length }, (_, index) => (
                <input
                    key={index}
                    ref={(el) => {
                        inputRefs.current[index] = el;
                    }}
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={1}
                    value={value[index] || ''}
                    onChange={(e) => handleChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    onPaste={handlePaste}
                    disabled={disabled}
                    className="w-12 h-12 text-center text-xl font-semibold border-2 border-gray-300 rounded-lg focus:border-primary focus:outline-none disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
                    style={{
                        caretColor: 'transparent',
                    }}
                />
            ))}
        </div>
    );
} 