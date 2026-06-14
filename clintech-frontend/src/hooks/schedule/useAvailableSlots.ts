import { useAuth } from '@/context/AuthContext';
import { useAuthenticatedFetch } from '@/hooks/auth/useAuthenticatedFetch';
import { useState, useCallback, useEffect } from 'react';

interface AvailableSlot {
    id: string;
    start_time: string;
    end_time: string;
    is_available: boolean;
    status: string;
    doctor_id?: string;
    title?: string;
    duration_minutes?: number;
    appointment_type?: string;
    price?: number;
    patient_name?: string;
    patient_phone?: string;
}

interface AvailableSlotsResponse {
    slots: AvailableSlot[];
    success?: boolean;
    message?: string;
}

interface UseAvailableSlotsResult {
    slots: AvailableSlotsResponse | null;
    loading: boolean;
    error: string | null;
    fetchAvailableSlots: (doctorId: string, date?: string) => Promise<void>;
}

export const useAvailableSlots = (doctorId?: string, date?: string, altDoctorId?: string): UseAvailableSlotsResult => {
    const [slots, setSlots] = useState<AvailableSlotsResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { isLoggedIn } = useAuth();
    const authenticatedFetch = useAuthenticatedFetch();

    const fetchAvailableSlots = useCallback(async (doctorId: string, date?: string) => {
        if (!isLoggedIn || !doctorId) {
            setSlots(null);
            setLoading(false);
            setError(null);
            return;
        }

        try {
            setLoading(true);
            setError(null);

            let url = `/api/doctors/${doctorId}/available-slots`;
            const params = new URLSearchParams();
            if (date) {
                params.append('date', date);
            }
            if (altDoctorId && altDoctorId !== doctorId) {
                params.append('alt_doctor_id', altDoctorId);
            }
            if (params.toString()) {
                url += `?${params.toString()}`;
            }

            const response = await authenticatedFetch(url, {
                method: 'GET'
            });

            if (!response.ok) {
                let errorData;
                try {
                    errorData = await response.json();
                } catch {
                    errorData = { message: 'Некорректный ответ от сервера' };
                }
                throw new Error(`Ошибка получения доступных слотов (${response.status}): ${errorData.message || response.statusText}`);
            }

            const data = await response.json();

            if (data.success && Array.isArray(data.data)) {
                setSlots({
                    slots: data.data,
                    success: data.success,
                    message: data.message
                });
            } else {
                throw new Error(data.message || 'Не удалось получить доступные слоты');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
            setSlots(null);
        } finally {
            setLoading(false);
        }
    }, [isLoggedIn, authenticatedFetch, altDoctorId]);

    // Автоматическая загрузка при изменении doctorId или date
    useEffect(() => {
        if (doctorId && date) {
            fetchAvailableSlots(doctorId, date);
        }
    }, [doctorId, date, fetchAvailableSlots]);

    return {
        slots,
        loading,
        error,
        fetchAvailableSlots
    };
}; 