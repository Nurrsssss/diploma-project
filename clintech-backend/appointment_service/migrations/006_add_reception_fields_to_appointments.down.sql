DROP INDEX IF EXISTS idx_appointments_service_id;

ALTER TABLE appointments
DROP COLUMN IF EXISTS service_id;

ALTER TABLE appointments
DROP COLUMN IF EXISTS channel;

ALTER TABLE appointments
DROP COLUMN IF EXISTS cabinet_number;
