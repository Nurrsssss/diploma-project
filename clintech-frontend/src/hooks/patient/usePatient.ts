// import { useState, useEffect, useCallback, useMemo } from 'react';
// import { TPatient } from '@/types/patient';
// import { useAuth } from '@/hooks/auth/useAuth';
// import { useAuthenticatedFetch } from '../auth/useAuthenticatedFetch';

// interface UsePatientResult {
//   patient: TPatient | null;
//   loading: boolean;
//   error: string | null;
//   updating: boolean;
//   refetch: () => void;
//   refetchAppointments: (date?: string) => void;
//   updatePatient: (data: TPatient) => Promise<boolean>;
// }

// export const usePatient = (userId: string | null, skipAppointments: boolean = false): UsePatientResult => {
//   const [patient, setPatient] = useState<TPatient | null>(null);
//   const [loading, setLoading] = useState(false);
//   const [updating, setUpdating] = useState(false);
//   const [error, setError] = useState<string | null>(null);
//   const { session } = useAuth();
//   const authenticatedFetch = useAuthenticatedFetch();

//   // Мемоизируем стабильные значения для предотвращения лишних пересозданий
//   const sessionData = useMemo(() => ({
//     isLoggedIn: session?.isLoggedIn,
//     role: session?.role,
//     userId: session?.user_id
//   }), [session?.isLoggedIn, session?.role, session?.user_id]);

//   const fetchPatient = useCallback(async () => {
//     if (!userId) {
//       setPatient(null);
//       setLoading(false);
//       setError('Не указан ID пользователя');
//       return;
//     }

//     if (!sessionData.isLoggedIn) {
//       setPatient(null);
//       setLoading(false);
//       setError('Пользователь не авторизован');
//       return;
//     }

//     // ✅ Врач тоже должен иметь доступ к данным пациента
//     if (sessionData.role !== 'patient' && sessionData.role !== 'doctor') {
//       setPatient(null);
//       setLoading(false);
//       setError(`Доступ запрещен. Требуется роль patient или doctor, а у вас: ${sessionData.role}`);
//       return;
//     }

//     try {
//       setLoading(true);
//       setError(null);

//       const response = await authenticatedFetch(`/api/users/${userId}/patient`, {
//         method: 'GET',
//         headers: {
//           'Content-Type': 'application/json',
//         }
//       });

//       if (!response.ok) {
//         throw new Error(`Ошибка получения данных пациента: ${response.status}`);
//       }

//       const data = await response.json();

//       if (data.success && data.data) {
//         const newPatient = { ...data.data, appointments: data.data.appointments || [] };
//         setPatient(newPatient);
//       } else if (data.id) {
//         // Если структура ответа простая (без success/data)
//         const newPatient = { ...data, appointments: data.appointments || [] };
//         setPatient(newPatient);
//       } else {
//         throw new Error(data.message || 'Не удалось получить данные пациента');
//       }
//     } catch (err) {
//       setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
//       setPatient(null);
//     } finally {
//       setLoading(false);
//     }
//   }, [userId, sessionData.isLoggedIn, sessionData.role, authenticatedFetch]);

//   const fetchAppointments = useCallback(async (date?: string) => {
    
//     if (!userId || !sessionData.userId || skipAppointments) {
//       return;
//     }

//     try {
//       const url = date ? `/api/appointments?date=${date}` : '/api/appointments';

//       const response = await authenticatedFetch(url, {
//         method: 'GET',
//         headers: {
//           'Content-Type': 'application/json',
//         }
//       });

//       if (!response.ok) {
//         throw new Error(`Ошибка получения записей: ${response.status}`);
//       }

//       const data = await response.json();

