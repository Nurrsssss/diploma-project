'use client';
import React from 'react';
import { useHealthCheckSteps } from '@/hooks/chat/useHealthCheckSteps';
import ChatMessages from '../questionnaire/ChatMessages';
import ChatInput from '../questionnaire/ChatInput';
import ChatFileUpload from './fileUpload/ChatFileUpload';
import { ChatHeader } from "@/components/chat/common/ChatHeader";
import { EQuestionnaireStep } from '@/types/questionnaire';
import PageStateWrapper from '../../ui/PageStateWrapper';
import NoContent from '../../ui/NoContent';
import ChatRecommendation from './ChatRecommendation';

const ChatContainer: React.FC = () => {
    const {
        // State
        currentStep,
        questionnaire,
        messages,
        answers,
        currentAnswer,
        currentQuestionIndex,
        editingMessageId,
        loading,
        error,
        recommendations,
        analysisId,

        // Handlers
        setCurrentAnswer,
        setEditingMessageId,
        handleNextQuestion,
        handleEditMessage,
        handleVoiceInput,
        handleFileSelection,
        handleSubmitFiles,
        handleSkipFiles,
        setCurrentStep,
    } = useHealthCheckSteps();

    return (
        <PageStateWrapper
            loading={loading}
            error={error}
            isEmpty={!messages.length}
            loadingText={`${currentStep === EQuestionnaireStep.QUESTIONNAIRE ? 'Загрузка вопросов для анкетирования' : 'Генерация предварительного заключения'}`}
            emptyTitle="Нет вопросов для анкетирования"
            emptyDescription="Пожалуйста, попробуйте попытку позже"
        >
            <div className="container pt-5 min-h-screen sm:flex flex-col">
                <ChatHeader
                    currentAnswers={currentQuestionIndex}
                    totalQuestions={questionnaire?.questions.length || 0}
                    currentStep={currentStep}
                />

                <div className="flex-1 bg-white sm:rounded-b-xl shadow flex flex-col relative min-h-[calc(100vh-200px)]">
                    {currentStep !== EQuestionnaireStep.RECOMMENDATIONS && (
                        <ChatMessages
                            messages={messages}
                            onEditMessage={handleEditMessage}
                            editingMessageId={editingMessageId}
                            setEditingMessageId={setEditingMessageId}
                        />
                    )}

                    {currentStep === EQuestionnaireStep.QUESTIONNAIRE && (
                        <ChatInput
                            value={currentAnswer}
                            onChange={setCurrentAnswer}
                            onNext={handleNextQuestion}
                            onVoiceInput={handleVoiceInput}
                        />
                    )}

                    {currentStep === EQuestionnaireStep.DOCUMENT_UPLOAD && (
                        <ChatFileUpload
                            onFilesSelected={handleFileSelection}
                            onSubmit={handleSubmitFiles}
                            onSkip={handleSkipFiles}
                        />
                    )}

                    {currentStep === EQuestionnaireStep.RECOMMENDATIONS && (
                        <div className="p-4 space-y-3">
                            {recommendations && recommendations.length > 0 ? (
                                <ChatRecommendation 
                                    setCurrentStep={setCurrentStep} 
                                    answers={answers} 
                                    analysisId={analysisId} 
                                    recommendations={recommendations.join('\n')}
                                />
                            ) : (
                                <NoContent title="Нет рекомендаций" description="Пожалуйста, попробуйте попытку позже" />
                            )}
                        </div>
                    )}
                </div>
            </div>
        </PageStateWrapper >
    );
};

export default ChatContainer;