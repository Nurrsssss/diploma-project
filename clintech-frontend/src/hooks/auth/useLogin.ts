import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { processError } from '@/utils/errorUtils';

export interface ILoginCredentials {
    phone: string; // Телефон для входа
    password: string;
}

export interface ILoginResult {
    success: boolean;
    role?: string;
    user_id?: string;
    message?: string;
}

interface IUseLoginReturn {
    login: (credentials: ILoginCredentials) => Promise<ILoginResult>;
    loading: boolean;
    error: string | null;
    clearError: () => void;
}

export const useLogin = (): IUseLoginReturn => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    const normalizePhone = useCallback((raw: string) => {
        const digits = (raw || '').replace(/\D/g, '');
        if (digits.length === 11 && digits.startsWith('8')) {
            return `7${digits.slice(1)}`;
        }
        return digits || raw.trim();
    }, []);

    const buildPhoneVariants = useCallback((raw: string) => {
        const normalized = normalizePhone(raw);
        const variants = [raw, normalized];

        if (normalized.length === 11 && normalized.startsWith('7')) {
            variants.push(`+${normalized}`);
        }

        return Array.from(new Set(variants.map((value) => value.trim()).filter(Boolean)));
    }, [normalizePhone]);

    const doLoginRequest = useCallback(async (credentials: ILoginCredentials): Promise<Response> => {
        return fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify(credentials),
        });
    }, []);

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    const login = useCallback(async (credentials: ILoginCredentials): Promise<ILoginResult> => {
        try {
            setLoading(true);
            setError(null);

            const phoneVariants = buildPhoneVariants(credentials.phone);
            let response: Response | null = null;
            let data: any = null;

            for (let index = 0; index < phoneVariants.length; index += 1) {
                const candidatePhone = phoneVariants[index];
                response = await doLoginRequest({
                    ...credentials,
                    phone: candidatePhone,
                });
                data = await response.json().catch(() => ({}));

                if (response.ok && data.success) {
                    break;
                }

                if (response.status !== 401 || index === phoneVariants.length - 1) {
                    break;
                }
            }

            if (!response) {
                throw new Error('Не удалось выполнить запрос входа');
            }

            if (response.ok && data.success) {
                // При успешном входе токен уже установлен в HttpOnly cookie
                return {
                    success: true,
                    role: data.role,
                    user_id: data.user_id,
                    message: 'Успешный вход в систему',
                };
            } else {
                // Обрабатываем различные типы ошибок
                let errorMessage = 'Произошла ошибка при входе';

                errorMessage = processError(response, {
                    401: 'Неверный номер телефона или пароль',  // кастомное для логина
                    404: 'Пользователь не найден',
                    500: 'Сервер недоступен. Попробуйте позже', // кастомное для логина
                    default: 'Произошла ошибка при входе'       // общий fallback
                });

                setError(errorMessage);
                return {
                    success: false,
                    message: errorMessage,
                };
            }
        } catch (err) {
            const errorMessage = 'Ошибка соединения с сервером. Проверьте интернет-подключение';
            setError(errorMessage);
            return {
                success: false,
                message: errorMessage,
            };
        } finally {
            setLoading(false);
        }
    }, [buildPhoneVariants, doLoginRequest]);

    return {
        login,
        loading,
        error,
        clearError,
    };
}; 