// hooks/patient/usePatientQuestionnaire.ts
'use client';

import { useCallback } from 'react';
import { useAuthenticatedFetch } from '@/hooks/auth/useAuthenticatedFetch';
import { useAuth } from '@/context/AuthContext';
import {
  UpdateQuestionnaireRequest,
  UpdateQuestionnaireResponse,
} from '@/types/questionnaire';

export const usePatientQuestionnaire = (userId: string | null) => {
  const authenticatedFetch = useAuthenticatedFetch();
  const { session } = useAuth();

  const updateAnswers = useCallback(
    async (answers: UpdateQuestionnaireRequest['answers']) => {
      if (!session?.isLoggedIn) {
        throw new Error('Требуется авторизация');
      }

      const role = session.role;
      let url: string;

      if (role === 'patient') {
        // Пациент обновляет свою анкету
        url = '/api/analysis/my/answers';
      } else if (role === 'doctor') {
        // Врач обновляет анкету конкретного пациента
        if (!userId) {
          throw new Error('Для роли doctor требуется patientUserId');
        }
        url = `/api/doctor/analysis/${userId}/answers`;
      } else {
        throw new Error('Неизвестная роль пользователя');
      }

      const res = await authenticatedFetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }), // важно: именно { answers }
      });

      if (!res.ok) {
        const t = await res.text().catch(() => '');
        throw new Error(
          `Ошибка обновления анкеты: ${res.status}${t ? ` - ${t}` : ''}`
        );
      }

      const data = (await res.json()) as UpdateQuestionnaireResponse;
      return data;
    },
    [authenticatedFetch, session?.isLoggedIn, session?.role, userId]
  );

  return { updateAnswers };
};
