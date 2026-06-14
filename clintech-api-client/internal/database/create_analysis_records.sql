CREATE TABLE IF NOT EXISTS analysis_records (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    answers JSONB NOT NULL DEFAULT '{}'::jsonb,
    recommendations TEXT NOT NULL DEFAULT '',
    preliminary_conclusion TEXT NOT NULL DEFAULT '',
    preliminary_conclusion_file_id TEXT NOT NULL DEFAULT '',
    files TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analysis_records_user_id_created_at
    ON analysis_records (user_id, created_at DESC);
