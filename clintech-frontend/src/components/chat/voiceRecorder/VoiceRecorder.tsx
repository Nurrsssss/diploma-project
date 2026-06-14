'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useReactMediaRecorder } from 'react-media-recorder';
import Image from 'next/image';
import { useVoiceTranscription } from '@/hooks/chat/useVoiceTranscription';
import VoiceErrorCard from '@/components/chat/voiceRecorder/VoiceErrorCard';
import VoiceRecorderModal from '@/components/chat/voiceRecorder/VoiceRecorderModal';


interface IChatVoiceRecorderProps {
    onTranscriptionComplete: (text: string) => void;
}

const ChatVoiceRecorder: React.FC<IChatVoiceRecorderProps> = ({ onTranscriptionComplete }) => {
    const [recordingTime, setRecordingTime] = useState(0);
    const [timerInterval, setTimerInterval] = useState<NodeJS.Timeout | null>(null);
    const [microphoneError, setMicrophoneError] = useState<string | null>(null);
    const [transcriptionAttempts, setTranscriptionAttempts] = useState(0);
    const [showRetryPrompt, setShowRetryPrompt] = useState(false);
    const isRemoving = useRef(false);
    const { transcribeAudio, isTranscribing, error, clearError } = useVoiceTranscription();

    const {
        status,
        startRecording,
        stopRecording,
        error: mediaError
    } = useReactMediaRecorder({
        audio: true,
        onStart: () => {
            setMicrophoneError(null);
            setShowRetryPrompt(false);
            clearError();
        },
        onStop: async (blobUrl, blob) => {
            if (blob && !isRemoving.current) {
                await handleTranscription(blob);
            }
        }
    });

    // Проверка доступности микрофона
    useEffect(() => {
        const checkMicrophone = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                stream.getTracks().forEach(track => track.stop());
                setMicrophoneError(null);
            } catch (err) {
                console.error('Microphone access error:', err);
                setMicrophoneError('Микрофон недоступен. Проверьте разрешения браузера.');
            }
        };

        checkMicrophone();
    }, []);

    const handleTranscription = async (audioBlob: Blob) => {
        if (isRemoving.current) return;

        try {
            const result = await transcribeAudio(audioBlob);

            // Фильтруем нежелательные результаты
            const filteredResult = result && result.trim();
            const isValidTranscription = filteredResult &&
                filteredResult.length > 0 &&
                !filteredResult.toLowerCase().includes('продолжение следует') &&
                !filteredResult.toLowerCase().includes('продолжение...') &&
                !filteredResult.toLowerCase().includes('следует');

            if (isValidTranscription) {
                // Успешная транскрипция
                setTranscriptionAttempts(0);
                setShowRetryPrompt(false);
                onTranscriptionComplete(filteredResult);
            } else {
                // Пустая транскрипция или нежелательный результат - просим повторить
                handleEmptyTranscription();
            }
        } catch (err) {
            console.error('Transcription failed:', err);
            handleTranscriptionError();
        }
    };

    const handleEmptyTranscription = () => {
        setTranscriptionAttempts(prev => prev + 1);
        setShowRetryPrompt(true);

        // Автоматически скрываем подсказку через 8 секунд
        setTimeout(() => {
            setShowRetryPrompt(false);
        }, 8000);
    };

    const handleTranscriptionError = () => {
        setTranscriptionAttempts(prev => prev + 1);
        setShowRetryPrompt(true);

        setTimeout(() => {
            setShowRetryPrompt(false);
        }, 8000);
    };

    const startTimer = () => {
        const interval = setInterval(() => {
            setRecordingTime(prev => prev + 1);
        }, 1000);
        setTimerInterval(interval);
    };

    const stopTimer = () => {
        if (timerInterval) {
            clearInterval(timerInterval);
            setTimerInterval(null);
        }
        setRecordingTime(0);
    };

    const handleStartRecording = () => {
        if (microphoneError) {
            setMicrophoneError('Микрофон недоступен. Проверьте разрешения браузера.');
            return;
        }

        isRemoving.current = false;
        setShowRetryPrompt(false);
        clearError();
        startRecording();
        startTimer();
    };

    const handleStopRecording = () => {
        stopRecording();
        stopTimer();
    };

    const handleRemoveRecording = () => {
        isRemoving.current = true;
        stopRecording();
        stopTimer();
        setRecordingTime(0);
        setShowRetryPrompt(false);
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };



    const getErrorMessage = () => {
        if (microphoneError || error || mediaError) {
            return {
                title: "Не удалось распознать речь",
                message: "Пожалуйста, проверьте микрофон или попробуйте сказать громче и четче",
                type: "error" as const,
                showRetry: true
            };
        }
        return null;
    };

    const handleRetry = () => {
        setShowRetryPrompt(false);
        clearError();
        handleStartRecording();
    };



    return (
        <>
            <VoiceRecorderModal 
                isRecording={status === 'recording'} 
                recordingTime={recordingTime}
                onStop={handleStopRecording}
                onRemove={handleRemoveRecording}
            />
            
            <div className="relative">
                {isTranscribing ? (
                    <div className="animate-spin p-3 transition-all duration-300 ease-in-out">
                        <Image src="/image/chat/loader.svg" alt="loading" width={24} height={24} />
                    </div>
                ) : (
                    <button
                        onClick={handleStartRecording}
                        disabled={!!microphoneError || status === 'recording'}
                        className={`text-white rounded-full p-4 transition-all duration-300 ease-in-out transform hover:scale-110 active:scale-95 ${
                            microphoneError
                                ? 'bg-gray-400 cursor-not-allowed'
                                : status === 'recording'
                                ? 'cursor-default bg-primaryDark'
                                : 'bg-primary hover:bg-primaryDark'
                        }`}
                        aria-label="Start recording"
                    >
                        <Image src="/image/chat/dict.svg" alt="mic" width={24} height={24} />
                    </button>
                )}
            </div>

            {/* Сообщения об ошибках и подсказки */}
            {(() => {
                const errorMessage = getErrorMessage();
                return errorMessage && (
                    <VoiceErrorCard
                        title={errorMessage.title}
                        message={errorMessage.message}
                        type={errorMessage.type}
                        showRetry={errorMessage.showRetry}
                        handleRetry={handleRetry}
                        setShowRetryPrompt={setShowRetryPrompt}
                    />
                );
            })()}

        </>
    );
};

export default ChatVoiceRecorder;