//       if (data.success && Array.isArray(data.data)) {
//         // Обновляем записи в объекте пациента
//         setPatient(prev => {
//           const updated = prev ? { ...prev, appointments: data.data } : null;
//           return updated;
//         });
//       } else if (Array.isArray(data)) {
//         // Поддерживаем простой формат массива
//         setPatient(prev => {
//           const updated = prev ? { ...prev, appointments: data } : null;
//           return updated;
//         });
//       } else if (data.error) {
//         console.error('Ошибка загрузки записей:', data.error);
//       } else {
//         // Unexpected data format
//       }
//     } catch (err) {
//       console.error('Ошибка загрузки записей:', err);
//     }
//   }, [userId, sessionData.userId, skipAppointments, authenticatedFetch]);

//   // ✅ Загружаем пациента только когда есть userId и сессия инициализирована
//   useEffect(() => {
//     if (userId && sessionData.isLoggedIn && sessionData.role) {
//       fetchPatient();
//     }
//   }, [userId, sessionData.isLoggedIn, sessionData.role, fetchPatient]);

//   const refetch = useCallback(() => {
//     fetchPatient();
//   }, [fetchPatient]);

//   const refetchAppointments = useCallback((date?: string) => {
//     fetchAppointments(date);
//   }, [fetchAppointments]);

//   const updatePatient = useCallback(async (data: TPatient): Promise<boolean> => {
//     if (!userId) {
//       setError('Нет данных авторизации - отсутствует userId');
//       return false;
//     }

//     if (!sessionData.isLoggedIn) {
//       setError('Пользователь не авторизован');
//       return false;
//     }

//     try {
//       setUpdating(true);
//       setError(null);

//       const response = await authenticatedFetch(`/api/users/${userId}/patient`, {
//         method: 'PUT',
//         headers: {
//           'Content-Type': 'application/json',
//         },
//         body: JSON.stringify(data)
//       });

//       const responseData = await response.json();

//       if (!response.ok) {
//         throw new Error(responseData.message || responseData.error || `Ошибка обновления пациента: ${response.status}`);
//       }

//       if (responseData.success || responseData.id) {
//         // Обновляем локальное состояние с данными из сервера
//         if (responseData.data) {
//           setPatient(responseData.data);
//         } else if (responseData.id) {
//           // Если ответ содержит данные напрямую
//           setPatient(responseData);
//         }
//         return true;
//       } else {
//         throw new Error(responseData.message || responseData.error || 'Не удалось обновить данные пациента');
//       }
//     } catch (err) {
//       setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
//       return false;
//     } finally {
//       setUpdating(false);
//     }
//   }, [userId, sessionData.isLoggedIn, authenticatedFetch]);

//   // Загружаем записи после загрузки пациента (без фильтра по дате)
//   useEffect(() => {
    
//     if (patient && patient.id && !skipAppointments) {
//       fetchAppointments(); // Загружаем записи на текущую дату
//     }
//   }, [patient?.id, fetchAppointments, skipAppointments]);

//   return {
//     patient,
//     loading,
//     updating,
//     error,
//     refetch,
//     refetchAppointments,
//     updatePatient
//   };
// };

import { useEffect, useState, useCallback } from 'react'
import { TPatient } from '@/types/patient'

export function usePatient(userId: string | null, enabled: boolean = true) {
  const [patient, setPatient] = useState<TPatient | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchPatient = useCallback(async () => {
    if (!enabled || !userId) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/users/${userId}/patient`, { cache: 'no-store' })
      const data = await res.json().catch(() => null)

      if (!res.ok) {
        const msg = data?.error || data?.message || `Ошибка получения данных пациента: ${res.status}`
        setPatient(null)
        setError(msg)
        return
      }

      const payload = data?.data ?? data
      setPatient(payload ?? null)
    } catch (e: any) {
      setPatient(null)
      setError(e?.message || 'Ошибка сети при получении пациента')
    } finally {
      setLoading(false)
    }
  }, [enabled, userId])

  useEffect(() => {
    fetchPatient()
  }, [fetchPatient])

  return { patient, loading, error, refetch: fetchPatient }
}