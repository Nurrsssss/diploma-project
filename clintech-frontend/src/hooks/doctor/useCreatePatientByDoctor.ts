import { useState, useCallback } from 'react';
import { useAuthenticatedFetch } from '../auth/useAuthenticatedFetch';

export type CreatePatientByDoctorRequest = {
    phone: string;
    password: string;
    first_name: string;
    last_name: string;
    middle_name?: string;
    iin?: string;
    date_of_birth?: string;
    email?: string;
    address?: string;
    gender?: string;
    height?: number;
    weight?: number;
    phys_activity?: string;
    diagnoses?: string[];
    allergens?: string[];
    diet?: string[];
};

export type CreatePatientByDoctorResponse = {
    success: boolean;
    message: string;
    data?: {
        user_id: string;
        patient_id: string;
        phone: string;
        first_name: string;
        last_name: string;
        middle_name?: string;
        email?: string;
        created_at: string;
    };
    error?: string;
};

interface UseCreatePatientByDoctorResult {
    createPatient: (data: CreatePatientByDoctorRequest) => Promise<CreatePatientByDoctorResponse>;
    loading: boolean;
    error: string | null;
    clearError: () => void;
}

export const useCreatePatientByDoctor = (): UseCreatePatientByDoctorResult => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const authenticatedFetch = useAuthenticatedFetch();

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    const createPatient = useCallback(async (
        data: CreatePatientByDoctorRequest
    ): Promise<CreatePatientByDoctorResponse> => {
        try {
            setLoading(true);
            setError(null);

            const response = await authenticatedFetch('/api/auth/register-patient-by-doctor', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            });

            const result: CreatePatientByDoctorResponse = await response.json();

            if (!response.ok) {
                // Обрабатываем различные типы ошибок
                let errorMessage = result.message || 'Не удалось создать пациента';

                if (response.status === 403) {
                    errorMessage = 'У вас нет прав для создания пациентов. Доступно только врачам.';
                } else if (response.status === 409) {
                    errorMessage = result.message || 'Пользователь с таким телефоном уже существует';
                } else if (response.status === 400) {
                    errorMessage = result.message || 'Некорректные данные. Проверьте заполнение формы.';
                } else if (response.status === 401) {
                    errorMessage = 'Ошибка авторизации. Пожалуйста, войдите заново.';
                }

                setError(errorMessage);
                return {
                    success: false,
                    message: errorMessage,
                    error: result.error,
                };
            }

            return result;
        } catch (err) {
            const errorMessage = 'Ошибка соединения с сервером. Проверьте интернет-подключение';
            setError(errorMessage);
            return {
                success: false,
                message: errorMessage,
                error: 'NETWORK_ERROR',
            };
        } finally {
            setLoading(false);
        }
    }, [authenticatedFetch]);

    return {
        createPatient,
        loading,
        error,
        clearError,
    };
};

