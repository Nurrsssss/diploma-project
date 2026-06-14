'use client';

import { use } from 'react';
import Link from 'next/link';
import { useQuestionnaires, type PatientQuestionnaire } from '@/hooks/files/useQuestionnaires';

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function getFileUrl(idOrUrl: string) {
  // если пришёл полный URL — оставляем, иначе считаем, что это ID на наш files API
  return /^https?:\/\//i.test(idOrUrl) ? idOrUrl : `/api/files/${idOrUrl}`;
}

function QuestionnaireCard({ q }: { q: PatientQuestionnaire }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Анкета</h3>
          <p className="text-sm text-gray-500">
            Создано: {formatDate(q.created_at)}
          </p>
        </div>
        <span className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-700 border border-blue-200">
          ID: {q.id.slice(0, 8)}…
        </span>
      </div>

      {/* Рекомендации */}
      {q.recommendations && (
        <div className="mt-4">
          <h4 className="text-sm font-medium text-gray-700">Рекомендации</h4>
          <p className="mt-1 text-sm text-gray-800 whitespace-pre-line">
            {q.recommendations}
          </p>
        </div>
      )}

      {/* Файлы/PDF */}
      {(q.health_passport_pdf || q.health_survey_pdf || (q.files?.length ?? 0) > 0) && (
        <div className="mt-4 space-y-2">
          <h4 className="text-sm font-medium text-gray-700">Файлы</h4>

          {q.health_passport_pdf && (
            <a
              href={getFileUrl(q.health_passport_pdf)}
              target="_blank"
              rel="noreferrer"
              className="inline-block text-sm underline text-blue-600 hover:text-blue-800"
            >
              Паспорт здоровья (PDF)
            </a>
          )}

          {q.health_survey_pdf && (
            <a
              href={getFileUrl(q.health_survey_pdf)}
              target="_blank"
              rel="noreferrer"
              className="block text-sm underline text-blue-600 hover:text-blue-800"
            >
              Анкета (PDF)
            </a>
          )}

          {q.files?.length ? (
            <ul className="mt-1 text-sm list-disc list-inside text-gray-800">
              {q.files.map((f, i) => (
                <li key={i}>
                  <a
                    href={getFileUrl(f)}
                    target="_blank"
                    rel="noreferrer"
                    className="underline text-blue-600 hover:text-blue-800 break-all"
                  >
                    Файл {i + 1}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}

      {/* Транскрипт (если есть) */}
      {q.transcription_text && (
        <details className="mt-4">
          <summary className="text-sm font-medium text-gray-700 cursor-pointer">
            Транскрипция приёма
          </summary>
          <pre className="mt-2 text-sm bg-gray-50 p-3 rounded border border-gray-200 whitespace-pre-wrap">
            {q.transcription_text}
          </pre>
        </details>
      )}

      {/* Ответы (JSON) */}
      <details className="mt-4">
        <summary className="text-sm font-medium text-gray-700 cursor-pointer">
          Ответы (JSON)
        </summary>
        <pre className="mt-2 text-xs bg-gray-50 p-3 rounded border border-gray-200 overflow-x-auto">
          {JSON.stringify(q.answers ?? {}, null, 2)}
        </pre>
      </details>
    </div>
  );
}

export default function PatientQuestionnairePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { questionnaires, loading, error, refetch } = useQuestionnaires(id);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Хедер */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Анкеты пациента</h1>
            <p className="text-gray-600">
              Пользователь: <span className="font-mono">{id}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={`/doctor/patients/${id}`}
              className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            >
              ← Назад к профилю
            </Link>
            <button
              onClick={refetch}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
            >
              Обновить
            </button>
          </div>
        </div>

        {/* Состояния загрузки/ошибки */}
        {loading && (
          <div className="text-gray-700">Загрузка анкет…</div>
        )}
        {error && (
          <div className="text-red-600">Ошибка: {error}</div>
        )}

        {/* Пусто */}
        {!loading && !error && (!questionnaires || questionnaires.length === 0) && (
          <div className="bg-white border border-gray-200 rounded-xl p-6 text-gray-600">
            Анкет пока нет.
          </div>
        )}

        {/* Список */}
        {!loading && !error && questionnaires && questionnaires.length > 0 && (
          <>
            <div className="mb-3 text-sm text-gray-600">
              Найдено: <span className="font-medium">{questionnaires.length}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {questionnaires.map((q) => (
                <QuestionnaireCard key={q.id} q={q} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
