-- =====================================================
-- VITALEM API DATABASE - COMPLETE SQL DUMP
-- Generated from all schema files and migrations
-- =====================================================

-- =====================================================
-- DATABASE SETUP & EXTENSIONS
-- =====================================================

-- Enable UUID extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables if they exist (for clean install)
-- DROP TABLE IF EXISTS schema_migrations CASCADE;
-- DROP TABLE IF EXISTS health_passports CASCADE;
-- DROP TABLE IF EXISTS analysis_records CASCADE;
-- DROP TABLE IF EXISTS survey_questions CASCADE;

-- =====================================================
-- ANALYSIS RECORDS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS analysis_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    answers JSONB NOT NULL,
    recommendations TEXT,
    preliminary_conclusion TEXT,
    files TEXT[], -- Array of file IDs
    preliminary_conclusion_file_id VARCHAR(255) DEFAULT NULL, -- Added via migration
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for analysis_records
CREATE INDEX IF NOT EXISTS idx_analysis_records_user_id ON analysis_records(user_id);
CREATE INDEX IF NOT EXISTS idx_analysis_records_created_at ON analysis_records(created_at);

-- Comments for analysis_records
COMMENT ON TABLE analysis_records IS 'Records of patient analysis and consultations';
COMMENT ON COLUMN analysis_records.id IS 'Unique identifier for the analysis record';
COMMENT ON COLUMN analysis_records.user_id IS 'User ID who submitted the analysis';
COMMENT ON COLUMN analysis_records.answers IS 'JSON object containing patient questionnaire answers';
COMMENT ON COLUMN analysis_records.recommendations IS 'AI-generated medical recommendations';
COMMENT ON COLUMN analysis_records.preliminary_conclusion IS 'AI-generated preliminary medical conclusion';
COMMENT ON COLUMN analysis_records.files IS 'Array of file IDs uploaded during analysis';
COMMENT ON COLUMN analysis_records.preliminary_conclusion_file_id IS 'ID of the preliminary conclusion PDF file';
COMMENT ON COLUMN analysis_records.created_at IS 'Timestamp when the analysis was created';

-- =====================================================
-- SURVEY QUESTIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS survey_questions (
    id SERIAL PRIMARY KEY,
    question_id TEXT NOT NULL UNIQUE,
    text TEXT NOT NULL,
    type TEXT NOT NULL,
    options TEXT[],
    required BOOLEAN DEFAULT false,
    category TEXT NOT NULL
);

-- Indexes for survey_questions
CREATE INDEX IF NOT EXISTS idx_survey_questions_category ON survey_questions(category);
CREATE INDEX IF NOT EXISTS idx_survey_questions_question_id ON survey_questions(question_id);

-- Comments for survey_questions
COMMENT ON TABLE survey_questions IS 'Survey questions for patient questionnaires';
COMMENT ON COLUMN survey_questions.id IS 'Auto-incrementing primary key';
COMMENT ON COLUMN survey_questions.question_id IS 'Unique identifier for the question';
COMMENT ON COLUMN survey_questions.text IS 'Question text';
COMMENT ON COLUMN survey_questions.type IS 'Question type (text, select, etc.)';
COMMENT ON COLUMN survey_questions.options IS 'Array of possible answers for select questions';
COMMENT ON COLUMN survey_questions.required IS 'Whether the question is required';
COMMENT ON COLUMN survey_questions.category IS 'Question category for grouping';

-- =====================================================
-- HEALTH PASSPORTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS health_passports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL,
    doctor_id UUID NOT NULL,
    appointment_id UUID NOT NULL,
    analysis_id UUID NOT NULL,
    transcription_text TEXT DEFAULT NULL, -- Added via migration
    content JSONB DEFAULT NULL, -- Added for storing HealthPassportData content
    file_id VARCHAR(255) DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for health_passports
