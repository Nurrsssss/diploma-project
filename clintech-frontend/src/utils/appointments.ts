import { KZ_TZ } from './date';

/**
 * Полный информационный объект о статусе записи
 */
export interface AppointmentStatusInfo {
    // Основная информация
    status: string;                    // Оригинальный статус из БД
    actualStatus: string;              // Актуальный статус с учетом времени
    statusText: string;                // Статус на русском языке
    statusColor: string;               // CSS классы для цвета
    isActive: boolean;                 // Активна ли запись (не отменена, не завершена)
    isCompleted: boolean;              // Завершена ли запись
    isCancelled: boolean;              // Отменена ли запись
    isPassed: boolean;                 // Прошло ли время записи
    isInProgress: boolean;             // Идет ли запись сейчас
    isUpcoming: boolean;               // Предстоит ли запись
    
    // Временная информация
    timeUntil: string;                 // "Через X д. Y ч. Z мин." или "Прошло X д. Y ч. Z мин."
    timeUntilShort: string;            // Короткая версия времени
    isToday: boolean;                  // Сегодня ли запись
    isPast: boolean;                   // Прошла ли запись по времени
    isFuture: boolean;                 // Будущая ли запись
    
    // Дополнительная информация
    canEdit: boolean;                  // Можно ли редактировать (для файлов, заметок и т.д.)
    canCancel: boolean;                // Можно ли отменить запись
    canJoin: boolean;                  // Можно ли присоединиться (для онлайн)
    urgency: 'high' | 'medium' | 'low' | 'none'; // Срочность (для уведомлений)
}

/**
 * УНИВЕРСАЛЬНЫЙ УТИЛИТ: Получает полную информацию о статусе записи
 * Объединяет все функции в один вызов
 * 
 * ПРИМЕР ИСПОЛЬЗОВАНИЯ:
 * 
 * const statusInfo = getAppointmentStatusInfo(appointment);
 * 
 * // Отображение статуса
 * statusInfo.statusColor - CSS классы для цвета
 * statusInfo.statusText - Статус на русском языке
 * 
 * // Отображение времени
 * statusInfo.timeUntil - "Через X д. Y ч. Z мин." или "Прошло X д. Y ч. Z мин."
 * statusInfo.timeUntilShort - Короткая версия времени
 * 
 * // Условная логика
 * statusInfo.canEdit - Можно ли редактировать файлы/заметки
 * statusInfo.canJoin - Можно ли присоединиться к онлайн встрече
 * statusInfo.isInProgress - Идет ли запись сейчас
 * 
 * // Уведомления по срочности
 * statusInfo.urgency - 'high' | 'medium' | 'low' | 'none'
 * 
 * // Проверка возможности действий
 * statusInfo.canCancel - Можно ли отменить запись
 * statusInfo.isActive - Активна ли запись (не отменена, не завершена)
 */
