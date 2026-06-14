import { TAppointment } from '@/types/appointments';
import { useState, useEffect, useCallback } from 'react';
import { useDoctor } from '../doctor/useDoctor';

export function useAppointmentById(id: string | undefined) {
    const [appointment, setAppointment] = useState<TAppointment | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const { doctor, loading: doctorLoading } = useDoctor(appointment?.doctor_id);

    const fetchAppointment = useCallback(async () => {
        if (!id) return;

        setLoading(true);
        try {
            const res = await fetch(`/api/appointments/${id}`);
            const data = await res.json();
            setAppointment(data.data);
            setError(null);
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : 'Ошибка загрузки приёма';
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        fetchAppointment();
    }, [fetchAppointment]);

    return { appointment, loading, error, doctor, doctorLoading, refetch: fetchAppointment };
}