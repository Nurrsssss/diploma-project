import { useState, useCallback } from 'react';
import { TSlot, TSlotFormData, TSlotsResponse } from '@/types/calendar';
import { useAuth } from '@/context/AuthContext';
import { useAuthenticatedFetch } from '@/hooks/auth/useAuthenticatedFetch';

interface UseDoctorSlotsResult {
    slots: TSlot[];
    loading: boolean;
    error: string | null;

    // Состояния для конкретных операций
    updating: boolean;
    deleting: boolean;
    deletingAll: boolean;

    // Методы - обновлены для работы с schedules
    fetchSlots: (scheduleId: string, date?: string) => Promise<void>;
    updateSlot: (scheduleId: string, slotId: string, slotData: TSlotFormData) => Promise<boolean>;
    deleteSlot: (scheduleId: string, slotId: string) => Promise<boolean>;
    deleteAllSlots: (scheduleId: string) => Promise<boolean>;
    createSlot: (scheduleId: string, slotData: TSlotFormData) => Promise<boolean>;
    refetch: () => void;
}

export const useDoctorSlots = (): UseDoctorSlotsResult => {
    const [slots, setSlots] = useState<TSlot[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    // Сохраняем последние параметры для refetch
    const [lastParams, setLastParams] = useState<{
        scheduleId?: string;
        date?: string;
    }>({});

    // Состояния для конкретных операций
    const [updating, setUpdating] = useState<boolean>(false);
    const [deleting, setDeleting] = useState<boolean>(false);
    const [deletingAll, setDeletingAll] = useState<boolean>(false);

    const { isLoggedIn } = useAuth();
    const authenticatedFetch = useAuthenticatedFetch();

    const fetchSlots = useCallback(async (scheduleId: string, date?: string) => {
        if (!isLoggedIn) {
            setSlots([]);
            setLoading(false);
            setError(null);
            return;
        }

        if (!scheduleId) {
            setError('Schedule ID обязателен');
            return;
        }

        try {
            setLoading(true);
            setError(null);

            // Сохраняем параметры для refetch
            setLastParams({ scheduleId, date });

            // Строим URL с параметрами
            let url = `/api/appointments/schedules/${scheduleId}/slots`;
            if (date) {
                url += `?date=${encodeURIComponent(date)}`;
            }

            const response = await authenticatedFetch(url, {
                method: 'GET'
            });

            if (!response.ok) {
                throw new Error(`Ошибка получения слотов: ${response.status}`);
            }

            const data: TSlotsResponse = await response.json();

            if (data.success && Array.isArray(data.data)) {
                setSlots(data.data);
            } else if (Array.isArray(data)) {
                // Совместимость с разными форматами ответов
                setSlots(data as TSlot[]);
            } else {
                throw new Error(data.message || 'Не удалось получить слоты');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
            setSlots([]);
        } finally {
            setLoading(false);
        }
    }, [isLoggedIn, authenticatedFetch]);

    const createSlot = useCallback(async (scheduleId: string, slotData: TSlotFormData): Promise<boolean> => {
        if (!isLoggedIn) {
            setError('Нет авторизации');
            return false;
        }

        if (!scheduleId) {
            setError('Schedule ID обязателен');
            return false;
        }

        try {
            setUpdating(true);
            setError(null);

            const response = await authenticatedFetch(`/api/appointments/schedules/${scheduleId}/slots`, {
                method: 'POST',
                body: JSON.stringify(slotData)
            });

            if (!response.ok) {
                throw new Error(`Ошибка создания слота: ${response.status}`);
            }

            const data = await response.json();

            if (data.success) {
                // Обновляем локальное состояние
                const newSlot = data.data || { ...slotData, id: Date.now().toString() };
                setSlots(prev => [...prev, newSlot]);
                return true;
            } else {
                throw new Error(data.message || 'Не удалось создать слот');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
            return false;
        } finally {
            setUpdating(false);
        }
    }, [isLoggedIn, authenticatedFetch]);

    const updateSlot = useCallback(async (scheduleId: string, slotId: string, slotData: TSlotFormData): Promise<boolean> => {
        if (!isLoggedIn) {
            setError('Нет авторизации');
            return false;
        }

        if (!scheduleId || !slotId) {
            setError('Schedule ID и Slot ID обязательны');
            return false;
        }

        try {
            setUpdating(true);
            setError(null);

            const response = await authenticatedFetch(`/api/appointments/schedules/${scheduleId}/slots/${slotId}`, {
                method: 'PUT',
                body: JSON.stringify(slotData)
            });

            if (!response.ok) {
                throw new Error(`Ошибка обновления слота: ${response.status}`);
            }

            const data = await response.json();

            if (data.success) {
                // Обновляем локальное состояние
                setSlots(prev =>
                    prev.map(slot =>
                        slot.id === slotId
                            ? { ...slot, ...slotData, updated_at: new Date().toISOString() }
                            : slot
                    )
                );
                return true;
            } else {
                throw new Error(data.message || 'Не удалось обновить слот');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
            return false;
        } finally {
            setUpdating(false);
        }
    }, [isLoggedIn, authenticatedFetch]);

    const deleteSlot = useCallback(async (scheduleId: string, slotId: string): Promise<boolean> => {
        if (!isLoggedIn) {
            setError('Нет авторизации');
            return false;
        }

        if (!scheduleId || !slotId) {
            setError('Schedule ID и Slot ID обязательны');
            return false;
        }

        try {
            setDeleting(true);
            setError(null);

            // Оптимистичное обновление - удаляем сразу
            const previousSlots = slots;
            setSlots(prev => prev.filter(slot => slot.id !== slotId));

            const response = await authenticatedFetch(`/api/appointments/schedules/${scheduleId}/slots/${slotId}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                // Возвращаем обратно если ошибка
                setSlots(previousSlots);
                throw new Error(`Ошибка удаления слота: ${response.status}`);
            }

            const data = await response.json();

            if (!data.success) {
                // Возвращаем обратно если backend вернул ошибку
                setSlots(previousSlots);
                throw new Error(data.message || 'Не удалось удалить слот');
            }

            return true;
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
            return false;
        } finally {
            setDeleting(false);
        }
    }, [isLoggedIn, authenticatedFetch, slots]);

    const deleteAllSlots = useCallback(async (scheduleId: string): Promise<boolean> => {
        if (!isLoggedIn) {
            setError('Нет авторизации');
            return false;
        }

        if (!scheduleId) {
            setError('Schedule ID обязателен');
            return false;
        }

        try {
            setDeletingAll(true);
            setError(null);

            const response = await authenticatedFetch(`/api/appointments/schedules/${scheduleId}/slots`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw new Error(`Ошибка удаления всех слотов: ${response.status}`);
            }

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.message || 'Не удалось удалить все слоты');
            }

            setSlots([]);
            return true;
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
            return false;
        } finally {
            setDeletingAll(false);
        }
    }, [isLoggedIn, authenticatedFetch]);

    const refetch = useCallback(() => {
        if (lastParams.scheduleId) {
            fetchSlots(lastParams.scheduleId, lastParams.date);
        }
    }, [fetchSlots, lastParams]);

    return {
        slots,
        loading,
        error,
        updating,
        deleting,
        deletingAll,
        fetchSlots,
        updateSlot,
        deleteSlot,
        deleteAllSlots,
        createSlot,
        refetch
    };
}; 