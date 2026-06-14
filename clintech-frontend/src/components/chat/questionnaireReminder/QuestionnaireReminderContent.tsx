import { AlertCircle, X } from 'lucide-react'
import MyButton from '@/components/ui/MyButton'
import Link from 'next/link'

export default function QuestionnaireReminderContent({ handleClose }: { handleClose: () => void }) {
    return (
        <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4"
            onClick={handleClose}
        >
            {/* Модальное окно */}
            <div
                className=" bg-white rounded-2xl p-6 max-w-md w-full mx-4 relative shadow-2xl"
                onClick={(e) => e.stopPropagation()} // Предотвращаем закрытие при клике на само окно
            >
                {/* Кнопка закрытия */}
                <button
                    onClick={handleClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-1 transition-colors"
                    aria-label="Закрыть"
                >
                    <X className="w-5 h-5" />
                </button>

                {/* Контент модального окна */}
                <div className="md:px-4 flex flex-col items-center justify-center">
                    <div className="flex items-center gap-3 mb-4">
                        <AlertCircle className="w-6 h-6 text-primary flex-shrink-0" />
                        <h4 className="font-semibold text-lg leading-tight">
                            Предварительный опрос
                        </h4>
                    </div>

                    <p className="text-center text-gray-700 mb-6 leading-relaxed">
                        Для более точной консультации необходимо предварительно ответить на несколько вопросов о вашем здоровье
                    </p>

                    <div className="flex gap-3">
                        <Link href="/patient/chat">
                            <MyButton
                                onClick={handleClose}
                                className='bg-primary hover:bg-primary/90 text-white flex-1'
                            >
                                Перейти к опросу
                            </MyButton>
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    )
}
