import { useState, useCallback } from 'react';
import { DEFAULT_ERROR_MESSAGES, ErrorMessages, ApiResult } from '@/utils/errorUtils';

export const useFormError = () => {
  const [formError, setFormError] = useState<string>('');

  const handleError = useCallback((
    error: any, 
    customMessages?: ErrorMessages
  ) => {
    const messages = { ...DEFAULT_ERROR_MESSAGES, ...customMessages };
    
    if (error?.response?.status) {
      const status = error.response.status;
      const message = messages[status as keyof ErrorMessages] || messages.default;
      setFormError(message!);
    } else if (error?.message) {
      setFormError(error.message);
    } else {
      setFormError(messages.network!);
    }
  }, []);

  const handleApiResult = useCallback((
    result: ApiResult, 
    defaultErrorMessage?: string
  ) => {
    if (!result.success) {
      setFormError(result.message || defaultErrorMessage || DEFAULT_ERROR_MESSAGES.default!);
    }
  }, []);

  const clearError = useCallback(() => {
    setFormError('');
  }, []);

  return {
    formError,
    handleError,
    handleApiResult,
    clearError,
    setFormError // для кастомных случаев
  };
}; 