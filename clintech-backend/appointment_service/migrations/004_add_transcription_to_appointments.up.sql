-- Add transcription_text column to appointments for audio transcription
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'appointments'
          AND column_name = 'transcription_text'
    ) THEN
        ALTER TABLE appointments ADD COLUMN transcription_text TEXT;
    END IF;
END $$;

-- Add additional metadata columns (idempotent)
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS transcription_lang VARCHAR(8);
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS transcription_source VARCHAR(10);
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS transcribed_at TIMESTAMPTZ;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS transcribed_by UUID;

-- Optional index for full-text search can be added later (PG tsvector)
-- Example (commented):
-- ALTER TABLE appointments ADD COLUMN transcription_tsv tsvector;
-- CREATE INDEX IF NOT EXISTS idx_appointments_transcription_tsv ON appointments USING GIN (transcription_tsv);
-- UPDATE appointments SET transcription_tsv = to_tsvector('russian', coalesce(transcription_text, ''));
-- CREATE OR REPLACE FUNCTION appointments_transcription_tsv_update() RETURNS trigger AS $$
-- begin
--   new.transcription_tsv := to_tsvector('russian', coalesce(new.transcription_text, ''));
--   return new;
-- end
-- $$ LANGUAGE plpgsql;
-- CREATE TRIGGER appointments_transcription_tsv_update BEFORE INSERT OR UPDATE OF transcription_text ON appointments FOR EACH ROW EXECUTE PROCEDURE appointments_transcription_tsv_update(); 