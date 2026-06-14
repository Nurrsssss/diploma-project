import { useState, useCallback, useEffect } from 'react';
import { useAuthenticatedFetch } from '../auth/useAuthenticatedFetch';
import { useAuth } from '../auth/useAuth';
import { QuestionnaireTemplate, QuestionnaireAnswers } from '@/types/questionnaire';
import { TQuestionnaireMessage, EQuestionnaireStep } from '@/types/questionnaire';

const generateUniqueId = () => {
    return Math.random().toString(36).substr(2, 9);
};

const LOCAL_ANALYSIS_STORAGE_KEY_PREFIX = 'patientAnalyses';

const getLocalAnalysisStorageKey = (userId?: string | null) => {
    const normalizedUserId = String(userId || '').trim();
    return normalizedUserId
        ? `${LOCAL_ANALYSIS_STORAGE_KEY_PREFIX}:${normalizedUserId}`
        : LOCAL_ANALYSIS_STORAGE_KEY_PREFIX;
};

const saveAnalysisToLocalStorage = (
    userId: string | null | undefined,
    analysisId: string,
    answers: QuestionnaireAnswers,
    recommendations: string,
    selectedFiles: File[],
) => {
    if (typeof window === 'undefined') return;

    try {
        const storageKey = getLocalAnalysisStorageKey(userId);
        const existing = JSON.parse(localStorage.getItem(storageKey) || '[]');
        const normalized = Array.isArray(existing) ? existing : [];

        const nextAnalysis = {
            id: analysisId,
            owner_user_id: String(userId || '').trim() || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            answers,
            recommendations,
            files: selectedFiles.map((file) => file.name),
            transcription_text: null,
        };

        const filtered = normalized.filter((item: any) => item?.id !== analysisId);
        filtered.unshift(nextAnalysis);

        localStorage.setItem(storageKey, JSON.stringify(filtered));
    } catch (error) {
        console.error('Failed to save analysis locally:', error);
    }
};

