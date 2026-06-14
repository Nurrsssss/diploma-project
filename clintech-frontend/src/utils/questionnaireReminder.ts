// Утилиты для управления напоминанием об анкете в sessionStorage

const STORAGE_KEY = 'questionnaire-reminder-dismissed-session';

/**
 * Проверяет, было ли напоминание закрыто пользователем
 */
export const isQuestionnaireReminderDismissed = (): boolean => {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem(STORAGE_KEY) === 'true';
};

/**
 * Отмечает напоминание как закрытое
 */
export const dismissQuestionnaireReminder = (): void => {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(STORAGE_KEY, 'true');
};

/**
 * Сбрасывает состояние напоминания (позволяет показать снова)
 */
export const resetQuestionnaireReminder = (): void => {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event('questionnaire-reminder-reset'));
};

/**
 * Получает текущее состояние sessionStorage для отладки
 */
export const getQuestionnaireReminderDebugInfo = () => {
  if (typeof window === 'undefined') return { available: false };
  
  return {
    available: true,
    dismissed: isQuestionnaireReminderDismissed(),
    storageKey: STORAGE_KEY,
    allSessionStorage: Object.fromEntries(
      Object.keys(sessionStorage).map(key => [key, sessionStorage.getItem(key)])
    )
  };
}; 