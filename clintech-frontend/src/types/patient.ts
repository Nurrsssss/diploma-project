import { TAppointment } from "@/types/appointments";

export type TPatient = {
    id: string;
    user_id: string;
    first_name?: string;
    last_name?: string;
    middle_name?: string;
    address?: string;
    avatar_url?: string;
    iin?: string;
    date_of_birth?: string;
    gender?: string;
    email?: string;
    phone?: string;
    height?: number;
    weight?: number;
    phys_activity?: string;
    diagnoses?: string[];
    allergens?: string[];
    diet?: string[];
    created_at?: string;
    updated_at?: string;
    appointments?: TAppointment[];
}