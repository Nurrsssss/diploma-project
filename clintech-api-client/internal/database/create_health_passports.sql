CREATE TABLE IF NOT EXISTS health_passports (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    doctor_id TEXT NOT NULL,
    appointment_id TEXT NOT NULL,
    analysis_id TEXT,
    transcription_text TEXT,
    content JSONB,
    file_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_health_passports_patient_created_at
    ON health_passports (patient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_health_passports_doctor_created_at
    ON health_passports (doctor_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS ux_health_passports_appointment_analysis
    ON health_passports (appointment_id, COALESCE(analysis_id, ''));
