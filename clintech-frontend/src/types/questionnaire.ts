// Enum для шагов анкетирования (для чата)
export enum EQuestionnaireStep {
  QUESTIONNAIRE = 'questionnaire',
  DOCUMENT_UPLOAD = 'document_upload',
  ANALYSIS = 'analysis',
  RECOMMENDATIONS = 'recommendations',
}

// Типы для чат-анкеты
export interface TQuestionnaireMessage {
  id: string;
  text: string;
  // 'sender' — сообщение пользователя; 'receiver' — вопрос/ответ бота
  type: 'sender' | 'receiver';
  timestamp: Date;
}

// Базовый набор полей медицинской анкеты
export interface BaseHealthQuestionnaireFields {
  symptom_onset_date?: string;
  consultation_purpose?: string;
  symptom_localization?: string;
  symptom_intensity?: string;
  [key: string]: string | undefined;
}

// Словарь ответов анкеты с поддержкой дополнительных полей
export interface QuestionnaireAnswers extends BaseHealthQuestionnaireFields {
  [key: string]: string | undefined;
}

// Вопрос анкеты
export interface Question {
  id: number;              // внутренний числовой id (если есть)
  question_id: string;     // стабильный строковый id — используем в ответах/апдейтах
  text: string;
  type?: string;           // 'text' | 'number' | 'date' | 'select' | 'radio' | 'multiselect' | 'checkbox' ...
  required?: boolean;
  category?: string;
  options?: string[];      // для select/radio/checkbox
  [key: string]: any;
}

// ✅ Шаблон анкеты, который возвращает /questionnaire/template
export interface QuestionnaireTemplate {
  questions: Question[];
}

// Типы для анкеты пациента (для интерфейсов врача)
export interface QuestionAnswer {
  question_id: string;     // было number — приводим к string
  question_text: string;
  answer: string;
}

export interface PatientQuestionnaire {
  patient_id: string;
  questions: QuestionAnswer[];
}

export type UpdateQuestionnaireRequest = {
  answers: Record<string, string>; // канон. 13 ключей, можно частичный дифф
};

export type UpdateQuestionnaireResponse = {
  status: 'ok';
  analysis_id: string;
  user_id: string;
  updated: number;
};


// Тип анализа/предварительного заключения, используемый в UI
export interface TAnalysis {
  id: string;
  created_at?: string; // timestamp from backend
  updated_at?: string;
  answers: QuestionnaireAnswers;
  recommendations?: string;
  files?: string[]; // array of file ids
  health_passport_pdf?: string | null;
  transcription_text?: string | null;
  [key: string]: any; // allow additional backend fields
}
