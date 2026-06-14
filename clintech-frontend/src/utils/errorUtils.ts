// src/utils/errorUtils.ts

export interface ErrorMessages {
    400?: string;
    401?: string;
    403?: string;
    404?: string;
    409?: string;
    500?: string;
    default?: string;
    network?: string;
}

export interface ApiResult {
    success: boolean;
    message?: string;
}

// Дефолтные сообщения об ошибках
export const DEFAULT_ERROR_MESSAGES: ErrorMessages = {
    400: 'Некорректные данные. Проверьте заполнение формы.',
    401: 'Ошибка авторизации. Пожалуйста, войдите заново.',
    403: 'Недостаточно прав для выполнения операции.',
    404: 'Запрашиваемый ресурс не найден.',
    409: 'Слоты на выбранные даты уже созданы. Выберите другой период.',
    500: 'Техническая ошибка сервера. Попробуйте позже.',
    default: 'Произошла неожиданная ошибка. Попробуйте еще раз.',
    network: 'Ошибка соединения с сервером. Проверьте интернет.'
};

export const processError = (
    response: any, 
    customMessages?: ErrorMessages
): string => {
    // Объединяем дефолтные и кастомные сообщения
    const messages = { ...DEFAULT_ERROR_MESSAGES, ...customMessages };
    
    const status = response?.status || response?.response?.status;
    
    if (status) {
        return messages[status as keyof ErrorMessages] || messages.default!;
    }
    
    return messages.network!;
};

/**
 * Парсит JSON ошибку и извлекает конкретный текст ошибки
 */
export const parseApiError = (errorText: string): string => {
    try {
        const parsed = JSON.parse(errorText);
        return parsed.error || parsed.message || errorText;
    } catch {
        return errorText;
    }
};

/**
 * Форматирует ошибку с общим контекстом и конкретной деталью
 */
export const formatErrorMessage = (context: string, detail: string): string => {
    const errorDetail = parseApiError(detail);
    return `${context}: ${errorDetail}`;
};

/**
 * Извлекает ошибку из ответа API с учетом разных форматов
 */
export const extractApiError = async (response: Response): Promise<string> => {
    try {
        const data = await response.json();
        
        // Проверяем разные возможные форматы ошибок
        if (data.error) return data.error;
        if (data.message) return data.message;
        if (data.details) return data.details;
        
        // Если это массив ошибок (validation errors)
        if (Array.isArray(data) && data.length > 0) {
            return data.map(err => err.message || err.error || err).join(', ');
        }
        
        // Если это объект с ошибками валидации
        if (data.errors && typeof data.errors === 'object') {
            const errorMessages = Object.values(data.errors).flat();
            return errorMessages.join(', ');
        }
        
        return `Ошибка ${response.status}`;
    } catch {
        return `Ошибка ${response.status}`;
    }
};

/**
 * Обрабатывает ошибку API и возвращает отформатированное сообщение
 */
export const handleApiError = async (
    response: Response, 
    context: string = 'Ошибка API',
    customMessages?: ErrorMessages
): Promise<string> => {
    const specificError = await extractApiError(response);
    const generalError = processError(response, customMessages);
    
    // Если конкретная ошибка отличается от общей, показываем обе
    if (specificError !== generalError && !generalError.includes(specificError)) {
        return formatErrorMessage(context, `${generalError}. ${specificError}`);
    }
    
    return formatErrorMessage(context, specificError);
};