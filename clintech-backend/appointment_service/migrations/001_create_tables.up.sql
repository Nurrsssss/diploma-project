-- Create doctor_schedules table
CREATE TABLE IF NOT EXISTS doctor_schedules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    doctor_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    work_days JSONB,
    start_time VARCHAR(5) NOT NULL,
    end_time VARCHAR(5) NOT NULL,
    break_start VARCHAR(5),
    break_end VARCHAR(5),
    slot_duration BIGINT NOT NULL DEFAULT 30,
    slot_title VARCHAR(255),
    appointment_format VARCHAR(10) NOT NULL DEFAULT 'offline',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for doctor_schedules
CREATE INDEX IF NOT EXISTS idx_doctor_schedules_doctor_id ON doctor_schedules(doctor_id);
CREATE INDEX IF NOT EXISTS idx_schedules_doctor_active ON doctor_schedules(doctor_id, is_active);

-- Create appointments table
CREATE TABLE IF NOT EXISTS appointments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    doctor_id UUID NOT NULL,
    patient_id UUID,
    title VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'available',
    appointment_type VARCHAR(10) DEFAULT 'offline',
    meeting_link TEXT,
    meeting_id VARCHAR(100),
    patient_notes TEXT,
    doctor_notes TEXT,
    schedule_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for appointments
CREATE INDEX IF NOT EXISTS idx_appointments_start_time ON appointments(start_time);
CREATE INDEX IF NOT EXISTS idx_appointments_end_time ON appointments(end_time);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor_id ON appointments(doctor_id);
CREATE INDEX IF NOT EXISTS idx_appointments_patient_id ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_schedule_id ON appointments(schedule_id);

-- Additional performance indexes
CREATE INDEX IF NOT EXISTS idx_appointments_doctor_start_time ON appointments(doctor_id, start_time);
CREATE INDEX IF NOT EXISTS idx_appointments_status_start_time ON appointments(status, start_time);
CREATE INDEX IF NOT EXISTS idx_appointments_patient_start_time ON appointments(patient_id, start_time) WHERE patient_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_doctor_time_unique ON appointments(doctor_id, start_time, end_time);

-- Create schedule_exceptions table
CREATE TABLE IF NOT EXISTS schedule_exceptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    doctor_id UUID NOT NULL,
    date DATE NOT NULL,
    type VARCHAR(20) NOT NULL,
    custom_start_time VARCHAR(5),
    custom_end_time VARCHAR(5),
    reason VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for schedule_exceptions
CREATE INDEX IF NOT EXISTS idx_schedule_exceptions_doctor_id ON schedule_exceptions(doctor_id);
CREATE INDEX IF NOT EXISTS idx_schedule_exceptions_date ON schedule_exceptions(date);
CREATE INDEX IF NOT EXISTS idx_exceptions_doctor_date ON schedule_exceptions(doctor_id, date);

-- Create appointment_files table
CREATE TABLE IF NOT EXISTS appointment_files (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    appointment_id UUID NOT NULL,
    file_id UUID NOT NULL,
    file_type VARCHAR(50),
    uploaded_by VARCHAR(20) NOT NULL CHECK (uploaded_by IN ('patient', 'doctor')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for appointment_files
CREATE INDEX IF NOT EXISTS idx_appointment_files_appointment_id ON appointment_files(appointment_id);
CREATE INDEX IF NOT EXISTS idx_appointment_files_file_id ON appointment_files(file_id);
CREATE INDEX IF NOT EXISTS idx_appointment_files_created_at ON appointment_files(created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_appointment_files_unique ON appointment_files(appointment_id, file_id); 