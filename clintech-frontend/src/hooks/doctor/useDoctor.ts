'use client'
import { useState, useEffect, useCallback } from 'react';
import { TDoctor } from '@/types/doctors';
import { useAuth } from '@/context/AuthContext';
import { useAuthenticatedFetch } from '../auth/useAuthenticatedFetch';
import { processError } from '@/utils/errorUtils';

interface IDoctorProfileData {
    first_name: string;
    middle_name: string;
    last_name: string;
    description: string;
    email?: string;
    avatar_url?: string;
    roles: string[];
    price?: number;
    education?: string[];
    certificates?: string[];
}

interface IUpdateResult {
    success: boolean;
    message?: string;
}

interface UseDoctorResult {
  doctor: TDoctor | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
  updateProfile: (userId: string, data: IDoctorProfileData) => Promise<IUpdateResult>;
  updateLoading: boolean;
}

export const useDoctor = (userId?: string | null): UseDoctorResult => {
  const [doctor, setDoctor] = useState<TDoctor | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updateLoading, setUpdateLoading] = useState(false);
  const { session, hydrated } = useAuth();
  const authenticatedFetch = useAuthenticatedFetch();

  const fetchDoctor = useCallback(async () => {
    // ✅ Если передан userId - используем его, иначе ждем полной гидратации сессии
    const shouldUseSessionId = !userId;
    const effectiveUserId = userId || session?.user_id;
    
    if (!effectiveUserId || (shouldUseSessionId && !hydrated)) {
      setDoctor(null);
      setLoading(false);
      setError(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const apiUrl = `/api/users/${effectiveUserId}/doctor`;
      
      // Добавляем повторные попытки для надежности
      let response;
      let retryCount = 0;
      const maxRetries = 2;
      
      while (retryCount <= maxRetries) {
        try {
          response = await authenticatedFetch(apiUrl, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            }
          });
          
          // Если получили успешный ответ, выходим из цикла
          if (response.ok) {
            break;
          }
          
          // Если 404, не повторяем
          if (response.status === 404) {
            break;
          }
          
          // Для других ошибок повторяем
          if (retryCount < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))); // Экспоненциальная задержка
            retryCount++;
          } else {
            break;
          }
        } catch (fetchError) {
          console.error('useDoctor: Fetch error:', fetchError);
          if (retryCount < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
            retryCount++;
          } else {
            throw fetchError;
          }
        }
      }

      if (!response) {
        throw new Error('Не удалось получить ответ от сервера');
      }

      if (!response.ok) {
        if (response.status === 404) {
          // Fallback данные для несуществующего врача
          setDoctor({
            id: effectiveUserId || 'unknown',
            user_id: effectiveUserId || 'unknown',
            first_name: 'Врач',
            last_name: 'не найден',
            middle_name: '',
            phone: session?.email || '', // используем session email как phone для совместимости
            email: session?.email || '', // добавляем email для совместимости
            description: 'Профиль врача не настроен. Обратитесь к администратору.',
            roles: ['Врач']
          });
          return;
        }
        throw new Error(`Ошибка получения данных врача: ${response.status} - ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success && data.data) {
        setDoctor(data.data);
      } else if (data.id) {
        // Если структура ответа простая (без success/data)
        setDoctor(data);
      } else {
        throw new Error(data.message || 'Не удалось получить данные врача');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Неизвестная ошибка';
      console.error('useDoctor: Error:', errorMessage);
      setError(errorMessage);
      
      // Fallback данные при ошибке
      setDoctor({
        id: effectiveUserId || 'unknown',
        user_id: effectiveUserId || 'unknown',
        first_name: 'Врач',
        last_name: 'не найден',
        middle_name: '',
        phone: session?.email || '', // используем session email как phone для совместимости
        email: session?.email || '', // добавляем email для совместимости
        description: 'Информация о враче временно недоступна',
        roles: ['Врач']
      });
    } finally {
      setLoading(false);
    }
  }, [userId, session?.user_id, session?.email, hydrated, authenticatedFetch]); // оставляем session?.email для совместимости

  const updateProfile = useCallback(async (targetUserId: string, data: IDoctorProfileData): Promise<IUpdateResult> => {
    try {
        setUpdateLoading(true);
        setError(null);

        const response = await authenticatedFetch(`/api/users/${targetUserId}/doctor`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });

        if (response.ok) {
            // ✅ После успешного обновления - обновляем локальные данные
            await fetchDoctor();
            
            return {
                success: true,
                message: 'Профиль доктора успешно обновлен',
            };
        } else {
            // Получаем детали ошибки
            const errorData = await response.json();
            const errorMessage = errorData.error || errorData.message || 'Произошла ошибка при обновлении профиля';
            
            // Логируем детали для отладки
            console.error('Ошибка обновления профиля:', {
                status: response.status,
                error: errorData
            });

            setError(errorMessage);
            return {
                success: false,
                message: errorMessage,
            };
        }
    } catch (err) {
        const errorMessage = 'Ошибка соединения с сервером. Проверьте интернет-подключение';
        setError(errorMessage);
        return {
            success: false,
            message: errorMessage,
        };
    } finally {
        setUpdateLoading(false);
    }
}, [authenticatedFetch, fetchDoctor]);

  useEffect(() => {
    fetchDoctor();
  }, [fetchDoctor]);

  const refetch = useCallback(() => {
    fetchDoctor();
  }, [fetchDoctor]);

  return {
    doctor,
    loading,
    error,
    refetch,
    updateProfile,
    updateLoading
  };
};

 