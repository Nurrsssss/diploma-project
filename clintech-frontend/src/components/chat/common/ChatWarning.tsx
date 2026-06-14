import React from 'react'

export default function ChatWarning() {
    return (
        <div className='mb-4 p-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-800 rounded'>
            <div className="flex items-start gap-2">
                <span className="text-xl">⚠️</span>
                <div>
                    <p className='font-bold'>Важное предупреждение!</p>
                    <p className="text-sm">
                        Эти рекомендации сгенерированы искусственным интеллектом и носят исключительно информационный характер.
                        Они НЕ являются медицинским диагнозом или назначением. Для получения профессиональной медицинской помощи
                        обязательно обратитесь к квалифицированному врачу.
                    </p>
                </div>
            </div>
        </div>
    )
}