CREATE INDEX IF NOT EXISTS idx_health_passports_patient_id ON health_passports(patient_id);
CREATE INDEX IF NOT EXISTS idx_health_passports_doctor_id ON health_passports(doctor_id);
CREATE INDEX IF NOT EXISTS idx_health_passports_appointment_id ON health_passports(appointment_id);
CREATE INDEX IF NOT EXISTS idx_health_passports_analysis_id ON health_passports(analysis_id);
CREATE INDEX IF NOT EXISTS idx_health_passports_created_at ON health_passports(created_at);
CREATE INDEX IF NOT EXISTS idx_health_passports_content ON health_passports USING GIN (content);

-- Unique index to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_health_passports_unique_appointment 
ON health_passports(appointment_id, analysis_id);

-- Comments for health_passports
COMMENT ON TABLE health_passports IS 'Patient health passports - structured medical documents';
COMMENT ON COLUMN health_passports.id IS 'Unique identifier for the health passport';
COMMENT ON COLUMN health_passports.patient_id IS 'Patient identifier';
COMMENT ON COLUMN health_passports.doctor_id IS 'Doctor identifier who created the passport';
COMMENT ON COLUMN health_passports.appointment_id IS 'Appointment identifier';
COMMENT ON COLUMN health_passports.analysis_id IS 'Analysis identifier related to the passport';
COMMENT ON COLUMN health_passports.transcription_text IS 'Текст транскрипции аудио записи';
COMMENT ON COLUMN health_passports.content IS 'JSONB content of HealthPassportData for editing';
COMMENT ON COLUMN health_passports.file_id IS 'PDF file ID in the file service';
COMMENT ON COLUMN health_passports.created_at IS 'Timestamp when the passport was created';
COMMENT ON COLUMN health_passports.updated_at IS 'Timestamp when the passport was last updated';

-- =====================================================
-- SCHEMA MIGRATIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS schema_migrations (
    id SERIAL PRIMARY KEY,
    version VARCHAR(50) NOT NULL UNIQUE,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    description TEXT
);

-- =====================================================
-- SCHEMA MIGRATION RECORDS
-- =====================================================
INSERT INTO schema_migrations (version, description) VALUES
('1.0.0', 'Initial schema with analysis_records, survey_questions, and health_passports tables'),
('1.1.0', 'Added transcription_text field to health_passports table'),
('1.2.0', 'Added preliminary_conclusion_file_id to analysis_records table'),
('1.3.0', 'Updated models and ensured proper data types for arrays')
ON CONFLICT (version) DO NOTHING;

-- =====================================================
-- SAMPLE DATA (OPTIONAL - UNCOMMENT IF NEEDED)
-- =====================================================

-- Sample analysis record
-- INSERT INTO analysis_records (user_id, answers, recommendations) VALUES
-- ('123e4567-e89b-12d3-a456-426614174000', '{"symptoms": "головная боль", "chronic_diseases": "нет"}', 'Рекомендуется консультация с неврологом');

-- Sample health passport
-- INSERT INTO health_passports (patient_id, doctor_id, appointment_id, analysis_id) VALUES
-- ('123e4567-e89b-12d3-a456-426614174001', '123e4567-e89b-12d3-a456-426614174002', '123e4567-e89b-12d3-a456-426614174003', '123e4567-e89b-12d3-a456-426614174000');

-- =====================================================
-- DATABASE SETUP COMPLETE
-- =====================================================

-- Verify tables were created
SELECT 
    schemaname,
    tablename,
    tableowner,
    tablespace,
    hasindexes,
    hasrules,
    hastriggers
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('analysis_records', 'survey_questions', 'health_passports', 'schema_migrations')
ORDER BY tablename;

-- Show table sizes
SELECT 
    schemaname,
    tablename,
    attname,
    typename,
    attlen,
    attnotnull,
    atthasdef
FROM pg_catalog.pg_attribute a
INNER JOIN pg_catalog.pg_class c ON a.attrelid = c.oid
INNER JOIN pg_catalog.pg_namespace n ON c.relnamespace = n.oid
INNER JOIN pg_catalog.pg_type t ON a.atttypid = t.oid
WHERE n.nspname = 'public' 
AND c.relname IN ('analysis_records', 'survey_questions', 'health_passports', 'schema_migrations')
AND a.attnum > 0 
AND NOT a.attisdropped
ORDER BY c.relname, a.attnum;

-- =====================================================
-- END OF DUMP
-- =====================================================