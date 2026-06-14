import { useState, useCallback } from 'react';
import { extractApiError, processError } from '@/utils/errorUtils';

export interface IRegisterCredentials {
  password: string;
  role: string;
  phone: string;
  email?: string;
}

export interface IRegisterResult {
  success: boolean;
  message?: string;
}

interface IUseRegisterReturn {
  register: (credentials: IRegisterCredentials) => Promise<IRegisterResult>;
  loading: boolean;
  error: string | null;
  clearError: () => void;
}

export const useRegister = (): IUseRegisterReturn => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const register = useCallback(async (credentials: IRegisterCredentials): Promise<IRegisterResult> => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      if (response.ok) {
        try {
          const data = await response.json();
          return {
            success: true,
            message: data.message || 'Регистрация прошла успешно',
          };
        } catch {
          return {
            success: true,
            message: 'Регистрация прошла успешно',
          };
        }
      } else {
        const fallbackMessage = processError(response, {
          400: 'Пользователь с таким номером уже существует. Попробуйте войти.',
          401: 'Ошибка авторизации. Пожалуйста, попробуйте заново.',
          500: 'Техническая ошибка сервера. Попробуйте позже.',
          default: 'Произошла ошибка при регистрации',
        });
        const apiMessage = await extractApiError(response);
        const errorMessage =
          apiMessage && apiMessage !== `Ошибка ${response.status}` ? apiMessage : fallbackMessage;

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
      setLoading(false);
    }
  }, []);

  return {
    register,
    loading,
    error,
    clearError,
  };
};