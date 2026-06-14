import MyButton from '@/components/ui/MyButton'
import { FileTextIcon, ChevronRightIcon } from 'lucide-react'
import Link from 'next/link'
import React from 'react'
import { formatDateWithTime, formatDate, KZ_TZ } from '@/utils/date'

export default function ChatCard(
    { analysis, selectedQuestionnaireId, setSelectedQuestionnaireId }:
        { analysis: any, selectedQuestionnaireId: string | null, setSelectedQuestionnaireId: (id: string) => void }
) {

    const isQuestionnaireComplete = (questionnaire: any) => {
        return questionnaire.answers && Object.keys(questionnaire.answers).length > 0;
    };

    const formatQuestionnaireDate = (dateString: string) => {
        const date = new Date(dateString);
        return {
            date: formatDate(dateString),
            time: date.toLocaleTimeString('ru-RU', {
                hour: '2-digit',
                minute: '2-digit',
                timeZone: KZ_TZ
            })
        };
    };

    return (
        <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Выберите анкету:</h4>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                {analysis.map((analys: any, index: number) => {
                    const { date, time } = formatQuestionnaireDate(analys.created_at);
                    const isSelected = selectedQuestionnaireId === analys.id;

                    return (
                        <div key={analys.id}>
                            <div
                                onClick={() => setSelectedQuestionnaireId(analys.id)}
                                className={`
                                    flex items-center justify-between p-4 cursor-pointer transition-all duration-200
                                    ${isSelected
                                        ? 'bg-purple-50 border-l-4 border-l-purple-500'
                                        : 'hover:bg-gray-50'
                                    }
                                    ${index !== analysis.length - 1 ? 'border-b border-gray-100' : ''}
                                `}
                            >
                                {/* Левая часть: иконка + информация */}
                                <div className="flex items-center gap-4 flex-1">
                                    {/* Фиолетовая иконка */}
                                    <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                                        <FileTextIcon className="w-5 h-5 text-white" />
                                    </div>

                                    {/* Информация об анкете */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-4">
                                            <div>
                                                <h3 className="font-medium text-gray-900 truncate">
                                                    Предварительная анкета
                                                </h3>
                                                <p className="text-sm text-gray-500">
                                                    {date}
                                                </p>
                                            </div>

                                            {/* Время и статус - на мобильных под названием, на десктопе справа */}
                                            <div className="flex items-center gap-2 sm:flex-col sm:items-end">
                                                <span className="text-sm font-medium text-green-600">
                                                    {time}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Правая часть: кнопка/стрелка */}
                                <div className="flex items-center gap-2 ml-4">
                                    {/* Кнопка "Открыть" для десктопа */}
                                    <div className="hidden md:block" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                                        <Link href={`/patient/chat/${analys.id}`}>
                                            <MyButton className="text-xs px-3 py-1.5 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors">
                                                Открыть
                                            </MyButton>
                                        </Link>
                                    </div>

                                    {/* Стрелка для мобильных */}
                                    <div className="md:hidden">
                                        <Link href={`/patient/chat/${analys.id}`}>
                                            <ChevronRightIcon className="w-5 h-5 text-gray-400" />
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    )
}
