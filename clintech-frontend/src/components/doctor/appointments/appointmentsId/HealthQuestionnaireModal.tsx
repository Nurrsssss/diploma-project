// 'use client';
// import React, { useState, useEffect, useCallback, useMemo } from 'react';
// import Modal from '@/components/ui/Modal';
// import MyButton from '@/components/ui/MyButton';
// import { useHealthPassport } from '@/hooks/files/useHealthPassport';
// import { useAuth } from '@/context/AuthContext';
// import { PatientQuestionnaire } from '@/hooks/files/useQuestionnaires';
// import { QuestionnaireAnswers } from '@/types/questionnaire';
// import { useQuestionnaireTemplate } from '@/hooks/questionnaire/useQuestionnaireTemplate';
// import Loader from '@/components/ui/Loader';

// // Тип 13-полей анкеты (канонический)
// export interface QuestionnaireFields extends QuestionnaireAnswers {
//   complaints: string;
//   symptoms_duration: string;
//   previous_treatment: string;
//   chronic_diseases_presence: string;
//   medications: string;
//   allergies: string;
//   diet: string;
//   physical_activity: string;
//   sleep: string;
//   stress: string;
//   family_history: string;
//   substances_use: string;
//   substances_details: string;
// }

// // Алиасы для бэкенда/старых записей → новые ключи
// const LEGACY_TO_CANONICAL: Record<string, keyof QuestionnaireFields> = {
//   // старые ключи:
//   symptoms: 'complaints',
//   past_year_symptoms: 'previous_treatment',
//   chronic_diseases: 'chronic_diseases_presence',
//   bad_habits: 'substances_use',
//   // новые/совпадающие ключи:
//   complaints: 'complaints',
//   symptoms_duration: 'symptoms_duration',
//   previous_treatment: 'previous_treatment',
//   chronic_diseases_presence: 'chronic_diseases_presence',
//   medications: 'medications',
//   allergies: 'allergies',
//   diet: 'diet',
//   physical_activity: 'physical_activity',
//   sleep: 'sleep',
//   stress: 'stress',
//   family_history: 'family_history',
//   substances_use: 'substances_use',
//   substances_details: 'substances_details',
//   // Дополнительные ключи из API extract-answers:
//   symptoms_start_date: 'symptoms_duration',
//   symptoms_location: 'complaints',
//   symptoms_intensity: 'complaints',
//   additional_questions: 'complaints',
//   consultation_goal: 'complaints',
// };

// function emptyFields(): QuestionnaireFields {
//   return {
//     complaints: '',
//     symptoms_duration: '',
//     previous_treatment: '',
//     chronic_diseases_presence: '',
//     medications: '',
//     allergies: '',
//     diet: '',
//     physical_activity: '',
//     sleep: '',
//     stress: '',
//     family_history: '',
//     substances_use: '',
//     substances_details: '',
//   };
// }

// interface HealthQuestionnaireModalProps {
//   isOpen: boolean;
//   onClose: () => void;
//   appointmentId: string;
//   analysisId?: string | null;
//   analysisData?: PatientQuestionnaire | null;
//   dialogue?: string;
//   onCompleted?: () => void;
//   // onFinishAppointment?: (healthPassportId?: string) => void;
// }

// export default function HealthQuestionnaireModal({
//   isOpen,
//   onClose,
//   appointmentId,
//   analysisId,
//   analysisData,
//   dialogue,
//   onCompleted,
//   // onFinishAppointment
// }: HealthQuestionnaireModalProps) {

//   const { session } = useAuth();
//   const { generatePassport, isGenerating: isGeneratingPassport, error: passportError, passport } = useHealthPassport();

//   // Получаем вопросы с сервера
//   const { questions, loading: questionsLoading, error: questionsError } = useQuestionnaireTemplate();

//   const [fields, setFields] = useState<QuestionnaireFields>(emptyFields());
//   const [isExtractingAnswers, setIsExtractingAnswers] = useState(false);
//   const [extractionError, setExtractionError] = useState<string | null>(null);

