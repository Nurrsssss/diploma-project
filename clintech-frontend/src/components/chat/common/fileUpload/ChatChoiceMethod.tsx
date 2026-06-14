import MyButton from '@/components/ui/MyButton';
import React from 'react'

interface IChatChoiceMethodProps {
    onClose: () => void;
    onFileUpload: () => void;
    onSmartCamera: () => void;
}

export default function ChatChoiceMethod({ onClose, onFileUpload, onSmartCamera }: IChatChoiceMethodProps) {
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 relative">
                <MyButton
                    onClick={onClose}
                    className="absolute top-4 shadow-none right-4 p-3 hover:bg-red-100 hover:text-red-600 rounded-full transition-all duration-300 hover:scale-110 font-bold text-xl text-black"
                >
                    ✕
                </MyButton>
                <h2 className="text-2xl font-bold text-center text-gray-800 mb-4">
                    Выберите способ добавления
                </h2>
                <div className="grid gap-4">
                    <MyButton
                        onClick={() => {
                            onClose();
                            onFileUpload();
                        }}
                        className="w-full bg-blue-100 hover:bg-blue-200 rounded-lg py-4 text-lg font-semibold text-blue-800 transition-colors"
                    >
                        📤 Загрузить файл
                    </MyButton>
                    <MyButton
                        onClick={() => {
                            onClose();
                            onSmartCamera();
                        }}
                        className="w-full bg-green-100 hover:bg-green-200 rounded-lg py-4 text-lg font-semibold text-green-800 transition-colors"
                    >
                        📷 Умная камера
                    </MyButton>
                </div>
            </div>
        </div>
    )
}
