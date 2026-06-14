    'use client';

    import React, { useMemo, useState } from 'react';
    import NoContent from '@/components/ui/NoContent';
    import { LEGACY_ALIASES } from '@/arrays/chat/questions';
    import { TAnalysis } from '@/types/questionnaire';
    import { usePatientQuestionnaire } from '@/hooks/patient/usePatientQuestionnaire';
    import { useQuestionnaireTemplate } from '@/hooks/questionnaire/useQuestionnaireTemplate';
    import Loader from '@/components/ui/Loader';

    function toCanonical13(src: Record<string, any> | null | undefined, canonicalKeys: string[]): Record<string, string> {
    const base: Record<string, string> = {};
    for (const k of canonicalKeys) base[k] = '';
    if (!src) return base;

    for (const [k, v] of Object.entries(src)) {
        const canonical = LEGACY_ALIASES[k] ?? k;
        if (canonicalKeys.includes(canonical)) {
        base[canonical] =
            v == null ? '' : Array.isArray(v) ? v.join(', ') : typeof v === 'string' ? v : String(v);
        }
    }
    return base;
    }

    export default function ChatIdAnswers({ selectedChat }: { selectedChat: TAnalysis }) {
    const userId = (selectedChat as any)?.user_id ?? null;

    // Получаем вопросы с сервера
    const { questions, loading: questionsLoading, error: questionsError } = useQuestionnaireTemplate();

    // только PUT
    const { updateAnswers } = usePatientQuestionnaire(userId);

    const CANONICAL_KEYS = useMemo(() => questions.map(q => q.question_id), [questions]);

    const baseAnswers = useMemo(
        () => toCanonical13(selectedChat?.answers as any, CANONICAL_KEYS),
        [selectedChat?.answers, CANONICAL_KEYS]
    );

    const [editMode, setEditMode] = useState(false);
    const [fields, setFields] = useState<Record<string, string>>(baseAnswers);
    const [saving, setSaving] = useState(false);
    const [saveErr, setSaveErr] = useState<string | null>(null);

    // Когда открываем редактирование — подставляем последние базовые значения
    React.useEffect(() => {
        if (!editMode) setFields(baseAnswers);
    }, [baseAnswers, editMode]);

    const handleChange = (key: string, value: string) => {
        setFields(prev => ({ ...prev, [key]: value }));
    };

    const handleCancel = () => {
        setFields(baseAnswers);
        setEditMode(false);
        setSaveErr(null);
    };

    const handleSave = async () => {
        if (!userId) return;
        setSaving(true);
        setSaveErr(null);

        try {
        // формируем только изменённые поля
        const changed: Record<string, string> = {};
        for (const k of CANONICAL_KEYS) {
            const prev = baseAnswers[k] ?? '';
            const next = fields[k] ?? '';
            if (String(prev) !== String(next)) changed[k] = next;
        }

        if (Object.keys(changed).length === 0) {
            setEditMode(false);
            return;
        }

        await updateAnswers(changed);
        setEditMode(false);
        } catch (e: any) {
        setSaveErr(e?.message ?? 'Неизвестная ошибка сохранения');
        } finally {
        setSaving(false);
        }
    };

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
            <div className="flex gap-2">
            {!editMode ? (
                <button
                onClick={() => setEditMode(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                disabled={!userId}
                title={!userId ? 'Нет user_id' : undefined}
                >
                Редактировать
                </button>
            ) : (
                <>
                <button
                    onClick={handleCancel}
                    disabled={saving}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
                >
                    Отмена
                </button>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                    {saving && <span className="h-4 w-4 animate-spin rounded-full border-b-2 border-white" />}
                    Сохранить
                </button>
                </>
            )}
            </div>
        </div>

        {saveErr && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded">
            <p className="text-sm text-red-700">Ошибка сохранения: {saveErr}</p>
            </div>
        )}

        <div className="space-y-4">
            {CANONICAL_KEYS.map((key, idx) => {
            const qMeta = questions.find(q => q.question_id === key)!;
            const value = fields[key] ?? '';
            const isEmpty = value.trim() === '';

            return (
                <div key={key} className="flex items-start gap-4 px-4 py-2 bg-blue-50 rounded-lg border border-blue-100">
                <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-primary text-white font-semibold rounded-full text-sm">
                    {idx + 1}
                </div>
                <div className="flex-1">
                    <p className="font-semibold text-gray-900 mb-2">{qMeta.text}</p>

                    {!editMode ? (
                    <p
                        className={`text-base whitespace-pre-wrap min-w-[120px] bg-white py-1.5 px-2 sm:px-4 rounded border ${
                        isEmpty ? 'text-gray-400 italic' : 'text-gray-800'
                        }`}
                    >
                        {isEmpty ? 'Ответ не указан' : value}
                    </p>
                    ) : (
                    <textarea
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none bg-white"
                        rows={3}
                        placeholder={qMeta.text}
                        value={value}
                        onChange={e => handleChange(key, e.target.value)}
                    />
                    )}
                </div>
                </div>
            );
            })}
        </div>

        {!hasAnyAnswer && !editMode && (
            <div className="mt-6">
            <NoContent title="Ответы отсутствуют" description="Пациент ещё не заполнил анкету." />
            </div>
        )}
        </div>
    );
    }