//   // Создаем массив полей на основе вопросов с сервера
//   const canonicalFields = useMemo(() => {
//     if (!questions || questions.length === 0) return [];
//     return questions.map((q) => ({
//       key: q.question_id as keyof QuestionnaireFields,
//       label: q.text,
//       placeholder: q.text,
//     }));
//   }, [questions]);

//   const getFieldValue = (fieldName: keyof QuestionnaireFields): string => fields[fieldName] || '';

//   const handleFieldChange = (field: keyof QuestionnaireFields, value: string) => {
//     setFields(prev => ({ ...prev, [field]: value }));
//   };

//   // унификация объекта ответов (любой формы) → канонические 13
//   const toCanonical = (obj: Record<string, any> | null | undefined): QuestionnaireFields => {
//     const base = emptyFields();
//     if (!obj) return base;

//     // Группируем значения по целевым полям для правильного объединения
//     const fieldGroups: Record<string, Array<{ key: string; value: string }>> = {};

//     Object.entries(obj).forEach(([k, v]) => {
//       const target = LEGACY_TO_CANONICAL[k];
//       if (!target) return;
      
//       let value = '';
//       if (v === null || v === undefined) {
//         return; // Пропускаем пустые значения
//       } else if (Array.isArray(v)) {
//         value = v.join(', ');
//       } else if (typeof v === 'string') {
//         value = v.trim();
//       } else {
//         value = String(v).trim();
//       }

//       if (!value) return; // Пропускаем пустые значения

//       // Группируем значения по целевым полям
//       if (!fieldGroups[target]) {
//         fieldGroups[target] = [];
//       }
      
//       // Добавляем метки для лучшей читаемости
//       const labels: Record<string, string> = {
//         symptoms: 'Симптомы:',
//         complaints: 'Жалобы:',
//         symptoms_location: 'Локализация:',
//         symptoms_intensity: 'Интенсивность:',
//         symptoms_start_date: 'Дата начала:',
//         additional_questions: 'Дополнительно:',
//         consultation_goal: 'Цель консультации:',
//       };
      
//       const label = labels[k] || '';
//       const labeledValue = label ? `${label} ${value}` : value;
      
//       // Приоритет: основные поля идут первыми
//       if (k === target || k === 'symptoms' || k === 'complaints' || k === 'symptoms_duration') {
//         fieldGroups[target].unshift({ key: k, value: labeledValue });
//       } else {
//         fieldGroups[target].push({ key: k, value: labeledValue });
//       }
//     });

//     // Объединяем значения для каждого поля
//     Object.entries(fieldGroups).forEach(([target, items]) => {
//       if (items.length > 0) {
//         // Если только одно значение и оно без метки, используем как есть
//         if (items.length === 1 && !items[0].value.includes(':')) {
//           base[target as keyof QuestionnaireFields] = items[0].value;
//         } else {
//           // Объединяем с переносами строк
//           base[target as keyof QuestionnaireFields] = items.map(item => item.value).join('\n\n');
//         }
//       }
//     });

//     return base;
//   };

//   // Извлечение ответов из транскрипции (если есть)
//   const handleExtractAnswers = useCallback(async () => {
//     let textToAnalyze = dialogue || analysisData?.transcription_text;

//     // Если dialogue содержит JSON { "dialogue": "..." }
//     if (dialogue && dialogue.includes('{"dialogue":')) {
//       try {
//         const jsonMatch = dialogue.match(/\{.*\}/);
//         if (jsonMatch) {
//           const parsed = JSON.parse(jsonMatch[0]);
//           textToAnalyze = parsed.dialogue || dialogue;
//         }
//       } catch { /* игнорим, используем как есть */ }
//     }

//     if (!textToAnalyze) return;

//     setIsExtractingAnswers(true);
//     setExtractionError(null);

//     try {
//       const response = await fetch('/api/analysis/extract-answers', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ dialogue: textToAnalyze, lang: 'ru' }),
//       });

//       if (!response.ok) {
//         const errorText = await response.text();
//         throw new Error(`Ошибка извлечения ответов: ${response.status} - ${errorText}`);
//       }

//       const result = await response.json();

//       // сервер может вернуть { answers } или { extracted_answers }
//       const src = result.answers ?? result.extracted_answers ?? null;
//       const normalized = toCanonical(src);

