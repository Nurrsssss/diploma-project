-- Create schedule_days table for detailed schedule per day
CREATE TABLE IF NOT EXISTS schedule_days (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    schedule_id UUID NOT NULL,
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 1 AND day_of_week <= 7), -- 1=Пн, 2=Вт, ..., 7=Вс
    start_time VARCHAR(5) NOT NULL,
    end_time VARCHAR(5) NOT NULL,
    break_start VARCHAR(5),
    break_end VARCHAR(5),
    is_working_day BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for schedule_days
CREATE INDEX IF NOT EXISTS idx_schedule_days_schedule_id ON schedule_days(schedule_id);
CREATE INDEX IF NOT EXISTS idx_schedule_days_day_of_week ON schedule_days(day_of_week);
CREATE UNIQUE INDEX IF NOT EXISTS idx_schedule_days_unique ON schedule_days(schedule_id, day_of_week);

-- Add foreign key constraint (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        WHERE c.conname = 'fk_schedule_days_schedule_id'
          AND t.relname = 'schedule_days'
    ) THEN
        ALTER TABLE schedule_days 
        ADD CONSTRAINT fk_schedule_days_schedule_id 
        FOREIGN KEY (schedule_id) REFERENCES doctor_schedules(id) ON DELETE CASCADE;
    END IF;
END $$; 