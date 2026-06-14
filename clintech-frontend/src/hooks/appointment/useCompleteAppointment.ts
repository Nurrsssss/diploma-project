import { useState, useCallback } from 'react';
import { useAuthenticatedFetch } from '../auth/useAuthenticatedFetch';

export interface CompleteAppointmentData {
    doctor_notes: string;
    completed_reason: string;
    health_passport_id?: string;
}

export interface UseCompleteAppointmentReturn {
    loading: boolean;
    error: string | null;
    completeAppointment: (appointmentId: string, data: CompleteAppointmentData) => Promise<boolean>;
    clearError: () => void;
}

export const useCompleteAppointment = (): UseCompleteAppointmentReturn => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const authenticatedFetch = useAuthenticatedFetch();

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    const completeAppointment = useCallback(async (
        appointmentId: string, 
        data: CompleteAppointmentData
    ): Promise<boolean> => {
        try {
            setLoading(true);
            setError(null);

            console.log('Завершаем прием:', appointmentId, data);

            const response = await authenticatedFetch(`/api/appointments/${appointmentId}/complete`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (response.ok && result.success !== false) {
                console.log('Прием успешно завершен:', result);
                return true;
            } else {
                let errorMessage = 'Ошибка при завершении приема';
                
                // Обрабатываем специфичные ошибки
                if (response.status === 400) {
                    errorMessage = 'Некорректные данные для завершения приема';
                } else if (response.status === 403) {
                    errorMessage = 'Недостаточно прав для завершения приема';
                } else if (response.status === 404) {
                    errorMessage = 'Запись не найдена';
                } else if (response.status === 409) {
                    errorMessage = 'Прием уже завершен или отменен';
                } else if (result.error) {
                    errorMessage = result.error;
                }
                
                setError(errorMessage);
                return false;
            }
        } catch (err) {
            console.error('Ошибка при завершении приема:', err);
            setError('Ошибка соединения с сервером');
            return false;
        } finally {
            setLoading(false);
        }
    }, [authenticatedFetch]);

    return {
        loading,
        error,
        completeAppointment,
        clearError
    };
};
