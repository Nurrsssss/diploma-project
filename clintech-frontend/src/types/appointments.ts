// main from db
export type TAppointment = {
    id: string;
    start_time: string;
    end_time: string;
    doctor_id: string;
    doctor_user_id?: string; // user_id врача для переноса записи (приходит с бэкенда)
    patient_id: string;
    title: string;
    status: "available" | "booked" | "cancelled" | "completed"; // default available
    appointment_type: string; // default offline
    meeting_link?: string;
    meeting_id?: string;
    patient_notes?: string;
    doctor_notes?: string;
    schedule_id?: string;
    anketa_id?: string; // ID анкеты пациента
    health_passport_id?: string; // ID паспорта здоровья
    created_at?: string;
    updated_at?: string;
    //нет в основном бд.  
    chat_answers?: TAnswer[]; //ответы с чата
    chat_recommendation?: TRecommendation[] //рекомендации с чата
    documents?: TDocument[] //прикрепленные документы
};

// Типы для запросов
export type TBookAppointmentRequest = {
    appointment_type: "offline" | "online";
    patient_notes?: string;
    anketa_id?: string; // Опционально - можно записаться без анкеты
};

export type TUpdateAppointmentRequest = {
    doctor_notes?: string;
    health_passport_id?: string; // НЕОБЯЗАТЕЛЬНО
};

//ответы с чата анкеты
type TAnswer = {
    id: string
    answer: string
}
//документы прикрепленные
type TDocument = {
    id: string
    name: string
    description: string
    url: string
    date: string
}
//рекомендация с анкеты
type TRecommendation = {
    id: string
    preDiagnosis: {
        id: string
        name: string
        description: string
    }[]
    recommendations: {
        id: string
        name: string
        description: string
    }[]
}

export type TDoctorAppointment = {
    id: string;
    start_time: string;
    end_time: string;
    appointment_type: "online" | "offline";
    status: "confirmed" | "pending" | "cancelled" | "completed" | "booked";
    patient_name?: string;
    patient_phone?: string;
    patient_email?: string;
    patient_notes?: string;
    payment_status?: "paid" | "pending" | "failed";
    payment_method?: string;
    created_at: string;
    updated_at: string;
    meeting_link?: string;
};