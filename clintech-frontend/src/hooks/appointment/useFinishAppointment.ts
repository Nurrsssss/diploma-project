import { useState, useCallback } from 'react';
import { useAuthenticatedFetch } from '../auth/useAuthenticatedFetch';

interface FinishAppointmentData {
    doctor_notes?: string;
    status?: string;
}

interface UseFinishAppointmentReturn {
    isFinishing: boolean;
    error: string | null;
    finishAppointment: (appointmentId: string, data: FinishAppointmentData) => Promise<boolean>;
    clearError: () => void;
}

export const useFinishAppointment = (): UseFinishAppointmentReturn => {
    const [isFinishing, setIsFinishing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const authenticatedFetch = useAuthenticatedFetch();

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    const finishAppointment = useCallback(async (appointmentId: string, data: FinishAppointmentData): Promise<boolean> => {
        try {
            setIsFinishing(true);
            setError(null);

            const response = await authenticatedFetch(`/api/appointments/${appointmentId}/finish`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('useFinishAppointment: Error response:', errorText);
                throw new Error(`Ошибка завершения приёма: ${response.status} - ${errorText}`);
            }

            const result = await response.json();

            return true;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Ошибка при завершении приёма';
            console.error('useFinishAppointment: Finish error:', err);
            setError(errorMessage);
            return false;
        } finally {
            setIsFinishing(false);
        }
    }, [authenticatedFetch]);

    return {
        isFinishing,
        error,
        finishAppointment,
        clearError
    };
}; 