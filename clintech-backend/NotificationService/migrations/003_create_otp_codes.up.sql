-- Создание таблицы для OTP кодов
CREATE TABLE otp_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone VARCHAR(20) NOT NULL,
    code VARCHAR(6) NOT NULL,
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    verified_at TIMESTAMP WITH TIME ZONE,
    blocked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Индексы для быстрого поиска
CREATE INDEX idx_otp_codes_phone ON otp_codes(phone);
CREATE INDEX idx_otp_codes_expires_at ON otp_codes(expires_at);
CREATE INDEX idx_otp_codes_verified_at ON otp_codes(verified_at);
CREATE INDEX idx_otp_codes_blocked_at ON otp_codes(blocked_at);

-- Комментарии для документации
COMMENT ON TABLE otp_codes IS 'Таблица для хранения OTP кодов для SMS верификации';
COMMENT ON COLUMN otp_codes.phone IS 'Номер телефона для отправки OTP';
COMMENT ON COLUMN otp_codes.code IS 'OTP код (4-6 символов)';
COMMENT ON COLUMN otp_codes.attempts IS 'Количество попыток верификации';
COMMENT ON COLUMN otp_codes.max_attempts IS 'Максимальное количество попыток (по умолчанию 3)';
COMMENT ON COLUMN otp_codes.expires_at IS 'Время истечения OTP кода';
COMMENT ON COLUMN otp_codes.verified_at IS 'Время успешной верификации (NULL если не верифицирован)';
COMMENT ON COLUMN otp_codes.blocked_at IS 'Время блокировки после превышения попыток (NULL если не заблокирован)'; 