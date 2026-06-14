import { useState, useCallback } from 'react';

export interface CompleteAppointmentData {
    doctor_notes?: string;
    completed_reason?: string;
    health_passport_id?: string;
}

export interface UseAppointmentCompletionReturn {
    loading: boolean;
    error: string | null;
    completeAppointment: (appointmentId: string, data: CompleteAppointmentData) => Promise<boolean>;
    clearError: () => void;
}

export const useAppointmentCompletion = (): UseAppointmentCompletionReturn => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

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

            const response = await fetch(`/api/appointments/${appointmentId}/complete`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (response.ok && result.success) {
                return true;
            } else {
                let errorMessage = 'Ошибка при завершении приема';
                
                // Обрабатываем специфичные ошибки
                if (response.status === 400) {
                    errorMessage = 'Некорректные данные для завершения приема';
                } else if (response.status === 403) {
                    errorMessage = 'Недостаточно прав для завершения приема';
                } else if (response.status === 404) {
                    errorMessage = 'Прием не найден';
                } else if (result.error) {
                    errorMessage = result.error;
                }
                
                setError(errorMessage);
                return false;
            }
        } catch (err) {
            setError('Ошибка соединения с сервером');
            return false;
        } finally {
            setLoading(false);
        }
    }, []);

    return {
        loading,
        error,
        completeAppointment,
        clearError
    };
};
