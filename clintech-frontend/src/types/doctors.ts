import { TAppointment } from "./appointments"
// main from db
export type TDoctor = {
    id: string
    phone: string
    created_at?: string
    updated_at?: string
    user_id?: string
    first_name?: string
    middle_name: string
    last_name?: string
    description?: string
    email?: string // email теперь опциональный
    roles: string[]
    avatar_url?: string
    // Notes for backend: maybe we need to add some fields here?
    price?: number
    education?: string[];
    certificates?: string[];
    // from active_schedule
    schedule?: {
        day: string;
        hours: string;
    }[];
    contactInfo?: {
        department: string;
        address: string;
    };
    // for doctor appointments
    appointments?: TAppointment[];
}





export const doctorProfile: TDoctor = {
    id: "1",
    first_name: "Иван",
    last_name: "Иванов",
    middle_name: "Иванович",
    roles: ["Терапевт", "Кардиолог"],
    phone: "+7 (777) 123-45-67",
    email: "doctor.ivanov@clinic.kz",
    description: "Врач кардиолог - терапевт с 10 лет опытом работы",
    education: [
        "Медицинский Университет, Лечебное дело (2008)",
        "Ординатура по терапии (2010)",
        "Специализация по кардиологии (2012)",
        "Курс повышения квалификации по эндокринологии (2015)"
    ],
    certificates: [
        "Сертификат врача-терапевта (2020)",
        "Сертификат врача-кардиолога (2022)",
        "Сертификат по эндокринологии (2023)"
    ],
    schedule: [
        { day: "Понедельник", hours: "09:00 - 18:00" },
        { day: "Вторник", hours: "09:00 - 18:00" },
        { day: "Среда", hours: "09:00 - 18:00" },
        { day: "Четверг", hours: "09:00 - 18:00" },
        { day: "Пятница", hours: "09:00 - 16:00" }
    ],
    contactInfo: {
        department: "Терапевтическое отделение",
        address: "ул. Абая 123, Медицинский центр",
    }
}; 