'use client';

import { useState, useCallback, useEffect } from 'react';
import { useAuthenticatedFetch } from '../auth/useAuthenticatedFetch';
import { QuestionnaireTemplate, Question } from '@/types/questionnaire';

interface UseQuestionnaireTemplateReturn {
  questions: Question[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// Кэш для вопросов (чтобы не делать повторные запросы)
let cachedQuestions: Question[] | null = null;
let cachePromise: Promise<QuestionnaireTemplate> | null = null;

export const useQuestionnaireTemplate = (): UseQuestionnaireTemplateReturn => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const authenticatedFetch = useAuthenticatedFetch();

  const fetchTemplate = useCallback(async () => {
    // Если уже есть кэш, используем его
    if (cachedQuestions) {
      setQuestions(cachedQuestions);
      setLoading(false);
      return;
    }

    // Если запрос уже выполняется, ждем его
    if (cachePromise) {
      try {
        const data = await cachePromise;
        cachedQuestions = data.questions;
        setQuestions(data.questions);
        setLoading(false);
        return;
      } catch (err) {
        // Если кэш-запрос упал, делаем новый
        cachePromise = null;
      }
    }

    try {
      setLoading(true);
      setError(null);

      // Создаем промис для кэширования
      cachePromise = authenticatedFetch('/api/questionnaire/template')
        .then(async (res) => {
          if (!res.ok) {
            throw new Error('Failed to fetch questionnaire template');
          }
          const data: QuestionnaireTemplate = await res.json();
          return data;
        });

      const data = await cachePromise;
      cachedQuestions = data.questions;
      setQuestions(data.questions);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Не удалось загрузить вопросы анкеты';
      setError(errorMessage);
      console.error('Error loading questionnaire template:', err);
    } finally {
      setLoading(false);
      cachePromise = null;
    }
  }, [authenticatedFetch]);

  useEffect(() => {
    fetchTemplate();
  }, [fetchTemplate]);

  return {
    questions,
    loading,
    error,
    refetch: fetchTemplate,
  };
};
