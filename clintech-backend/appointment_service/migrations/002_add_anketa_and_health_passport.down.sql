-- Remove anketa_id and health_passport_id fields from appointments table
ALTER TABLE appointments 
DROP COLUMN IF EXISTS anketa_id,
DROP COLUMN IF EXISTS health_passport_id; 