export const getAppointmentStatusInfo = (
    appointment: { 
        start_time: string; 
        end_time: string; 
        status: string; 
        patient_id?: string;
        appointment_type?: string;
    }, 
    selectedDate?: string
): AppointmentStatusInfo => {
    if (!appointment || !appointment.start_time || !appointment.end_time) {
        return {
            status: 'unknown',
            actualStatus: 'unknown',
            statusText: 'Неизвестно',
            statusColor: 'bg-gray-100 text-gray-800',
            isActive: false,
            isCompleted: false,
            isCancelled: false,
            isPassed: false,
            isInProgress: false,
            isUpcoming: false,
            timeUntil: 'Время не указано',
            timeUntilShort: 'Н/Д',
            isToday: false,
            isPast: false,
            isFuture: false,
            canEdit: false,
            canCancel: false,
            canJoin: false,
            urgency: 'none'
        };
    }

    // Получаем актуальный статус
    const actualStatus = getActualSlotStatus(appointment, selectedDate) || appointment.status;
    
    // Проверяем временные состояния
    const isInProgress = isSlotInProgress(appointment, selectedDate);
    
    // Определяем дату записи
    const appointmentDate = appointment.start_time.split('T')[0];
    const today = new Date().toLocaleDateString('en-CA');
    const isToday = appointmentDate === today;
    
    // Вычисляем время до/после записи
    const timeUntil = getTimeUntilAppointment(appointment.start_time);
    
    // Вычисляем разность времени для определения прошлого/будущего
    // Используем правильный парсинг ISO строки с учетом часового пояса
    const now = new Date();
    const appointmentStartTime = new Date(appointment.start_time);
    const appointmentEndTime = new Date(appointment.end_time);
    
    const diffMs = appointmentStartTime.getTime() - now.getTime();
    
    // Создаем короткую версию времени
    const timeUntilShort = (() => {
        const absDiffMs = Math.abs(diffMs);
        const totalMinutes = Math.floor(absDiffMs / (1000 * 60));
        
        if (absDiffMs < 5 * 60 * 1000) return 'Сейчас';
        
        const hoursLeft = Math.floor(totalMinutes / 60);
        const minutesLeft = totalMinutes % 60;
        
        if (diffMs < 0) {
            return `Прошло ${hoursLeft > 0 ? `${hoursLeft}ч ` : ''}${minutesLeft}мин`;
        } else {
            return `Через ${hoursLeft > 0 ? `${hoursLeft}ч ` : ''}${minutesLeft}мин`;
        }
    })();
    
    // Определяем булевы состояния
    const isCompleted = actualStatus === 'completed';
    const isCancelled = actualStatus === 'cancelled';
    const isActive = !isCompleted && !isCancelled;
    const isPast = diffMs < 0;
    const isFuture = diffMs > 0;
    const isUpcoming = isFuture && !isInProgress;
    
    // Обновляем isPassed на основе обновленной функции
    const isPassed = isSlotPassed(appointment, selectedDate);
    
    // Определяем возможности
    const forbiddenStatuses = ['завершено', 'прошедший', 'completed', 'passed'];
    const canEdit = !forbiddenStatuses.includes(actualStatus.toLowerCase());
    const canCancel = isActive && !isInProgress && !isCompleted && !isPassed;
    const canJoin = appointment.appointment_type === 'online' && isInProgress;
    
    // Определяем срочность
    const urgency = (() => {
        if (isInProgress) return 'high';
        if (isToday && isFuture) {
            const hoursUntil = Math.floor(Math.abs(diffMs) / (1000 * 60 * 60));
            if (hoursUntil <= 1) return 'high';
            if (hoursUntil <= 3) return 'medium';
        }
        return 'low';
    })();
    
    return {
        status: appointment.status,
        actualStatus,
        statusText: getStatusText(actualStatus),
        statusColor: getStatusColor(actualStatus),
        isActive,
        isCompleted,
        isCancelled,
        isPassed,
        isInProgress,
        isUpcoming,
        timeUntil,
        timeUntilShort,
        isToday,
        isPast,
        isFuture,
        canEdit,
        canCancel,
        canJoin,
        urgency
    };
};

// Вспомогательная функция для вычисления времени до/после приема
const getTimeUntilAppointment = (startTime: string) => {
    const now = new Date();
    // Используем правильный парсинг ISO строки с учетом часового пояса
    const appointmentTime = new Date(startTime);
    
    const diffMs = appointmentTime.getTime() - now.getTime();
    const absDiffMs = Math.abs(diffMs);
    const totalMinutes = Math.floor(absDiffMs / (1000 * 60));
    const days = Math.floor(totalMinutes / (60 * 24));
    const hoursLeft = Math.floor((totalMinutes % (60 * 24)) / 60);
    const minutesLeft = totalMinutes % 60;
    
    if (absDiffMs < 5 * 60 * 1000) {
        return 'Сейчас идёт!';
    }
    
    const parts = [];
    if (days > 0) parts.push(`${days} д.`);
    if (hoursLeft > 0) parts.push(`${hoursLeft} ч.`);
    if (minutesLeft > 0) parts.push(`${minutesLeft} мин.`);
    const diffString = parts.join(' ');
    
    if (diffMs < 0) {
        return `Прошло ${diffString}`;
    } else {
        return `Через ${diffString}`;
    }
};

