import MyButton from '@/components/ui/MyButton';
import React from 'react'

interface IChatUploadActionsProps {
    onSkip: () => void;
    onSubmit: () => void;
    selectedFiles: File[];
}

export default function ChatUploadActions({ onSkip, onSubmit, selectedFiles }: IChatUploadActionsProps) {
    return (
        <div className="flex justify-between gap-2">
            <MyButton
                onClick={selectedFiles.length === 0 ? onSubmit : onSkip}
                className="px-6 py-2 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors"
            >
                {selectedFiles.length === 0 ? 'Генерировать анкету' : 'Пропустить'}
            </MyButton>
            <MyButton
                onClick={selectedFiles.length > 0 ? onSubmit : onSkip}
                disabled={selectedFiles.length === 0}
                className="px-6 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {selectedFiles.length > 0 ? 'Генерировать анкету' : 'Продолжить (0)'}
            </MyButton>
        </div>
    )
}
