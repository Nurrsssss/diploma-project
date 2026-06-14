-- 001_create_answers.sql
CREATE TABLE IF NOT EXISTS answers (
  id            BIGSERIAL PRIMARY KEY,
  patient_id    BIGINT      NOT NULL,
  question_id   TEXT        NOT NULL,         -- совпадает с questions.question_id
  text_value    TEXT        NULL,
  number_value  DOUBLE PRECISION NULL,
  date_value    DATE        NULL,
  option_value  TEXT        NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_patient_question UNIQUE (patient_id, question_id)
);

-- при апдейтах обновляем updated_at
CREATE OR REPLACE FUNCTION trg_set_timestamp() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_timestamp_answers ON answers;
CREATE TRIGGER set_timestamp_answers
BEFORE UPDATE ON answers
FOR EACH ROW EXECUTE FUNCTION trg_set_timestamp();
