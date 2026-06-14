'use client'

import React, { useState, useEffect } from 'react';
import { useQuestionnaireStatus } from '@/hooks/patient/useQuestionnaireStatus';
import { useAuth } from '@/context/AuthContext';
import QuestionnaireReminderContent from './QuestionnaireReminderContent';
import { 
  isQuestionnaireReminderDismissed, 
  dismissQuestionnaireReminder, 
  resetQuestionnaireReminder as resetReminder
} from '@/utils/questionnaireReminder';

const QuestionnaireReminder: React.FC = () => {
  const { session, hydrated } = useAuth();
  const { shouldShowBanner, loading, isPatient, hasCompletedQuestionnaires } = useQuestionnaireStatus();
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    const dismissed = isQuestionnaireReminderDismissed();
    
    if (dismissed) {
      setIsDismissed(true);
    }
    
    const handleReset = () => {
      setIsDismissed(false);
    };
    
    window.addEventListener('questionnaire-reminder-reset', handleReset);
    return () => {
      window.removeEventListener('questionnaire-reminder-reset', handleReset);
    };
  }, [session]);

  const handleClose = () => {
    setIsDismissed(true);
    dismissQuestionnaireReminder();
  };

  // Проверяем все условия для отображения
  const shouldRender = shouldShowBanner && !isDismissed && hydrated && !loading;

  // Не показываем напоминание если:
  // 1. Не нужно показывать баннер
  // 2. Пользователь закрыл напоминание
  // 3. Сессия еще не инициализирована
  // 4. Данные еще загружаются
  if (!shouldRender) {
    return null;
  }

  return (
    <QuestionnaireReminderContent handleClose={handleClose} />
  );
};

// Экспортируем функцию сброса для использования в других компонентах
export const resetQuestionnaireReminder = resetReminder;

export default QuestionnaireReminder; 