//       setFields(prev => ({ ...prev, ...normalized }));
//     } catch (err) {
//       const errorMessage = err instanceof Error ? err.message : 'Ошибка при извлечении ответов';
//       setExtractionError(errorMessage);
//     } finally {
//       setIsExtractingAnswers(false);
//     }
//   }, [dialogue, analysisData?.transcription_text]);

//   // Авто-инициализация при открытии
//   useEffect(() => {
//     if (!isOpen) return;

//     // если есть текст — пытаемся извлечь
//     if (dialogue || analysisData?.transcription_text) {
//       handleExtractAnswers();
//     } else {
//       setFields(emptyFields());
//     }
//   }, [isOpen, dialogue, analysisData?.transcription_text, handleExtractAnswers]);

//   const handleGeneratePassport = async () => {
//     if (!session?.user_id) return;
//     // analysisId теперь опционален - можно генерировать паспорт без анкеты

//     try {
//       const passportData = {
//         appointment_id: appointmentId,
//         analysis_id: analysisId || undefined, // Передаем undefined если analysisId отсутствует
//         doctor_id: session.user_id,
//         lang: 'ru' as const,
//         answers: fields as unknown as Record<string, string>, // канонические 13 ключей
//         transcription_text: dialogue || analysisData?.transcription_text || '',
//       };

//       const passportSuccess = await generatePassport(passportData);

//       // if (passportSuccess) {
//       //   onCompleted?.();
//       //   onFinishAppointment?.(passport?.id);
//       //   alert('Паспорт здоровья успешно сгенерирован! Прием завершен.');
//       //   return;
//       // }
// if (passportError) {
//   if (
//     passportError.includes('health passport already exists') ||
//     passportError.includes('уже существует') ||
//     passportError.includes('already generated')
//   ) {
//     onCompleted?.();
//     alert('Паспорт здоровья уже был сгенерирован для этого приема.');
//     return;
//   }
//   alert(`Ошибка при генерации паспорта здоровья: ${passportError}`);
// } else {
//   alert('Не удалось сгенерировать паспорт здоровья. Попробуйте позже.');
// }

//       if (passportError) {
//         if (
//           passportError.includes('health passport already exists') ||
//           passportError.includes('уже существует') ||
//           passportError.includes('already generated')
//         ) {
//           // onCompleted?.();
//           // onFinishAppointment?.();
//           // alert('Паспорт здоровья уже был сгенерирован для этого приема. Прием завершен.');
//           // return;
//           onCompleted?.();
// alert('Паспорт здоровья уже был сгенерирован для этого приема.');
// return;

//         }
//         alert(`Ошибка при генерации паспорта здоровья: ${passportError}`);
//       } else {
//         alert('Не удалось сгенерировать паспорт здоровья. Попробуйте позже.');
//       }
//     } catch (err) {
//       const errorMessage = err instanceof Error ? err.message : 'Неизвестная ошибка';
//       alert(`Произошла ошибка при генерации паспорта здоровья: ${errorMessage}`);
//     }
//   };

//   return (
//     <Modal
//       isOpen={isOpen}
//       onClose={onClose}
//       title="Редактирование данных приема"
//       size="xl"
//     >
//       <div className="p-6 space-y-6 relative">
//         {/* Индикаторы */}
//         {isExtractingAnswers && (
//           <div className="absolute inset-0 bg-white/70 flex items-center justify-center z-10">
//             <Loader loadingText="Извлечение ответов из записи приема" />
//           </div>
//         )}
//         {isGeneratingPassport && (
//           <div className="absolute inset-0 bg-white/70 flex items-center justify-center z-10">
//             <Loader loadingText="Генерация паспорта здоровья" />
//           </div>
//         )}

//         {extractionError && (
//           <div className="mb-2">
//             <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
//               <p className="text-red-600 text-sm">{extractionError}</p>
//             </div>
//           </div>
//         )}

//         {questionsLoading && (
//           <div className="mb-4">
//             <Loader loadingText="Загрузка вопросов анкеты..." />
//           </div>
//         )}

//         {questionsError && (
//           <div className="mb-4">
//             <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
//               <p className="text-red-600 text-sm">{questionsError}</p>
//             </div>
//           </div>
//         )}

