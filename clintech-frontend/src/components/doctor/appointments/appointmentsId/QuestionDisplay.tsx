import dynamic from 'next/dynamic';
const VoiceRecorder = dynamic(() => import('@/components/doctor/appointments/appointmentsId/VoiceRecorder'), { ssr: false });
import React, { useEffect, useState } from 'react'


interface QuestionDisplayProps {
    onChange: (value: string) => void
    onVoiceRecordingChange: (isRecording: boolean) => void
    value?: string
}
export const QuestionDisplay: React.FC<QuestionDisplayProps> = ({
    onChange,
    onVoiceRecordingChange,
    value
}) => {
    const [isRecording, setIsRecording] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [text, setText] = useState('');

    // Синхронизируем текст из пропсов
    useEffect(() => {
        if (typeof value === 'string' && value !== text) {
            setText(value);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);

    const handleVoiceRecordingChange = (recording: boolean) => {
        setIsRecording(recording);
        onVoiceRecordingChange(recording);
    };

    const handleTranscriptionStart = () => {
        setIsTranscribing(true);
    };

    const handleTranscriptionEnd = () => {
        setIsTranscribing(false);
    };

    const handleTranscriptionComplete = (transcript: string) => {
        const updatedText = (text && text.trim().length > 0)
            ? text.trim() + '\n' + transcript
            : transcript;
        setText(updatedText);
        onChange(updatedText);
    };

    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setText(e.target.value);
        onChange(e.target.value);
    }

    return (
        <div className="mx-auto mt-8 mb-5 w-full">
            <div className="font-semibold text-black mb-4 text-2xl">
                Ведите запись приема
            </div>
            
            <div className="mb-4 text-sm text-amber-600 border border-amber-600 rounded-md p-3 bg-amber-50">
            Важно: Прикрепите все необходимые файлы до завершения приема во вкладке "Файлы приема". После генерации паспорта здоровья новые файлы не будут в него включены.
            </div>

            {/* Минимальный индикатор транскрипции */}
            {isTranscribing && (
                <div className="mb-3 flex items-center space-x-2 text-blue-600 text-sm">
                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    <span>Обрабатывается голосовое сообщение...</span>
                </div>
            )}

            <div className="font-bold text-[rgba(7,0,125,1)] mb-3">Напишите запись приема самостоятельно</div>
            <textarea
                value={text}
                onChange={handleTextChange}
                rows={6}
                placeholder="Введите здесь свой подробный ответ или используйте голосовой ввод..."
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-base text-black shadow resize-y focus:outline-none focus:border-blue-500 transition min-h-[120px]"
            />

            
            

            <VoiceRecorder
                onRecordingChange={handleVoiceRecordingChange}
                onTranscriptionComplete={handleTranscriptionComplete}
                onTranscriptionStart={handleTranscriptionStart}
                onTranscriptionEnd={handleTranscriptionEnd}
            />
        </div>
    );
};
