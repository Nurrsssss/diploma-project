'use client';
import React, { useRef, useEffect } from 'react';
import Image from 'next/image';
import dynamic from "next/dynamic";

const VoiceRecorder = dynamic(
    () => import("@/components/chat/voiceRecorder/VoiceRecorder"),
    { ssr: false }
);

interface Props {
    value: string;
    onChange: (value: string) => void;
    onNext: () => void;
    onVoiceInput: (text: string) => void;
}

const ChatInput: React.FC<Props> = ({ value, onChange, onNext, onVoiceInput }) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onNext();
        }
    };

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [value]);

    return (
        <div className="container fixed bottom-0 left-0 right-0 z-30 border-t border-teal-200/60 bg-teal-50/95 p-4 shadow backdrop-blur-sm sm:rounded-b-xl">
            <div className="flex sm:flex-row gap-3 items-center">
                <textarea
                    ref={textareaRef}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="min-h-[48px] max-h-[200px] flex-1 resize-none overflow-hidden rounded-2xl border border-teal-200/80 bg-white p-3 text-black placeholder:text-[16px]"
                    placeholder="Введите свой ответ..."
                    rows={1}
                />

                <div className="flex items-center gap-2">
                    {/* Кнопка отправки текста */}
                    <button
                        onClick={onNext}
                        className="flex items-center justify-center rounded-full bg-gradient-to-r from-primary to-accent p-4 text-center text-white transition-all duration-300 hover:from-accent hover:to-primary"
                    >
                        <Image src="/image/chat/send.svg" alt="send" width={24} height={24} />
                    </button>

                    {/* Кнопка голосового ввода */}
                    <VoiceRecorder 
                        onTranscriptionComplete={(text) => {
                            onChange('');
                            onVoiceInput(text);
                        }} 
                    />
                </div>
            </div>
        </div>
    );
};

export default ChatInput;