//         {/* Форма 13 полей, 2 колонки */}
//         {!questionsLoading && !questionsError && canonicalFields.length > 0 && (
//           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//             {canonicalFields.map(({ key, label, placeholder }) => (
//               <div key={key}>
//                 <label className="block text-sm font-medium text-gray-700 mb-2">
//                   {label}
//                 </label>
//                 <textarea
//                   value={getFieldValue(key)}
//                   onChange={(e) => handleFieldChange(key, e.target.value)}
//                   className="w-full p-3 border border-gray-300 rounded-lg focus:border-primary focus:outline-none"
//                   rows={3}
//                   placeholder={placeholder}
//                 />
//               </div>
//             ))}
//           </div>
//         )}

//         {/* Кнопки */}
//         <div className="flex gap-4 pt-6 border-t border-gray-200">
//           <MyButton
//             onClick={handleGeneratePassport}
//             disabled={isGeneratingPassport || isExtractingAnswers}
//             className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg"
//           >
//             {isGeneratingPassport ? 'Генерация паспорта...' : 'Сгенерировать паспорт'}
//           </MyButton>
//           <MyButton
//             onClick={onClose}
//             className="flex-1 bg-gray-500 hover:bg-gray-600 text-white py-3 rounded-lg"
//           >
//             Закрыть
//           </MyButton>
//         </div>
//       </div>
//     </Modal>
//   );
// }
'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Modal from '@/components/ui/Modal';
import MyButton from '@/components/ui/MyButton';
import { useHealthPassport } from '@/hooks/files/useHealthPassport';
import { useAuth } from '@/context/AuthContext';
import { PatientQuestionnaire } from '@/hooks/files/useQuestionnaires';
import { QuestionnaireAnswers } from '@/types/questionnaire';
import { useQuestionnaireTemplate } from '@/hooks/questionnaire/useQuestionnaireTemplate';
import Loader from '@/components/ui/Loader';

// Тип 13-полей анкеты (канонический)
export interface QuestionnaireFields extends QuestionnaireAnswers {
  complaints: string;
  symptoms_duration: string;
  previous_treatment: string;
  chronic_diseases_presence: string;
  medications: string;
  allergies: string;
  diet: string;
  physical_activity: string;
  sleep: string;
  stress: string;
  family_history: string;
  substances_use: string;
  substances_details: string;
}

// Алиасы для бэкенда/старых записей → новые ключи
const LEGACY_TO_CANONICAL: Record<string, keyof QuestionnaireFields> = {
  // старые ключи:
  symptoms: 'complaints',
  past_year_symptoms: 'previous_treatment',
  chronic_diseases: 'chronic_diseases_presence',
  bad_habits: 'substances_use',
  // новые/совпадающие ключи:
  complaints: 'complaints',
  symptoms_duration: 'symptoms_duration',
  previous_treatment: 'previous_treatment',
  chronic_diseases_presence: 'chronic_diseases_presence',
  medications: 'medications',
  allergies: 'allergies',
  diet: 'diet',
  physical_activity: 'physical_activity',
  sleep: 'sleep',
  stress: 'stress',
  family_history: 'family_history',
  substances_use: 'substances_use',
  substances_details: 'substances_details',
  // Дополнительные ключи из API extract-answers:
  symptoms_start_date: 'symptoms_duration',
  symptoms_location: 'complaints',
  symptoms_intensity: 'complaints',
  additional_questions: 'complaints',
  consultation_goal: 'complaints',
};

function emptyFields(): QuestionnaireFields {
  return {
    complaints: '',
    symptoms_duration: '',
    previous_treatment: '',
    chronic_diseases_presence: '',
    medications: '',
    allergies: '',
    diet: '',
    physical_activity: '',
    sleep: '',
    stress: '',
    family_history: '',
    substances_use: '',
    substances_details: '',
  };
}

