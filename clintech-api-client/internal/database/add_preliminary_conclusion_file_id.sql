ALTER TABLE analysis_records
ADD COLUMN IF NOT EXISTS preliminary_conclusion_file_id TEXT NOT NULL DEFAULT '';
