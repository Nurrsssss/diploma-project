'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { usePatientAnalysis } from '@/hooks/patient/usePatientAnalysis'
import { resetQuestionnaireReminder } from '@/components/chat/questionnaireReminder/QuestionnaireReminder'
import { FileTextIcon } from 'lucide-react'
import PageStateWrapper from '@/components/ui/PageStateWrapper'
import ChatCard from '@/components/chat/chatId/ChatCard'


export default function PProfileQuestionnaires() {
    const [selectedQuestionnaireId, setSelectedQuestionnaireId] = useState<string | null>(null)

    // Получаем анализы пациента
    const { analysis, loading: analysisLoading, error: analysisError } = usePatientAnalysis()

    // Выбираем последнюю анкету по умолчанию
    React.useEffect(() => {
        if (!selectedQuestionnaireId && analysis && analysis.length > 0) {
            const sortedQuestionnaires = [...analysis].sort((a, b) =>
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );
            setSelectedQuestionnaireId(sortedQuestionnaires[0].id);
        }
    }, [analysis, selectedQuestionnaireId]);

    // Сбрасываем напоминание об анкетах когда они появляются
    useEffect(() => {
        if (analysis && analysis.length > 0) {
            resetQuestionnaireReminder();
        }
    }, [analysis]);


    return (

        <PageStateWrapper
            loading={analysisLoading}
            error={analysisError}
            loadingText='Загрузка анкет...'
            isEmpty={!analysisLoading && (!analysis || analysis.length === 0)}
            emptyTitle="Анкеты отсутствуют"
            emptyDescription="Вы еще ни разу не проходили анкету. Заполните анкету в чате с ИИ-ассистентом для получения персональных рекомендаций по здоровью."
            emptyIcon={<FileTextIcon size={48} className='text-primary mb-4' />}
            button="Заполнить анкету"
            buttonHref="/patient/chat"
        >

            <div className="bg-white rounded-2xl shadow-md p-6">
                <h3 className="flex items-center gap-2 text-lg font-semibold text-blue-700 mb-6">
                    <FileTextIcon className="w-5 h-5" />
                    Мои анкеты ({analysis?.length})
                </h3>

                {/* Селектор анкеты если их несколько */}
                {analysis?.length && analysis?.length > 0 && (
                    <ChatCard
                        analysis={analysis} selectedQuestionnaireId={selectedQuestionnaireId} setSelectedQuestionnaireId={setSelectedQuestionnaireId} />
                )}
            </div>
        </PageStateWrapper>

    )
} 