// Прямой маппинг ответов анкеты пациента (ключи совпадают с каноническими полями) в поля формы
function fieldsFromAnswers(answers: Record<string, any> | null | undefined): QuestionnaireFields {
  const base = emptyFields();
  if (!answers) return base;

  (Object.keys(base) as Array<keyof QuestionnaireFields>).forEach((key) => {
    const value = answers[key];
    if (value === null || value === undefined) return;
    base[key] = Array.isArray(value) ? value.join(', ') : String(value).trim();
  });

  return base;
}

interface HealthQuestionnaireModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointmentId: string;
  analysisId?: string | null;
  analysisData?: PatientQuestionnaire | null;
  dialogue?: string;
  onCompleted?: () => void;
}

export default function HealthQuestionnaireModal({
  isOpen,
  onClose,
  appointmentId,
  analysisId,
  analysisData,
  dialogue,
  onCompleted,
}: HealthQuestionnaireModalProps) {

  const { session } = useAuth();
  const { generatePassport, isGenerating: isGeneratingPassport, error: passportError } = useHealthPassport();

  // Получаем вопросы с сервера
  const { questions, loading: questionsLoading, error: questionsError } = useQuestionnaireTemplate();

  const [fields, setFields] = useState<QuestionnaireFields>(emptyFields());
  const [isExtractingAnswers, setIsExtractingAnswers] = useState(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);

  // Создаем массив полей на основе вопросов с сервера
  const canonicalFields = useMemo(() => {
    if (!questions || questions.length === 0) return [];
    return questions.map((q) => ({
      key: q.question_id as keyof QuestionnaireFields,
      label: q.text,
      placeholder: q.text,
    }));
  }, [questions]);

  const getFieldValue = (fieldName: keyof QuestionnaireFields): string => fields[fieldName] || '';

  const handleFieldChange = (field: keyof QuestionnaireFields, value: string) => {
    setFields(prev => ({ ...prev, [field]: value }));
  };

  // унификация объекта ответов (любой формы) → канонические 13
  const toCanonical = (obj: Record<string, any> | null | undefined): QuestionnaireFields => {
    const base = emptyFields();
    if (!obj) return base;

    const fieldGroups: Record<string, Array<{ key: string; value: string }>> = {};

    Object.entries(obj).forEach(([k, v]) => {
      const target = LEGACY_TO_CANONICAL[k];
      if (!target) return;

      let value = '';
      if (v === null || v === undefined) {
        return;
      } else if (Array.isArray(v)) {
        value = v.join(', ');
      } else if (typeof v === 'string') {
        value = v.trim();
      } else {
        value = String(v).trim();
      }

      if (!value) return;

      if (!fieldGroups[target]) fieldGroups[target] = [];

      const labels: Record<string, string> = {
        symptoms: 'Симптомы:',
        complaints: 'Жалобы:',
        symptoms_location: 'Локализация:',
        symptoms_intensity: 'Интенсивность:',
        symptoms_start_date: 'Дата начала:',
        additional_questions: 'Дополнительно:',
        consultation_goal: 'Цель консультации:',
      };

      const label = labels[k] || '';
      const labeledValue = label ? `${label} ${value}` : value;

      if (k === target || k === 'symptoms' || k === 'complaints' || k === 'symptoms_duration') {
        fieldGroups[target].unshift({ key: k, value: labeledValue });
      } else {
        fieldGroups[target].push({ key: k, value: labeledValue });
      }
    });

    Object.entries(fieldGroups).forEach(([target, items]) => {
      if (items.length > 0) {
        if (items.length === 1 && !items[0].value.includes(':')) {
          base[target as keyof QuestionnaireFields] = items[0].value;
        } else {
          base[target as keyof QuestionnaireFields] = items.map(item => item.value).join('\n\n');
        }
      }
    });

    return base;
  };

  const handleExtractAnswers = useCallback(async () => {
    let textToAnalyze = dialogue || analysisData?.transcription_text;

    if (dialogue && dialogue.includes('{"dialogue":')) {
      try {
        const jsonMatch = dialogue.match(/\{.*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          textToAnalyze = parsed.dialogue || dialogue;
        }
      } catch {
        // игнорим
      }
    }

    if (!textToAnalyze) return;

    setIsExtractingAnswers(true);
    setExtractionError(null);

    try {
      const response = await fetch('/api/analysis/extract-answers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dialogue: textToAnalyze, lang: 'ru' }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ошибка извлечения ответов: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      const src = result.answers ?? result.extracted_answers ?? null;
      const normalized = toCanonical(src);

      // Дополняем уже заполненные поля (из анкеты пациента) только тем, что реально извлёк ИИ из диалога
      setFields(prev => {
        const merged = { ...prev };
        (Object.keys(normalized) as Array<keyof QuestionnaireFields>).forEach((key) => {
          if (normalized[key]) {
            merged[key] = normalized[key];
          }
        });
        return merged;
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Ошибка при извлечении ответов';
      setExtractionError(errorMessage);
    } finally {
      setIsExtractingAnswers(false);
    }
  }, [dialogue, analysisData?.transcription_text]);

  useEffect(() => {
    if (!isOpen) return;

    // Сначала показываем ответы из анкеты самого пациента, чтобы врач мог их отредактировать
    setFields(fieldsFromAnswers(analysisData?.answers));

    // Затем дополняем тем, что ИИ извлечёт из диалога приёма (если он есть)
    if (dialogue || analysisData?.transcription_text) {
      handleExtractAnswers();
    }
  }, [isOpen, analysisData?.answers, dialogue, analysisData?.transcription_text, handleExtractAnswers]);

  // Генерация паспорта: НЕ завершает прием
  const handleGeneratePassport = async () => {
    if (!session?.user_id) return;

    try {
      const passportData = {
        appointment_id: appointmentId,
        analysis_id: analysisId || undefined,
        doctor_id: session.user_id,
        lang: 'ru' as const,
        answers: fields as unknown as Record<string, string>,
        transcription_text: dialogue || analysisData?.transcription_text || '',
      };

      const passportSuccess = await generatePassport(passportData);

      if (passportSuccess) {
        onCompleted?.();
        alert('Паспорт здоровья успешно сгенерирован!');
        return;
      }

      if (passportError) {
        if (
          passportError.includes('health passport already exists') ||
          passportError.includes('уже существует') ||
          passportError.includes('already generated')
        ) {
          onCompleted?.();
          alert('Паспорт здоровья уже был сгенерирован для этого приема.');
          return;
        }

        alert(`Ошибка при генерации паспорта здоровья: ${passportError}`);
        return;
      }

      alert('Не удалось сгенерировать паспорт здоровья. Попробуйте позже.');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Неизвестная ошибка';
      alert(`Произошла ошибка при генерации паспорта здоровья: ${errorMessage}`);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Редактирование данных приема"
      size="xl"
    >
      <div className="p-6 space-y-6 relative">
        {isExtractingAnswers && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center z-10">
            <Loader loadingText="Извлечение ответов из записи приема" />
          </div>
        )}
        {isGeneratingPassport && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center z-10">
            <Loader loadingText="Генерация паспорта здоровья" />
          </div>
        )}

        {extractionError && (
          <div className="mb-2">
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm">{extractionError}</p>
            </div>
          </div>
        )}

        {questionsLoading && (
          <div className="mb-4">
            <Loader loadingText="Загрузка вопросов анкеты..." />
          </div>
        )}

        {questionsError && (
          <div className="mb-4">
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm">{questionsError}</p>
            </div>
          </div>
        )}

        {!questionsLoading && !questionsError && canonicalFields.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {canonicalFields.map(({ key, label, placeholder }) => (
              <div key={String(key)}>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {label}
                </label>
                <textarea
                  value={getFieldValue(key)}
                  onChange={(e) => handleFieldChange(key, e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:border-primary focus:outline-none"
                  rows={3}
                  placeholder={placeholder}
                />
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-4 pt-6 border-t border-gray-200">
          <MyButton
            onClick={handleGeneratePassport}
            disabled={isGeneratingPassport || isExtractingAnswers}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg"
          >
            {isGeneratingPassport ? 'Генерация паспорта...' : 'Сгенерировать паспорт'}
          </MyButton>
          <MyButton
            onClick={onClose}
            className="flex-1 bg-gray-500 hover:bg-gray-600 text-white py-3 rounded-lg"
          >
            Закрыть
          </MyButton>
        </div>
      </div>
    </Modal>
  );
}
