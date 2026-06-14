ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS cabinet_number INTEGER;

ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS channel TEXT;

ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS service_id TEXT;

CREATE INDEX IF NOT EXISTS idx_appointments_service_id ON appointments(service_id);
