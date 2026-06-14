import React from 'react';
import MyButton from '@/components/ui/MyButton';

interface IVoiceErrorCardProps {
    title: string;
    message: string;
    type: 'error' | 'warning' | 'info';
    showRetry?: boolean;
    handleRetry: () => void;
    setShowRetryPrompt: (show: boolean) => void;
}

export default function VoiceErrorCard({ title, message, type, showRetry = false, handleRetry, setShowRetryPrompt }: IVoiceErrorCardProps) {
    const bgColor = type === 'error' ? 'bg-red-50 border-red-200' :
        type === 'warning' ? 'bg-orange-50 border-orange-200' :
            'bg-blue-50 border-blue-200';

    const textColor = type === 'error' ? 'text-red-800' :
        type === 'warning' ? 'text-orange-800' :
            'text-blue-800';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className={`relative ${bgColor} border rounded-2xl p-6 max-w-xs w-full shadow-2xl animate-fade-in`}>
                <button
                    onClick={() => setShowRetryPrompt(false)}
                    className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 text-2xl font-bold"
                    aria-label="Закрыть"
                >
                    ×
                </button>
                <div className="flex flex-col items-center text-center">
                    <h4 className={`font-bold text-base mb-2 ${textColor}`}>{title}</h4>
                    <p className={`text-sm mb-4 ${textColor} opacity-90`}>{message}</p>
                    <div className="flex gap-2 mt-2 justify-center">
                        {showRetry && (
                            <MyButton
                                onClick={handleRetry}
                                className="text-xs bg-white border border-current rounded-lg px-3 py-1 font-semibold hover:bg-opacity-10 transition-colors"
                            >
                                Повторить
                            </MyButton>
                        )}
                        
                    </div>
                </div>
            </div>
        </div>
    );
};