export const getStatusColor = (status: string) => {
    switch (status) {
        case 'available': return 'bg-green-100 text-green-800'
        case 'booked': return 'bg-orange-100 text-orange-800'
        case 'completed': return 'bg-blue-100 text-blue-800'
        case 'passed': return 'bg-gray-100 text-gray-600'
        default: return 'bg-gray-100 text-gray-800'
    }
}

export const getStatusText = (status: string) => {
    switch (status) {
        case 'available': return 'Свободно'
        case 'booked': return 'Забронировано'
        case 'completed': return 'Завершено'
        case 'canceled': return 'Отменено'
        case 'passed': return 'Прошедший'
        default: return status
    }
}

export const getActualSlotStatus = (slot: { start_time: string; end_time: string; status: string; patient_id?: string }, selectedDate?: string): string | null => {
    if (!slot || !slot.start_time || !slot.end_time) return null;

    // Если запись уже отменена или завершена, возвращаем как есть
    if (slot.status === 'cancelled' || slot.status === 'canceled') return 'cancelled';
    if (slot.status === 'completed') return slot.status;

    const now = new Date();
    
    // Парсим время из ISO строки напрямую (учитывая часовой пояс)
    const slotStartTime = new Date(slot.start_time);
    const slotEndTime = new Date(slot.end_time);

    // Проверяем, прошло ли время окончания записи
    if (now > slotEndTime) {
        // Запись прошла
        if (slot.status === 'booked' || slot.patient_id) return 'completed';
        if (slot.status === 'available') return 'passed';
        return slot.status;
    }

    // Если время еще не прошло, возвращаем оригинальный статус
    // ВАЖНО: для записей со статусом 'booked' возвращаем 'booked', чтобы кнопка переноса работала
    return slot.status;
}

export const isSlotPassed = (slot: { start_time: string; end_time: string }, selectedDate?: string): boolean => {
    const now = new Date();
    // Парсим время из ISO строки напрямую (учитывая часовой пояс)
    const slotEndTime = new Date(slot.end_time);
    return now > slotEndTime;
}

export const isSlotInProgress = (slot: { start_time: string; end_time: string }, selectedDate?: string): boolean => {
    const now = new Date();
    // Парсим время из ISO строки напрямую (учитывая часовой пояс)
    const slotStartTime = new Date(slot.start_time);
    const slotEndTime = new Date(slot.end_time);
    
    // Проверяем, находится ли текущее время между началом и концом записи
    return now >= slotStartTime && now <= slotEndTime;
}

export const getPaymentStatusColor = (status?: string) => {
    switch (status) {
        case 'paid': return 'bg-green-100 text-green-800'
        case 'pending': return 'bg-yellow-100 text-yellow-800'
        case 'failed': return 'bg-red-100 text-red-800'
        default: return 'bg-gray-100 text-gray-800'
    }
}

export const getPaymentStatusText = (status?: string) => {
    switch (status) {
        case 'paid': return 'Оплачено'
        case 'pending': return 'Ожидает оплаты'
        case 'failed': return 'Ошибка оплаты'
        default: return 'Не указано'
    }
}

export const getAppointmentTypeText = (type: string) => {
    switch (type) {
        case 'online': return 'Онлайн'
        case 'offline': return 'Оффлайн'
        case 'both': return 'Любой формат'
        default: return type
    }
}

export const formatAppointmentTime = (dateString: string) => {
    try {
        return new Date(dateString).toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: KZ_TZ,
        })
    } catch {
        return 'Не указано'
    }
}