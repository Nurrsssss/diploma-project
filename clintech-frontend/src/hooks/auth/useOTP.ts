import { useState, useCallback } from 'react';

export interface IOTPState {
    phone: string;
    code: string;
    isSent: boolean;
    isVerified: boolean;
    attempts: number;
    isBlocked: boolean;
    blockExpiresAt: string | null;
    expiresAt: string | null;
    canResend: boolean;
    resendTimer: number;
}

export interface ISendOTPResult {
    success: boolean;
    message?: string;
    expires_at?: string;
}

export interface IVerifyOTPResult {
    success: boolean;
    message?: string;
    verified_at?: string;
}

export interface IResendOTPResult {
    success: boolean;
    message?: string;
    expires_at?: string;
}

interface IUseOTPReturn {
    // Состояние
    otpState: IOTPState;
    
    // Методы
    sendOTP: (phone: string) => Promise<ISendOTPResult>;
    verifyOTP: (phone: string, code: string) => Promise<IVerifyOTPResult>;
    resendOTP: (phone: string) => Promise<IResendOTPResult>;
    
    // Утилиты
    clearOTP: () => void;
    updateCode: (code: string) => void;
    startResendTimer: () => void;
    
    // Состояние загрузки
    loading: boolean;
    error: string | null;
    clearError: () => void;
}

export const useOTP = (): IUseOTPReturn => {
    const [otpState, setOtpState] = useState<IOTPState>({
        phone: '',
        code: '',
        isSent: false,
        isVerified: false,
        attempts: 0,
        isBlocked: false,
        blockExpiresAt: null,
        expiresAt: null,
        canResend: true,
        resendTimer: 0,
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    const clearOTP = useCallback(() => {
        setOtpState({
            phone: '',
            code: '',
            isSent: false,
            isVerified: false,
            attempts: 0,
            isBlocked: false,
            blockExpiresAt: null,
            expiresAt: null,
            canResend: true,
            resendTimer: 0,
        });
    }, []);

    const updateCode = useCallback((code: string) => {
        setOtpState(prev => ({
            ...prev,
            code: code.replace(/\D/g, '').slice(0, 4), // Только цифры, максимум 4
        }));
    }, []);

    const startResendTimer = useCallback(() => {
        setOtpState(prev => ({
            ...prev,
            canResend: false,
            resendTimer: 120, // 2 минуты
        }));

        const timer = setInterval(() => {
            setOtpState(prev => {
                if (prev.resendTimer <= 1) {
                    clearInterval(timer);
                    return {
                        ...prev,
                        canResend: true,
                        resendTimer: 0,
                    };
                }
                return {
                    ...prev,
                    resendTimer: prev.resendTimer - 1,
                };
            });
        }, 1000);
    }, []);

    const sendOTP = useCallback(async (phone: string): Promise<ISendOTPResult> => {
        try {
            setLoading(true);
            setError(null);

            const response = await fetch('/api/auth/send-otp', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ phone }),
            });

            const data = await response.json();

            if (response.ok && data.success) {
                setOtpState(prev => ({
                    ...prev,
                    phone,
                    isSent: true,
                    expiresAt: data.expires_at,
                    canResend: false,
                    resendTimer: 120, // 2 минуты
                }));

                startResendTimer();

                return {
                    success: true,
                    message: data.message || 'OTP код отправлен',
                    expires_at: data.expires_at,
                };
            } else {
                const errorMessage = data.message || 'Ошибка отправки OTP кода';
                setError(errorMessage);
                return {
                    success: false,
                    message: errorMessage,
                };
            }
        } catch (err) {
            const errorMessage = 'Ошибка соединения с сервером';
            setError(errorMessage);
            return {
                success: false,
                message: errorMessage,
            };
        } finally {
            setLoading(false);
        }
    }, [startResendTimer]);

    const verifyOTP = useCallback(async (phone: string, code: string): Promise<IVerifyOTPResult> => {
        try {
            setLoading(true);
            setError(null);

            const response = await fetch('/api/auth/verify-otp', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ phone, code }),
            });

            const data = await response.json();

            if (response.ok && data.success) {
                setOtpState(prev => ({
                    ...prev,
                    isVerified: true,
                    code: '',
                }));

                return {
                    success: true,
                    message: data.message || 'Код подтвержден',
                    verified_at: data.verified_at,
                };
            } else {
                const errorMessage = data.message || 'Неверный код';
                setError(errorMessage);
                
                // Обновляем количество попыток
                setOtpState(prev => ({
                    ...prev,
                    attempts: prev.attempts + 1,
                    code: '',
                }));

                return {
                    success: false,
                    message: errorMessage,
                };
            }
        } catch (err) {
            const errorMessage = 'Ошибка соединения с сервером';
            setError(errorMessage);
            return {
                success: false,
                message: errorMessage,
            };
        } finally {
            setLoading(false);
        }
    }, []);

    const resendOTP = useCallback(async (phone: string): Promise<IResendOTPResult> => {
        try {
            setLoading(true);
            setError(null);

            const response = await fetch('/api/auth/resend-otp', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ phone }),
            });

            const data = await response.json();

            if (response.ok && data.success) {
                setOtpState(prev => ({
                    ...prev,
                    isSent: true,
                    expiresAt: data.expires_at,
                    canResend: false,
                    resendTimer: 120, // 2 минуты
                }));

                startResendTimer();

                return {
                    success: true,
                    message: data.message || 'OTP код отправлен повторно',
                    expires_at: data.expires_at,
                };
            } else {
                const errorMessage = data.message || 'Ошибка повторной отправки OTP кода';
                setError(errorMessage);
                return {
                    success: false,
                    message: errorMessage,
                };
            }
        } catch (err) {
            const errorMessage = 'Ошибка соединения с сервером';
            setError(errorMessage);
            return {
                success: false,
                message: errorMessage,
            };
        } finally {
            setLoading(false);
        }
    }, [startResendTimer]);

    return {
        otpState,
        sendOTP,
        verifyOTP,
        resendOTP,
        clearOTP,
        updateCode,
        startResendTimer,
        loading,
        error,
        clearError,
    };
}; 