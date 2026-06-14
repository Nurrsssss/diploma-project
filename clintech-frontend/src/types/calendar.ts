export type TSlot = {
    id: string;
    start_time: string;
    end_time: string;
    appointment_type: "online" | "offline" | "both";
    duration_minutes: number;
    title: string;
    status: "available" | "booked" | "cancelled" | "blocked";
    schedule_id: string;
    doctor_id: string;
    price?: number;
    created_at: string;
    updated_at: string;
    date?: string; // Дата слота (YYYY-MM-DD)
    // Информация о пациенте для забронированных слотов
    patient_id?: string;
    patient_name?: string;
    patient_phone?: string;
    appointment_id?: string;
};

export type TAvailableSlot = {
    id: string;
    doctor_id: string;
    date: string;
    start_time: string;
    end_time: string;
    appointment_type: "online" | "offline" | "both";
    duration_minutes: number;
    title: string;
    status?: "available" | "booked"; // Опционально, если API не всегда возвращает
    schedule_id?: string; // Опционально
    price?: number; // Опционально
};

export type TSlotForm = {
    schedule_id: string;
    start_date: string;
    end_date: string;
};

export interface TCalendarAppointment {
    appointment_type: string;
    created_at: string;
    description: string;
    end_time: string;
    id: string;
    patient_id: string;
    specialist_id: string;
    start_time: string;
    status: string;
    title: string;
    updated_at: string;
    patient_notes?: string; // Добавляем поле для заметок пациента
}

// Новый тип для детального дня недели
export type TScheduleDay = {
    day_of_week: number; // 1-7 (понедельник-воскресенье)
    start_time: string;
    end_time: string;
    break_start?: string | null;
    break_end?: string | null;
    is_working_day: boolean;
};

// Обновленный тип для поддержки обоих форматов
export type TScheduleFormValues = {
    id?: string;
    doctor_id?: string;
    name: string;
    // Старый формат (для обратной совместимости)
    start_time?: string;
    end_time?: string;
    break_start?: string | null;
    break_end?: string | null;
    work_days?: number[]; // Массив чисел, как ожидает API
    // Новый формат (детальное расписание)
    days?: TScheduleDay[];
    // Общие поля
    slot_duration: number;
    slot_title?: string;
    is_active?: boolean;
    appointment_format: string;
    // Обязательные поля для создания приемов
    slots_start_date: string; // Дата начала периода
    slots_end_date: string;   // Дата окончания периода
};

// Новый тип для ответа при создании расписания
export type TScheduleCreateResponse = {
    success: boolean;
    data: {
        schedule: any; // Расписание
        slots: {
            slots_created: number;
            message: string;
        };
    };
};

export type TSlotFormData = {
    start_time: string;
    end_time: string;
    appointment_type: "online" | "offline" | "both";
    duration_minutes: number;
    title: string;
    status?: "available" | "booked" | "cancelled" | "blocked";
    price?: number;
};

export type TSlotsResponse = {
    success: boolean;
    data: TSlot[];
    message?: string;
};

export type TSlotFormValues = {
    schedule_id: string;
    start_time: string;
    end_time: string;
    start_date: string;
    end_date: string;
    appointment_type: "online" | "offline" | "both";
    duration_minutes: number;
    title: string;
    price?: number;
};


