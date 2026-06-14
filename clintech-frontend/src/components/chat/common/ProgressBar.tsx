import React from 'react';

interface IProgressBarProps {
    currentAnswers: number;
    totalQuestions: number;
}

export const ProgressBar: React.FC<IProgressBarProps> = ({ currentAnswers, totalQuestions }) => {
    const progress = (currentAnswers / totalQuestions) * 100;

    return (
        <div className="w-full mx-auto px-4 sm:px-6 mt-2 sm:mt-4">
            <div className="flex justify-between items-center mb-1">
                <div className="text-base sm:text-lg text-white">
                    Вопрос
                </div>
                <div className="text-lg sm:text-2xl font-semibold text-white">
                    {currentAnswers} из {totalQuestions}
                </div>
            </div>
            <div className="w-full bg-white/20 rounded-full h-2 sm:h-2.5">
                <div
                    className="h-2 sm:h-2.5 bg-white rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                />
            </div>
        </div>
    );
}; 