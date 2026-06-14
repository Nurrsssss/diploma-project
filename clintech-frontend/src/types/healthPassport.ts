export interface HealthPassport {
    id: string;
    patient_id: string;
    doctor_id: string;
    appointment_id: string;
    analysis_id: string;
    file_id: string;
    download_url?: string; // URL для скачивания файла (например, /health-passport/:id/download)
    transcription_text?: string;
    created_at: string;
    updated_at: string;
}

export interface GenerateHealthPassportData {
    appointment_id: string;
    analysis_id?: string; // Опционально: может быть пустым для генерации без анкеты
    doctor_id: string;
    answers?: Record<string, string>;
    transcription_text?: string;
    lang: string;
} 