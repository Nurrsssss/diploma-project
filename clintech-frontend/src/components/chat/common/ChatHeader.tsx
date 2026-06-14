import React from 'react'
import { ProgressBar } from './ProgressBar'
import Image from "next/image";
import { EQuestionnaireStep } from '@/types/questionnaire';

interface IChatHeaderProps {
    currentAnswers: number;
    totalQuestions: number;
    currentStep: EQuestionnaireStep;
}

export const ChatHeader: React.FC<IChatHeaderProps> = ({ currentAnswers, totalQuestions, currentStep }) => (
    <div className="w-full mx-auto">
        <div className="flex flex-col bg-gradient-to-r from-primaryDark via-primary to-accent py-4 sm:rounded-t-2xl sm:py-6">
            <div className="flex px-4 sm:px-8 gap-3 sm:gap-6">
                <Image
                    src="/image/health-check/brain.svg"
                    alt="brain"
                    width={48}
                    height={48}
                    className="w-12 h-12 sm:w-[72px] sm:h-[72px] mt-2"
                />
                <div>
                    <p className="text-xl sm:text-2xl text-white font-bold">AI Health Assessment</p>
                    <p className="text-base sm:text-lg text-white font-semibold hidden sm:block">Комплексная оценка состояния здоровья из 13 вопросов</p>
                    <p className="text-sm sm:text-base text-white font-medium">
                        {currentStep === EQuestionnaireStep.QUESTIONNAIRE && ' Введите ответы самостоятельно или запишите голосовое сообщение'}
                        {currentStep === EQuestionnaireStep.DOCUMENT_UPLOAD && ' Загрузите документы'}
                        {currentStep === EQuestionnaireStep.ANALYSIS && ' Анализируем данные и готовим результат...'}
                        {currentStep === EQuestionnaireStep.RECOMMENDATIONS && ' Предварительные рекомендации от искусственного интеллекта'}
                    </p>
                </div>
            </div>
            {currentStep === EQuestionnaireStep.QUESTIONNAIRE && (
                <ProgressBar currentAnswers={currentAnswers} totalQuestions={totalQuestions} />
            )}
        </div>
    </div>
) 