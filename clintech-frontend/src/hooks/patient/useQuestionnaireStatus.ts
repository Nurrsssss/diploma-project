import { useAuth } from '@/context/AuthContext';
import { usePatientAnalysis } from './usePatientAnalysis';

export const useQuestionnaireStatus = () => {
  const { session, hydrated } = useAuth();
  const { analysis, loading, error } = usePatientAnalysis();

  // Проверяем является ли пользователь пациентом
  const isPatient = session?.role === 'patient';

  // Проверяем есть ли заполненные анкеты
  const hasCompletedQuestionnaires = analysis && analysis.length > 0;

  // Проверяем, является ли ошибка связанной с авторизацией
  const isAuthError = error && (
    error.includes('авторизован') || 
    error.includes('токен') || 
    error.includes('token') ||
    error.includes('401')
  );

  // Нужно ли показывать баннер
  // Показываем только если:
  // 1. Пользователь - пациент
  // 2. Нет заполненных анкет
  // 3. Данные загружены (не loading)
  // 4. Нет ошибок ИЛИ ошибка связана с авторизацией (токен истек - считаем что анкет нет)
  // 5. Сессия инициализирована
  // 6. У нас есть user_id (полная сессия)
  const shouldShowBanner = isPatient && 
                          !hasCompletedQuestionnaires && 
                          !loading && 
                          (!error || isAuthError) && 
                          hydrated &&
                          session?.user_id;

  return {
    isPatient,
    hasCompletedQuestionnaires,
    shouldShowBanner,
    questionnairesCount: analysis?.length || 0,
    loading,
    error
  };
}; 