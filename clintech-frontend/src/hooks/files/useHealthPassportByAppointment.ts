import { useState, useCallback, useEffect } from 'react';
import { useAuthenticatedFetch } from '../auth/useAuthenticatedFetch';
import { HealthPassport } from '@/types/healthPassport';

interface UseHealthPassportByAppointmentReturn {
    passport: HealthPassport | null;
    loading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
}

export const useHealthPassportByAppointment = (appointmentId: string | null): UseHealthPassportByAppointmentReturn => {
    const [passport, setPassport] = useState<HealthPassport | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const authenticatedFetch = useAuthenticatedFetch();

    const fetchPassport = useCallback(async () => {
        if (!appointmentId) {
            setPassport(null);
            setLoading(false);
            setError(null);
            return;
        }

        try {
            setLoading(true);
            setError(null);

            const response = await authenticatedFetch(`/api/health-passport/appointment/${appointmentId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                if (response.status === 404) {
                    // Паспорт не найден - это нормально
                    setPassport(null);
                    return;
                }
                throw new Error(`Ошибка получения паспорта: ${response.status}`);
            }

            const data = await response.json();
            setPassport(data);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Ошибка при получении паспорта здоровья';
            console.error('useHealthPassportByAppointment: Error:', err);
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    }, [appointmentId, authenticatedFetch]);

    useEffect(() => {
        fetchPassport();
    }, [fetchPassport]);

    return {
        passport,
        loading,
        error,
        refetch: fetchPassport
    };
}; 