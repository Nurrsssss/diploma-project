import { useState, useCallback } from 'react';
import { useAuthenticatedFetch } from '../auth/useAuthenticatedFetch';
import { TPatient } from '@/types/patient';
import { processError } from '@/utils/errorUtils';

interface IUpdatePatientProfileResult {
    success: boolean;
    message?: string;
}

interface IUsePatientProfileReturn {
    updateProfile: (userId: string, data: TPatient) => Promise<IUpdatePatientProfileResult>;
    loading: boolean;
    error: string | null;
    clearError: () => void;
}

export const usePatientProfile = (): IUsePatientProfileReturn => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const authenticatedFetch = useAuthenticatedFetch();

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    const updateProfile = useCallback(async (userId: string, data: TPatient): Promise<IUpdatePatientProfileResult> => {
        try {
            setLoading(true);
            setError(null);

                    const response = await authenticatedFetch(`/api/users/${userId}/patient`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });

            if (response.ok) {
                return {
                    success: true,
                    message: 'Профиль пациента успешно обновлен',
                };
            } else {
                // Обрабатываем различные типы ошибок
                let errorMessage = 'Произошла ошибка при обновлении профиля';

                errorMessage = processError(response, {
                    400: 'Некорректные данные. Проверьте заполнение формы.',
                    401: 'Ошибка авторизации. Пожалуйста, войдите заново.',
                    500: 'Техническая ошибка сервера. Попробуйте позже.',
                    default: 'Произошла ошибка при обновлении профиля'
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
    }, [authenticatedFetch]);

    return {
        updateProfile,
        loading,
        error,
        clearError,
    };
}; 