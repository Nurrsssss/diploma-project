import { TAnalysis } from '@/types/questionnaire'
import React from 'react'
import ChatRecommendation from '../common/ChatRecommendation'

export default function ChatIdRecommendation(
    { analysis }: { analysis: TAnalysis }
) {

    return (
        <div className='bg-white rounded-lg p-4 mt-4'>
            <ChatRecommendation recommendations={analysis.recommendations} answers={analysis.answers} analysisId={analysis.id} />
        </div>
    )
}
