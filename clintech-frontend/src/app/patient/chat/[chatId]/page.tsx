'use client'
import { useParams } from 'next/navigation'
import PageStateWrapper from '@/components/ui/PageStateWrapper'
import ChatIdHeader from '@/components/chat/chatId/ChatIdHeader'
import { usePatientAnalysis } from '@/hooks/patient/usePatientAnalysis'
import { TAnalysis } from '@/types/questionnaire'
import ChatIdRecommendation from '@/components/chat/chatId/ChatIdRecommendation'
import ChatIdAnswersReadOnly from '@/components/chat/chatId/ChatIdAnswersReadOnly' // <-- новый импорт
import ChatIdFiles from '@/components/chat/chatId/ChatIdFiles'

export default function AnalysisPage() {
  const { chatId } = useParams()
  const { loading, getAnalysisById, error } = usePatientAnalysis()

  const currentAnalysis: TAnalysis | null = getAnalysisById(chatId as string) as TAnalysis | null

  return (
    <div className='pt-4 space-y-4'>
      <PageStateWrapper
        loading={loading}
        loadingText='Загрузка информации о анкете'
        error={error}
        isEmpty={!currentAnalysis}
        emptyTitle='Анкета не найдена'
        emptyDescription='Не удалось загрузить информацию о анкете'
        button='Вернуться назад'
        buttonHref='/patient/my-analyses'
      >
        <div className='container space-y-4 '>
          <ChatIdHeader analysis={currentAnalysis as TAnalysis} />
          <ChatIdFiles analysis={currentAnalysis as TAnalysis} />
          <ChatIdRecommendation analysis={currentAnalysis as TAnalysis} />
          <ChatIdAnswersReadOnly selectedChat={currentAnalysis as TAnalysis} /> {/* <-- только просмотр */}
        </div>
      </PageStateWrapper>
    </div>
  )
}
