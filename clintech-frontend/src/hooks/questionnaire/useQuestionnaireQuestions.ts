'use client';

import { useState, useCallback } from 'react';
import { useAuthenticatedFetch } from '../auth/useAuthenticatedFetch';

export type CreateQuestionPayload = {
  question_id: string;
  text: string;
  type?: string;
  required?: boolean;
  category?: string;
  // дополнительные произвольные поля (метаданные и т.п.)
  [key: string]: unknown;
};

export type UpdateQuestionPayload = Partial<CreateQuestionPayload>;

interface UseQuestionnaireQuestionsReturn {
  loading: boolean;
  error: string | null;
  createQuestion: (data: CreateQuestionPayload) => Promise<boolean>;
  updateQuestion: (id: string, data: UpdateQuestionPayload) => Promise<boolean>;
  deleteQuestion: (id: string) => Promise<boolean>;
  clearError: () => void;
}

export const useQuestionnaireQuestions = (): UseQuestionnaireQuestionsReturn => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const authenticatedFetch = useAuthenticatedFetch();

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const createQuestion = useCallback(
    async (data: CreateQuestionPayload): Promise<boolean> => {
      try {
        setLoading(true);
        setError(null);

        const response = await authenticatedFetch('/api/questionnaire/question', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          throw new Error(`Ошибка создания вопроса: ${response.status}`);
        }

        return true;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Ошибка при создании вопроса';
        setError(errorMessage);
        console.error('Create question error:', err);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [authenticatedFetch]
  );

  const updateQuestion = useCallback(
    async (id: string, data: UpdateQuestionPayload): Promise<boolean> => {
      try {
        setLoading(true);
        setError(null);

        const response = await authenticatedFetch(`/api/questionnaire/question/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          throw new Error(`Ошибка обновления вопроса: ${response.status}`);
        }

        return true;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Ошибка при обновлении вопроса';
        setError(errorMessage);
        console.error('Update question error:', err);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [authenticatedFetch]
  );

  const deleteQuestion = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        setLoading(true);
        setError(null);

        const response = await authenticatedFetch(`/api/questionnaire/question/${id}`, {
          method: 'DELETE',
          headers: { Accept: 'application/json' },
        });

        if (!response.ok) {
          throw new Error(`Ошибка удаления вопроса: ${response.status}`);
        }

        return true;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Ошибка при удалении вопроса';
        setError(errorMessage);
        console.error('Delete question error:', err);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [authenticatedFetch]
  );

  return {
    loading,
    error,
    createQuestion,
    updateQuestion,
    deleteQuestion,
    clearError,
  };
};
