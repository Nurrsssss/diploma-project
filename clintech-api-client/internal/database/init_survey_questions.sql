CREATE TABLE IF NOT EXISTS survey_questions (
    id BIGSERIAL PRIMARY KEY,
    question_id TEXT NOT NULL UNIQUE,
    text TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'text',
    options TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    required BOOLEAN NOT NULL DEFAULT TRUE,
    category TEXT NOT NULL DEFAULT 'general'
);

INSERT INTO survey_questions (question_id, text, type, options, required, category) VALUES
('complaints', 'Что вас беспокоит в данный момент?', 'textarea', ARRAY[]::TEXT[], TRUE, 'general'),
('symptoms_duration', 'Как давно появились симптомы?', 'text', ARRAY[]::TEXT[], TRUE, 'general'),
('previous_treatment', 'Какое лечение вы уже проходили по этой проблеме?', 'textarea', ARRAY[]::TEXT[], TRUE, 'medical_history'),
('chronic_diseases_presence', 'Есть ли у вас хронические заболевания?', 'textarea', ARRAY[]::TEXT[], TRUE, 'medical_history'),
('medications', 'Какие лекарства вы принимаете сейчас?', 'textarea', ARRAY[]::TEXT[], TRUE, 'medical_history'),
('allergies', 'Есть ли у вас аллергии?', 'textarea', ARRAY[]::TEXT[], TRUE, 'medical_history'),
('diet', 'Опишите ваш режим питания', 'textarea', ARRAY[]::TEXT[], TRUE, 'lifestyle'),
('physical_activity', 'Какой у вас уровень физической активности?', 'text', ARRAY[]::TEXT[], TRUE, 'lifestyle'),
('sleep', 'Как вы спите в последнее время?', 'text', ARRAY[]::TEXT[], TRUE, 'lifestyle'),
('stress', 'Оцените уровень стресса', 'text', ARRAY[]::TEXT[], TRUE, 'lifestyle'),
('family_history', 'Есть ли значимые заболевания у ближайших родственников?', 'textarea', ARRAY[]::TEXT[], TRUE, 'family_history'),
('substances_use', 'Употребляете ли вы табак/алкоголь/другие вещества?', 'text', ARRAY[]::TEXT[], TRUE, 'lifestyle'),
('substances_details', 'Если да, укажите подробнее', 'textarea', ARRAY[]::TEXT[], FALSE, 'lifestyle')
ON CONFLICT (question_id) DO NOTHING;
