'use client'
import React from 'react'
import NoContent from '../../ui/NoContent'
import ChatWarning from './ChatWarning'
import MyButton from '@/components/ui/MyButton'
import MarkdownRenderer from '@/components/ui/MarkdownRenderer'
import { EQuestionnaireStep, QuestionnaireAnswers } from '@/types/questionnaire'
import { usePathname, useRouter } from 'next/navigation'
import { Reem_Kufi_Ink } from 'next/font/google'
import Link from 'next/link'
import ChatDoctorRecommendation from './ChatDoctorRecommendation'

interface IChatRecommendationProps {
    setCurrentStep?: (step: EQuestionnaireStep) => void;
    recommendations?: string;
    answers: QuestionnaireAnswers;
    analysisId: string | null;
}

export default function ChatRecommendation({ setCurrentStep, recommendations, answers, analysisId }: IChatRecommendationProps) {
    const pathname = usePathname()
    const router = useRouter()

    return (
        <div className={`bg-white ${pathname === '/patient/chat' ? 'p-4 rounded border' : ''} `}>
            {
                recommendations ? (
                    <>
                        <ChatWarning />
                        <h2 className='text-lg font-bold mb-4'>Рекомендации ИИ</h2>
                        <MarkdownRenderer content={recommendations} className="text-gray-700" />

                        <ChatDoctorRecommendation recommendations={recommendations} />

                        <MyButton
                                onClick={() => router.push('/patient/my-appointments/make')}
                                className="bg-primary text-white hover:bg-primary/90 text-md px-4 py-2"
                            >
                                Записаться на прием
                            </MyButton>
                    </>
                ) : (
                    <NoContent title='Рекомендации отсутствуют' description='Рекомендации от ИИ для этого пациента еще не были сгенерированы.' />
                )
            }
        </div>
    )
}