export const useHealthCheckSteps = () => {
    const { session } = useAuth();
    const [currentStep, setCurrentStep] = useState<EQuestionnaireStep>(EQuestionnaireStep.QUESTIONNAIRE);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Questionnaire state
    const [questionnaire, setQuestionnaire] = useState<QuestionnaireTemplate | null>(null);
    const [messages, setMessages] = useState<TQuestionnaireMessage[]>([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [currentAnswer, setCurrentAnswer] = useState('');
    const [answers, setAnswers] = useState<QuestionnaireAnswers>({});
    const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [recommendations, setRecommendations] = useState<string[]>([]);
    const [analysisId, setAnalysisId] = useState<string | null>(null);

    const authenticatedFetch = useAuthenticatedFetch();

    // Fetch questionnaire on mount
    const fetchQuestionnaire = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            
            const res = await authenticatedFetch('/api/questionnaire/template');
            if (!res.ok) {
                throw new Error('Failed to fetch questionnaire');
            }
            
            const data: QuestionnaireTemplate = await res.json();
            setQuestionnaire(data);
            
            // Initialize first message
            if (data.questions && data.questions.length > 0) {
                setMessages([
                    {
                        id: generateUniqueId(),
                        text: data.questions[0].text,
                        timestamp: new Date(),
                        type: 'receiver'
                    }
                ]);
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Не удалось загрузить вопросы. Попробуйте позже.';
            setError(errorMessage);
            console.error('Error loading questionnaire:', err);
        } finally {
            setLoading(false);
        }
    }, [authenticatedFetch]);

    // Initialize questionnaire
    useEffect(() => {
        fetchQuestionnaire();
    }, [fetchQuestionnaire]);

    // Questionnaire handlers
    const handleNextQuestion = useCallback(() => {
        if (!questionnaire) return;
        if (!currentAnswer.trim()) return;

        const currentQuestion = questionnaire.questions[currentQuestionIndex];

        // ✅ Используем question_id вместо id для сохранения ответов
        setAnswers((prev) => ({ ...prev, [currentQuestion.question_id]: currentAnswer }));

        setMessages((prev) => [
            ...prev,
            {
                id: generateUniqueId(),
                text: currentAnswer,
                timestamp: new Date(),
                type: 'sender'
            }
        ]);

        if (currentQuestionIndex + 1 < questionnaire.questions.length) {
            const nextQuestion = questionnaire.questions[currentQuestionIndex + 1];
            setCurrentQuestionIndex((prev) => prev + 1);
            setCurrentAnswer('');
            setMessages((prev) => [
                ...prev,
                {
                    id: generateUniqueId(),
                    text: nextQuestion.text,
                    timestamp: new Date(),
                    type: 'receiver'
                }
            ]);
        } else {
            setCurrentStep(EQuestionnaireStep.DOCUMENT_UPLOAD);
        }
    }, [questionnaire, currentAnswer, currentQuestionIndex]);

    const handleEditMessage = useCallback((messageId: string, newText: string) => {
        if (!questionnaire) return;

        const messageIndex = messages.findIndex(msg => msg.id === messageId);
        if (messageIndex === -1) return;

        // Find the corresponding question index
        const questionIndex = Math.floor(messageIndex / 2);
        const questionId = questionnaire.questions[questionIndex].question_id; // ✅ Используем question_id

        // Update the message
        setMessages(prev => prev.map(msg =>
            msg.id === messageId ? { ...msg, text: newText } : msg
        ));

        // Update the answers state
        setAnswers(prev => ({ ...prev, [questionId]: newText }));

        // Clear editing state
        setEditingMessageId(null);
    }, [questionnaire, messages]);

    const handleVoiceInput = useCallback((text: string) => {
        if (!questionnaire) return;
        if (!text.trim()) return;

        const currentQuestion = questionnaire.questions[currentQuestionIndex];

        // Сразу сохраняем ответ и добавляем сообщение
        setAnswers((prev) => ({ ...prev, [currentQuestion.question_id]: text }));
        setMessages((prev) => [
            ...prev,
            {
                id: generateUniqueId(),
                text: text,
                timestamp: new Date(),
                type: 'sender'
            }
        ]);

        // Переходим к следующему вопросу или завершаем
        if (currentQuestionIndex + 1 < questionnaire.questions.length) {
            const nextQuestion = questionnaire.questions[currentQuestionIndex + 1];
            setCurrentQuestionIndex((prev) => prev + 1);
            setMessages((prev) => [
                ...prev,
                {
                    id: generateUniqueId(),
                    text: nextQuestion.text,
                    timestamp: new Date(),
                    type: 'receiver'
                }
            ]);
        } else {
            setCurrentStep(EQuestionnaireStep.DOCUMENT_UPLOAD);
        }
    }, [questionnaire, currentQuestionIndex]);

    const handleSkipQuestion = useCallback(() => {
        if (!questionnaire) return;

        const currentQuestion = questionnaire.questions[currentQuestionIndex];

        // ✅ Используем question_id вместо id
        setAnswers((prev) => ({ ...prev, [currentQuestion.question_id]: '' }));

        setMessages((prev) => [
            ...prev,
            {
                id: generateUniqueId(),
                text: 'Пропущено',
                timestamp: new Date(),
                type: 'sender'
            }
        ]);

        if (currentQuestionIndex + 1 < questionnaire.questions.length) {
            const nextQuestion = questionnaire.questions[currentQuestionIndex + 1];
            setCurrentQuestionIndex((prev) => prev + 1);
            setCurrentAnswer('');
            setMessages((prev) => [
                ...prev,
                {
                    id: generateUniqueId(),
                    text: nextQuestion.text,
                    timestamp: new Date(),
                    type: 'receiver'
                }
            ]);
        } else {
            setCurrentStep(EQuestionnaireStep.DOCUMENT_UPLOAD);
        }
    }, [questionnaire, currentQuestionIndex]);

    const handleStartAnalysis = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const formData = new FormData();
            formData.append('answers', JSON.stringify(answers));
            formData.append('lang', 'ru');

            // Добавляем файлы к форме, если они есть
            selectedFiles.forEach((file) => {
                formData.append('attachments', file);
            });

            // Запускаем анализ для получения рекомендаций
            // const res = await authenticatedFetch('/api/analysis/recommendation', {
            //     method: 'POST',
            //     body: formData,
            // });
            
            // if (!res.ok) {
            //     throw new Error('Failed to submit analysis');
            // }

            // const data = await res.json();
            
            // // Устанавливаем рекомендации и ID анализа
            // if (data.recommendations) {
            //     setRecommendations(Array.isArray(data.recommendations) ? data.recommendations : [data.recommendations]);
            // }
            // Запускаем анализ для получения рекомендаций
            console.log('[analysis] attachments:', selectedFiles.map(f => ({ name: f.name, size: f.size, type: f.type })));
console.log('[analysis] answers keys:', Object.keys(answers));
console.log('[analysis] formData has answers/lang/attachments:', {
  answers: formData.get('answers'),
  lang: formData.get('lang'),
  attachmentsCount: selectedFiles.length,
});

const res = await authenticatedFetch('/api/analysis/recommendation', {
  method: 'POST',
  body: formData,
});

// СНАЧАЛА читаем текст, чтобы не потерять ошибку (на 500 часто не JSON)
const rawText = await res.text();

if (!res.ok) {
  console.error('[analysis] status:', res.status);
  console.error('[analysis] response body:', rawText);

  // Покажем пользователю то, что реально прислал сервер (если есть)
  throw new Error(rawText || `Failed to submit analysis (HTTP ${res.status})`);
}

// Если ок — пытаемся распарсить JSON
const data = rawText ? JSON.parse(rawText) : {};

            if (data.analysis_id) {
                setAnalysisId(data.analysis_id);
            }

            const recommendationText =
                typeof data.recommendations === 'string'
                    ? data.recommendations
                    : Array.isArray(data.recommendations)
                      ? data.recommendations.join('\n')
                      : 'Анализ завершен';

            const effectiveAnalysisId =
                typeof data.analysis_id === 'string' && data.analysis_id.trim()
                    ? data.analysis_id
                    : generateUniqueId();

            saveAnalysisToLocalStorage(
                session?.user_id,
                effectiveAnalysisId,
                answers,
                recommendationText,
                selectedFiles,
            );

            setRecommendations([recommendationText]);

            setMessages((prev) => [
                ...prev,
                {
                    id: generateUniqueId(),
                    text: recommendationText,
                    timestamp: new Date(),
                    type: 'receiver'
                }
            ]);

            setCurrentStep(EQuestionnaireStep.RECOMMENDATIONS);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Ошибка при отправке анализа';
            setError(errorMessage);
            console.error('Analysis submission error:', err);
            setCurrentStep(EQuestionnaireStep.ANALYSIS);
        } finally {
            setLoading(false);
        }
    }, [answers, selectedFiles, authenticatedFetch, session?.user_id]);

    const handleFileSelection = useCallback((files: File[]) => {
        setSelectedFiles(files);
    }, []);



    const handleSkipFiles = useCallback(() => {
        // Пропускаем загрузку файлов и переходим к анализу
        handleStartAnalysis();
    }, [handleStartAnalysis]);

    const handleSubmitFiles = useCallback(() => {
        // Отправляем файлы и переходим к анализу
        handleStartAnalysis();
    }, [handleStartAnalysis]);

    const resetQuestionnaire = useCallback(() => {
        setCurrentStep(EQuestionnaireStep.QUESTIONNAIRE);
        setMessages([]);
        setCurrentQuestionIndex(0);
        setCurrentAnswer('');
        setAnswers({});
        setEditingMessageId(null);
        if (questionnaire && questionnaire.questions.length > 0) {
            setMessages([
                {
                    id: generateUniqueId(),
                    text: questionnaire.questions[0].text,
                    timestamp: new Date(),
                    type: 'receiver'
                }
            ]);
        }
    }, [questionnaire]);

    return {
        currentStep,
        loading,
        error,
        questionnaire,
        messages,
        currentQuestionIndex,
        currentAnswer,
        answers,
        editingMessageId,
        selectedFiles,
        recommendations,
        analysisId,
        setCurrentAnswer,
        setEditingMessageId,
        setCurrentStep,
        handleNextQuestion,
        handleEditMessage,
        handleVoiceInput,
        handleFileSelection,
        handleSubmitFiles,
        handleSkipFiles,
        handleSkipQuestion,
        handleStartAnalysis,
        resetQuestionnaire,
        fetchQuestionnaire,
    };
}; 