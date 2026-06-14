'use client';

import React from 'react';
import Image from 'next/image';

interface VoiceRecorderModalProps {
    isRecording: boolean;
    recordingTime: number;
    onStop: () => void;
    onRemove: () => void;
}

const VoiceRecorderModal: React.FC<VoiceRecorderModalProps> = ({ 
    isRecording, 
    recordingTime,
    onStop,
    onRemove
}) => {
    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    if (!isRecording) return null;

    return (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
            <div className="flex flex-col items-center gap-3">
                <button
                    onClick={onStop}
                    className="relative group"
                >
                    {/* Большой внешний круг */}
                    <div className="absolute -inset-6 animate-ping rounded-full bg-teal-200/25"></div>
                    {/* Средний круг */}
                    <div className="absolute -inset-3 animate-pulse rounded-full bg-cyan-200/30"></div>
                    {/* Основной круг с микрофоном */}
                    <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-primary transition-colors group-hover:bg-primaryDark">
                        <Image 
                            src="/image/chat/dict.svg" 
                            alt="recording" 
                            width={40} 
                            height={40}
                            className="animate-pulse"
                        />
                    </div>
                </button>
                
                {/* Таймер и кнопка удаления */}
                <div className="flex items-center gap-1 mt-3 text-lg bg-black/50 backdrop-blur-sm rounded-full">
                    <div className="flex items-center gap-2  px-3 py-1.5 ">
                        <span className="inline-block w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span>
                        <span className="text-white/90 font-medium">{formatTime(recordingTime)}</span>
                    </div>
                    <button
                        onClick={onRemove}
                        className=" hover:bg-red-300/50 rounded-full p-2 transition-all duration-300"
                        title="Удалить запись"
                    >
                        <Image src="/image/chat/delete.svg" alt="remove" width={30} height={30} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default VoiceRecorderModal;