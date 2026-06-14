import { Question } from '@/types/questionnaire';

/**
 * Каноническая схема V2 — ровно 13 полей.
 * НАЗВАНИЯ КЛЮЧЕЙ (question_id) — эталонные и совпадают с теми,
 * что приходят/ожидаются бэкендом сейчас.
 */
export const questions: Question[] = [
  {
    id: 1,
    question_id: "complaints",
    text: "Текущие жалобы: что беспокоит, где именно, когда началось, что усиливает или облегчает?",
    type: "text",
    required: true,
    category: "complaints",
  },
  {
    id: 2,
    question_id: "symptoms_duration",
    text: "Длительность симптомов: с какого времени сохраняются проявления, было ли ухудшение/улучшение?",
    type: "text",
    required: false,
    category: "complaints",
  },
  {
    id: 3,
    question_id: "previous_treatment",
    text: "Что уже предпринимали: лекарства/методы, дозировки и эффект.",
    type: "text",
    required: false,
    category: "medical_history",
  },
  {
    id: 4,
    question_id: "chronic_diseases_presence",
    text: "Хронические заболевания: есть ли установленный диагноз (диабет, гипертония, астма и др.)?",
    type: "text",
    required: false,
    category: "medical_history",
  },
  {
    id: 5,
    question_id: "medications",
    text: "Принимаемые лекарства (включая витамины/БАДы): названия, дозировки, кратность.",
    type: "text",
    required: false,
    category: "medications",
  },
  {
    id: 6,
    question_id: "allergies",
    text: "Аллергии: на препараты, продукты или другие аллергены.",
    type: "text",
    required: false,
    category: "allergies",
  },
  {
    id: 7,
    question_id: "diet",
    text: "Питание: режим и состав рациона (овощи/фрукты, жирное/жареное, перекусы, сладкое и т.д.).",
    type: "text",
    required: false,
    category: "lifestyle",
  },
  {
    id: 8,
    question_id: "physical_activity",
    text: "Физическая активность: как часто и сколько (ходьба/спорт/ЛФК и т.п.)?",
    type: "text",
    required: false,
    category: "lifestyle",
  },
  {
    id: 9,
    question_id: "sleep",
    text: "Сон: средняя продолжительность за ночь и качество сна.",
    type: "text",
    required: false,
    category: "lifestyle",
  },
  {
    id: 10,
    question_id: "stress",
    text: "Стресс: был ли в последнее время (работа, семья, эмоциональные нагрузки)?",
    type: "text",
    required: false,
    category: "lifestyle",
  },
  {
    id: 11,
    question_id: "family_history",
    text: "Семейный анамнез: наследственные/семейные заболевания у близких родственников.",
    type: "text",
    required: false,
    category: "family_history",
  },
  {
    id: 12,
    question_id: "substances_use",
    text: "Алкоголь/табак/ПАВ — факт употребления.",
    type: "text",
    required: false,
    category: "lifestyle",
  },
  {
    id: 13,
    question_id: "substances_details",
    text: "Алкоголь/табак/ПАВ — детали: как часто, в каком количестве.",
    type: "text",
    required: false,
    category: "lifestyle",
  },
];

// То, что у вас использовалось для «структуры» (обратная совместимость)
export const questionnaireStructure = questions.map(q => ({
  id: q.question_id,
  text: q.text,
}));

/**
 * Экспорт алиасов для старых записей (если используете где-то ещё)
 * legacy -> canonical
 */
export const LEGACY_ALIASES: Record<string, string> = {
  symptoms: "complaints",
  past_year_symptoms: "previous_treatment",
  chronic_diseases: "chronic_diseases_presence",
  bad_habits: "substances_use",
};
