'use client'
import React, { useEffect, useState } from 'react';
import { useOTP } from '@/hooks/auth/useOTP';
import OTPInput from './OTPInput';
import MyButton from '../ui/MyButton';
import Link from 'next/link';

interface OTPVerificationProps {
    phone: string;
    onVerified: () => void;
    onBack: () => void;
    className?: string;
}

export default function OTPVerification({
    phone,
    onVerified,
    onBack,
    className = '',
}: OTPVerificationProps) {
    const {
        otpState,
        sendOTP,
        verifyOTP,
        resendOTP,
        updateCode,
        loading,
        error,
        clearError,
    } = useOTP();

    const [isResending, setIsResending] = useState(false);

    // Отправляем OTP при первом рендере
    useEffect(() => {
        if (!otpState.isSent) {
            sendOTP(phone);
        }
    }, [phone, otpState.isSent, sendOTP]);

    // Обработка успешной верификации
    useEffect(() => {
        if (otpState.isVerified) {
            // Не вызываем onVerified автоматически, показываем кнопку регистрации
        }
    }, [otpState.isVerified, onVerified]);

    const handleVerify = async () => {
        if (otpState.code.length !== 4) return;

        clearError();
        const result = await verifyOTP(phone, otpState.code);

        if (result.success) {
            // OTP верификация успешна, но не вызываем onVerified автоматически
            // Показываем кнопку "Зарегистрироваться"
        }
    };

    const handleResend = async () => {
        if (!otpState.canResend) return;

        setIsResending(true);
        clearError();

        const result = await resendOTP(phone);

        if (!result.success) {
            // Ошибка уже установлена в хуке
        }

        setIsResending(false);
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className={`flex flex-col items-center gap-6 ${className}`}>
            <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-800 mb-2">
                    Подтверждение номера
                </h2>
                <p className="text-gray-600 mb-1">
                    Мы отправили код подтверждения на номер
                </p>
                <p className="text-lg font-semibold text-gray-800">
                    {phone}
                </p>
            </div>

            {error && (
                <div className="w-full max-w-md p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-red-600 text-sm text-center">{error}</p>
                </div>
            )}

            <div className="w-full max-w-md">
                <OTPInput
                    value={otpState.code}
                    onChange={updateCode}
                    disabled={loading}
                    className="mb-6"
                />

                {!otpState.isVerified ? (
                    <MyButton
                        type="button"
                        onClick={handleVerify}
                        disabled={otpState.code.length !== 4 || loading}
                        className="w-full mb-4 text-white bg-primary hover:bg-primary/90 disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Проверка...' : 'Подтвердить'}
                    </MyButton>
                ) : (
                    <MyButton
                        type="button"
                        onClick={onVerified}
                        className="w-full mb-4 text-white bg-green-600 hover:bg-green-700"
                    >
                        Зарегистрироваться
                    </MyButton>
                )}

                <div className="text-center space-y-2">
                    {otpState.canResend ? (
                        <MyButton
                            type="button"
                            onClick={handleResend}
                            disabled={isResending}
                            className="text-primary hover:text-primary/80 shadow-none disabled:text-gray-400"
                        >
                            {isResending ? 'Отправка...' : 'Отправить повторно'}
                        </MyButton>
                    ) : (
                        <p className="text-sm text-gray-500">
                            Повторная отправка через {formatTime(otpState.resendTimer)}
                        </p>
                    )}
                    
                    <MyButton
                        type="button"
                        onClick={onBack}
                        className="text-gray-500 hover:text-gray-700 shadow-none"
                    >
                        Назад
                    </MyButton>
                </div>
            </div>
        </div>
    );
} 