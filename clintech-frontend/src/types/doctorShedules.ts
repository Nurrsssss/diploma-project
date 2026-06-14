import { TScheduleDay } from './calendar';

// main from db
export type TDoctorSchedule = {
    id: string;
    doctor_id: string;
    name: string;
    // Старый формат (для обратной совместимости)
    start_time?: string;
    end_time?: string;
    break_start?: string;
    break_end?: string;
    work_days?: number[]; // Массив чисел, как приходит с сервера
    // Новый формат (детальное расписание)
    days?: TScheduleDay[];
    // Общие поля
    slot_duration: number; // default 30
    slot_title?: string;
    is_active?: boolean; // default true
    created_at?: string;
    updated_at?: string;
    appointment_format: string; // default "offline"
    // Обязательные поля для создания приемов
    slots_start_date: string;
    slots_end_date: string;
}

// main from db
export type TScheduleException = {
    id: string;
    doctor_id: string;
    date: string; //date
    type: string;
    custom_start_time?: string;
    custom_end_time?: string;
    reason?: string;
    created_at?: string;
    updated_at?: string;
}