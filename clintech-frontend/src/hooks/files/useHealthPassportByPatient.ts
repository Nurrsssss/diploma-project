import { useState, useCallback } from 'react';
import { useAuthenticatedFetch } from '../auth/useAuthenticatedFetch';
import { HealthPassport } from '@/types/healthPassport';

interface UseHealthPassportByPatientReturn {
    passports: HealthPassport[];
    loading: boolean;
    error: string | null;
    fetchPassports: (patientId: string) => Promise<void>;
    clearError: () => void;
}

export const useHealthPassportByPatient = (): UseHealthPassportByPatientReturn => {
    const [passports, setPassports] = useState<HealthPassport[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const authenticatedFetch = useAuthenticatedFetch();

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    const fetchPassports = useCallback(async (patientId: string) => {
        try {
            setLoading(true);
            setError(null);

            const response = await authenticatedFetch(`/api/health-passport/patient/${patientId}`);
            
            if (!response.ok) {
                throw new Error(`Ошибка получения паспортов: ${response.status}`);
            }

            const data: HealthPassport[] = await response.json();
            setPassports(data);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Ошибка при получении паспортов здоровья';
            setError(errorMessage);
            console.error('Health passports fetch error:', err);
        } finally {
            setLoading(false);
        }
    }, [authenticatedFetch]);

    return {
        passports,
        loading,
        error,
        fetchPassports,
        clearError
    };
}; 