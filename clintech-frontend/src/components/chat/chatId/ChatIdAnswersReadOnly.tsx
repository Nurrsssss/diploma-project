'use client';

import React, { useMemo } from 'react';
import NoContent from '@/components/ui/NoContent';
import { LEGACY_ALIASES } from '@/arrays/chat/questions';
import { TAnalysis } from '@/types/questionnaire';
import { useQuestionnaireTemplate } from '@/hooks/questionnaire/useQuestionnaireTemplate';
import Loader from '@/components/ui/Loader';

function toCanonical13(src: Record<string, any> | null | undefined, canonicalKeys: string[]): Record<string, string> {
  const base: Record<string, string> = {};
  for (const k of canonicalKeys) base[k] = '';
  if (!src) return base;

  for (const [k, v] of Object.entries(src)) {
    const canonical = (LEGACY_ALIASES as Record<string, string | undefined>)[k] ?? k;
    if (canonicalKeys.includes(canonical)) {
      base[canonical] =
        v == null ? '' : Array.isArray(v) ? v.join(', ') : typeof v === 'string' ? v : String(v);
    }
  }
  return base;
}

export default function ChatIdAnswersReadOnly({ selectedChat }: { selectedChat: TAnalysis }) {
  // Получаем вопросы с сервера
  const { questions, loading: questionsLoading, error: questionsError } = useQuestionnaireTemplate();

  const CANONICAL_KEYS = useMemo(() => questions.map(q => q.question_id), [questions]);

  const baseAnswers = useMemo(
    () => toCanonical13((selectedChat?.answers as Record<string, any>) ?? null, CANONICAL_KEYS),
    [selectedChat?.answers, CANONICAL_KEYS]
  );

  const hasAnyAnswer = Object.values(baseAnswers).some(v => (v ?? '').trim().length > 0);

  if (questionsLoading) {
    return (
      <div className="rounded-lg bg-white p-6">
        <Loader loadingText="Загрузка вопросов анкеты..." />
      </div>
    );
  }

  if (questionsError || questions.length === 0) {
    return (
      <div className="rounded-lg bg-white p-6">
        <div className="text-center text-red-600">
          {questionsError || 'Не удалось загрузить вопросы анкеты'}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-white">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold">Анкета пациента</h2>
        {/* Важно: никаких кнопок редактирования для пациента */}
      </div>

      <div className="space-y-4">
        {CANONICAL_KEYS.map((key, idx) => {
          const qMeta = questions.find(q => q.question_id === key)!;
          const value = baseAnswers[key] ?? '';
          const isEmpty = value.trim() === '';

          return (
            <div
              key={key}
              className="flex items-start gap-4 px-4 py-2 bg-blue-50 rounded-lg border border-blue-100"
            >
              <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-primary text-white font-semibold rounded-full text-sm">
                {idx + 1}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-900 mb-2">{qMeta.text}</p>
                <p
                  className={`text-base whitespace-pre-wrap min-w-[120px] bg-white py-1.5 px-2 sm:px-4 rounded border ${
                    isEmpty ? 'text-gray-400 italic' : 'text-gray-800'
                  }`}
                >
                  {isEmpty ? 'Ответ не указан' : value}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {!hasAnyAnswer && (
        <div className="mt-6">
          <NoContent title="Ответы отсутствуют" description="Анкета пока не заполнена врачом." />
        </div>
      )}
    </div>
  );
}
