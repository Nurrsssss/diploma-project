-- Add anketa_id and health_passport_id fields to appointments table (idempotent)
ALTER TABLE appointments 
ADD COLUMN IF NOT EXISTS anketa_id UUID;

ALTER TABLE appointments 
ADD COLUMN IF NOT EXISTS health_passport_id UUID;

-- Create indexes for new fields
CREATE INDEX IF NOT EXISTS idx_appointments_anketa_id ON appointments(anketa_id);
CREATE INDEX IF NOT EXISTS idx_appointments_health_passport_id ON appointments(health_passport_id);

-- Add comments for documentation
COMMENT ON COLUMN appointments.anketa_id IS 'ID анкеты, которую пациент выбирает при записи к врачу';
COMMENT ON COLUMN appointments.health_passport_id IS 'ID паспорта здоровья, который создается врачом во время приема'; 