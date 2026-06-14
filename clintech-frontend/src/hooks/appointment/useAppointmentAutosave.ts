import { useState, useCallback, useRef, useEffect } from 'react';

export interface UseAppointmentAutosaveReturn {
    saveNotes: (appointmentId: string, notes: string) => Promise<boolean>;
    isSaving: boolean;
    lastSaved: Date | null;
    error: string | null;
    clearError: () => void;
}

export const useAppointmentAutosave = (
    debounceMs: number = 2000 // Автосохранение через 2 секунды после остановки ввода
): UseAppointmentAutosaveReturn => {
    const [isSaving, setIsSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [error, setError] = useState<string | null>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastNotesRef = useRef<string>('');

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    const saveNotes = useCallback(async (appointmentId: string, notes: string): Promise<boolean> => {
        // Не сохраняем, если заметки не изменились
        if (notes === lastNotesRef.current) {
            return true;
        }

        try {
            setIsSaving(true);
            setError(null);

            const response = await fetch(`/api/appointments/${appointmentId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    doctor_notes: notes
                })
            });

            const result = await response.json();

            if (response.ok && result.success !== false) {
                lastNotesRef.current = notes;
                setLastSaved(new Date());
                return true;
            } else {
                setError(result.error || 'Ошибка при сохранении заметок');
                return false;
            }
        } catch (err) {
            setError('Ошибка соединения с сервером');
            return false;
        } finally {
            setIsSaving(false);
        }
    }, []);

    // Функция для автосохранения с дебаунсингом
    const scheduleAutosave = useCallback((appointmentId: string, notes: string) => {
        // Очищаем предыдущий таймер
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        // Устанавливаем новый таймер
        timeoutRef.current = setTimeout(() => {
            saveNotes(appointmentId, notes);
        }, debounceMs);
    }, [saveNotes, debounceMs]);

    // Очищаем таймер при размонтировании
    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    return {
        saveNotes: useCallback((appointmentId: string, notes: string) => {
            scheduleAutosave(appointmentId, notes);
            return Promise.resolve(true); // Возвращаем Promise для совместимости
        }, [scheduleAutosave]),
        isSaving,
        lastSaved,
        error,
        clearError
    };
};
