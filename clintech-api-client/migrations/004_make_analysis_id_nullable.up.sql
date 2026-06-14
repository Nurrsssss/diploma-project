-- Migration: Make analysis_id nullable in health_passports table
-- This allows health passports to be created without an analysis record (questionnaire)

-- Drop the unique constraint first if it exists
DROP INDEX IF EXISTS idx_health_passports_unique_appointment;

-- Alter the column to allow NULL
ALTER TABLE health_passports 
ALTER COLUMN analysis_id DROP NOT NULL;

-- Recreate the unique constraint
-- PostgreSQL treats NULL as distinct, so multiple NULLs are allowed
-- We use a partial unique index to ensure only one passport per appointment when analysis_id is NULL
-- and the regular unique constraint for non-NULL values
CREATE UNIQUE INDEX IF NOT EXISTS idx_health_passports_unique_appointment_null 
ON health_passports(appointment_id) 
WHERE analysis_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_health_passports_unique_appointment 
ON health_passports(appointment_id, analysis_id) 
WHERE analysis_id IS NOT NULL;

-- Update schema_migrations
INSERT INTO schema_migrations (version, description) VALUES
('1.4.0', 'Made analysis_id nullable in health_passports to support passports without questionnaires')
ON CONFLICT (version) DO NOTHING;

