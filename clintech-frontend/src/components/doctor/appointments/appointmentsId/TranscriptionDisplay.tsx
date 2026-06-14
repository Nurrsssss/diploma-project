import React, { useState } from 'react';
import MyButton from '@/components/ui/MyButton';
import { FileText, ChevronDown, ChevronUp } from 'lucide-react';

interface TranscriptionDisplayProps {
    transcriptionText: string;
    className?: string;
}

export default function TranscriptionDisplay({ transcriptionText, className = '' }: TranscriptionDisplayProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    
    // Максимальная длина для сокращенного отображения
    const maxLength = 200;
    const shouldTruncate = transcriptionText.length > maxLength;
    
    // Текст для отображения
    const displayText = isExpanded || !shouldTruncate 
        ? transcriptionText 
        : transcriptionText.slice(0, maxLength) + '...';

    return (
        <div className={`bg-gray-50 border border-gray-200 rounded-xl p-4 ${className}`}>
            <div className="flex items-center gap-2 mb-3">
                {/* <FileText className="w-5 h-5 text-gray-600" /> */}
                <h3 className="w-full text-gray-800 font-semibold border-b border-gray-400 pb-2">Запись приема</h3>
            </div>
            
            <div className={`text-gray-700 text-sm leading-relaxed ${isExpanded ? 'max-h-96 overflow-y-auto' : ''}`}>
                <p className="whitespace-pre-wrap">{displayText}</p>
            </div>
            
            {shouldTruncate && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                    <MyButton
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="text-gray-600 bg-white hover:bg-gray-100 border border-gray-300 text-sm px-3 py-1.5 flex items-center gap-1 rounded-lg"
                    >
                        {isExpanded ? (
                            <>
                                <ChevronUp className="w-4 h-4" />
                                Свернуть
                            </>
                        ) : (
                            <>
                                <ChevronDown className="w-4 h-4" />
                                Прочитать полностью
                            </>
                        )}
                    </MyButton>
                </div>
            )}
        </div>
    );
}
