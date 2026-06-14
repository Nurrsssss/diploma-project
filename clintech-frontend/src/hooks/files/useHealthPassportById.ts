import { useState, useCallback, useEffect } from 'react';
import { useAuthenticatedFetch } from '@/hooks/auth/useAuthenticatedFetch';
import { HealthPassport } from '@/types/healthPassport';

interface UseHealthPassportByIdReturn {
    passport: HealthPassport | null;
    loading: boolean;
    error: string | null;
    refetch: () => void;
}

export const useHealthPassportById = (passportId: string | null): UseHealthPassportByIdReturn => {
    const [passport, setPassport] = useState<HealthPassport | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const authenticatedFetch = useAuthenticatedFetch();

    const fetchPassport = useCallback(async () => {
        if (!passportId) {
            setPassport(null);
            setLoading(false);
            setError(null);
            return;
        }

        try {
            setLoading(true);
            setError(null);

            const response = await authenticatedFetch(`/api/health-passport/${passportId}`, {
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
            console.error('useHealthPassportById: Error:', err);

            try {
                if (typeof window !== 'undefined') {
                    const raw = localStorage.getItem('healthPassports');
                    const parsed = raw ? JSON.parse(raw) : [];
                    const localPassport = Array.isArray(parsed)
                        ? parsed.find((item: any) => item?.id === passportId) || null
                        : null;

                    if (localPassport) {
                        setPassport(localPassport);
                        setError(null);
                        return;
                    }
                }
            } catch (localError) {
                console.error('useHealthPassportById: Local fallback error:', localError);
            }

            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    }, [passportId, authenticatedFetch]);

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