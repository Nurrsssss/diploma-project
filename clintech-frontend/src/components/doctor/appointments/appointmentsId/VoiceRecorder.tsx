'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useReactMediaRecorder } from 'react-media-recorder';
import Image from 'next/image';
import { DictButton, ControlButton } from '@/components/voice-recorder/VoiceRecorderButtons'
import { useVoiceTranscription } from '@/hooks/chat/useVoiceTranscription';

type RecordingStatus = 'idle' | 'recording' | 'paused' | 'stopped';

interface VoiceRecorderProps {
    onRecordingChange: (isRecording: boolean) => void;
    onTranscriptionComplete: (transcript: string) => void;
    onTranscriptionStart?: () => void;
    onTranscriptionEnd?: () => void;
}


const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
    onRecordingChange,
    onTranscriptionComplete,
    onTranscriptionStart,
    onTranscriptionEnd
}) => {
    const [timer, setTimer] = useState(0);
    const MAX_RECORDING_TIME = 10000; // 10000 секунд 
    const [isTimerRunning, setIsTimerRunning] = useState(false);
    const [isRecordingComplete, setIsRecordingComplete] = useState(false);
    const [currentRecording, setCurrentRecording] = useState<string | null>(null);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [isTranscriptionSuccess, setIsTranscriptionSuccess] = useState(false);
    const [transcriptionError, setTranscriptionError] = useState<string | null>(null);
    const isRemoving = useRef(false);
    const { transcribeAudio, error } = useVoiceTranscription();

    const {
        status,
        startRecording,
        stopRecording,
        pauseRecording,
        resumeRecording,
        mediaBlobUrl,
    } = useReactMediaRecorder({
        audio: true,
        onStop: async (blobUrl, blob) => {
            setCurrentRecording(blobUrl);
            setAudioBlob(blob);
            // НЕ запускаем транскрипцию автоматически
        }
    });

    const handleStop = useCallback(() => {
        isRemoving.current = false;
        stopRecording();
        setIsTimerRunning(false);
        setIsRecordingComplete(true);
        onRecordingChange(false);
    }, [stopRecording, onRecordingChange]);

    const handleTranscription = async (audioBlob: Blob) => {
        if (isRemoving.current) return;

        // Сбрасываем предыдущие состояния
        setIsTranscriptionSuccess(false);
        setTranscriptionError(null);

        // Уведомляем о начале транскрипции
        if (onTranscriptionStart) {
            onTranscriptionStart();
        }
        setIsTranscribing(true);

        const result = await transcribeAudio(audioBlob);

        // Уведомляем о завершении транскрипции
        if (onTranscriptionEnd) {
            onTranscriptionEnd();
        }
        setIsTranscribing(false);

        if (result && !isRemoving.current) {
            setIsTranscriptionSuccess(true);
            onTranscriptionComplete(result);

            // Показываем успех 2 секунды, затем очищаем
            setTimeout(() => {
                setIsTranscriptionSuccess(false);
                handleRemove();
            }, 2000);
        } else if (!isRemoving.current) {
            // Показываем универсальное сообщение об ошибке
            setTranscriptionError('Не удалось отправить аудио. Пожалуйста, попробуйте еще раз');

            // Очищаем ошибку через 5 секунд
            setTimeout(() => {
                setTranscriptionError(null);
            }, 5000);
        }
    };

    const handleStartTranscription = () => {
        if (audioBlob) {
            handleTranscription(audioBlob);
        }
    };

    const recordingStatus = status as RecordingStatus;

    useEffect(() => {
        // Reset state when question changes
        setTimer(0);
        setIsTimerRunning(false);
        setIsRecordingComplete(false);
        setCurrentRecording(null);
        setAudioBlob(null);
        setIsTranscribing(false);
        setIsTranscriptionSuccess(false);
        setTranscriptionError(null);
        isRemoving.current = false;
    }, []);

    useEffect(() => {
        // Notify parent about recording state
        onRecordingChange(recordingStatus === 'recording' || recordingStatus === 'paused');
    }, [recordingStatus, onRecordingChange]);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isTimerRunning) {
            interval = setInterval(() => {
                setTimer((prev) => {
                    const newTime = prev + 1;
                    // Автоматически останавливаем запись при достижении лимита
                    if (newTime >= MAX_RECORDING_TIME) {
                        handleStop();
                    }
                    return newTime;
                });
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isTimerRunning, handleStop]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const handleStart = () => {
        isRemoving.current = false;
        startRecording();
        setIsTimerRunning(true);
        setTimer(0);
        setCurrentRecording(null);
        setAudioBlob(null);
    };

    // handleStop определен выше

    const handlePauseResume = () => {
        if (recordingStatus === 'recording') {
            pauseRecording();
            setIsTimerRunning(false);
        } else if (recordingStatus === 'paused') {
            resumeRecording();
            setIsTimerRunning(true);
        }
    };

    const handleRemove = () => {
        isRemoving.current = true;
        setTimer(0);
        setIsTimerRunning(false);
        stopRecording();
        setIsRecordingComplete(false);
        setCurrentRecording(null);
        setAudioBlob(null);
        onRecordingChange(false);
    };

    const handleRerecord = () => {
        handleRemove();
        handleStart();
    };

    const renderMainButton = () => {
        if (isRecordingComplete) {
            return null;
        }

        const isRecording = recordingStatus === 'recording' || recordingStatus === 'paused';

        if (isRecording) {
            return (
                <button
                    onClick={handlePauseResume}
                    className="group relative transition-all duration-300 scale-110 sm:scale-100 active:scale-95"
                >
                    <div
                        className="absolute inset-0 animate-pulse rounded-full bg-teal-400/40 opacity-0 transition-opacity duration-300 group-active:opacity-80 group-hover:opacity-100" />
                    <div
                        className="absolute inset-[-28px] animate-pulse rounded-full bg-cyan-300/35 opacity-0 transition-opacity duration-300 group-active:opacity-80 group-hover:opacity-100 sm:inset-[-18px]"
                        style={{ animationDelay: '0.2s' }} />
                    <div
                        className="absolute inset-[-52px] animate-pulse rounded-full bg-teal-100/50 opacity-0 transition-opacity duration-300 group-active:opacity-80 group-hover:opacity-100 sm:inset-[-36px]"
                        style={{ animationDelay: '0.4s' }} />
                    <Image
                        src={`/image/health-check/voice/${recordingStatus === 'paused' ? 'resume' : 'stop'}.svg`}
                        alt={recordingStatus === 'paused' ? 'Resume' : 'Stop'}
                        width={80}
                        height={80}
                        className="relative rounded-full transition-all duration-300 w-20 h-20 sm:w-16 sm:h-16"
                    />
                </button>
            );
        }

        return <DictButton onClick={handleStart} />;
    };

    const isActive = recordingStatus === 'recording' || recordingStatus === 'paused';

    return (
        <div className="flex flex-col items-center gap-4 px-4 ">
            <div className="py-4 font-inter text-lg font-semibold text-primaryDark">
                Также можете записать свой ответ через голосовое сообщение
            </div>

            <div
                className={`mt-3 transition-all duration-500 ${!isRecordingComplete ? 'opacity-100 scale-100' : 'opacity-0 scale-95 hidden'}`}>
                <div className="flex flex-col items-center gap-3">
                    <div className="flex mb-8 gap-12 sm:gap-20">
                        <ControlButton type="remove" onClick={handleRemove} className={`mt-3 transition-all duration-500 ${isActive ? 'opacity-100 scale-110 sm:scale-100' : 'opacity-0 scale-95 hidden'}`} />
                        <div className="flex flex-col items-center gap-2">
                            <div className="flex">
                                {renderMainButton()}
                            </div>
                        </div>
                        <ControlButton type="done" onClick={handleStop} className={`mt-3 transition-all duration-500 ${isActive ? 'opacity-100 scale-110 sm:scale-100' : 'opacity-0 scale-95 hidden'}`} />
                    </div>
                    <div
                        className={`transition-all text-center duration-500 ${isActive ? 'opacity-100 scale-100' : 'opacity-0 scale-95 hidden'}`}>
                        <div className="my-2 font-poppins text-4xl font-bold text-teal-900 sm:text-3xl">{formatTime(timer)}</div>
                        <div className="font-sans text-xl font-normal text-slate-600 sm:text-lg">
                            {timer >= MAX_RECORDING_TIME - 30 ? (
                                <span className="text-amber-600">
                                    Осталось {MAX_RECORDING_TIME - timer} секунд...
                                </span>
                            ) : (
                                "Ваша запись идет..."
                            )}
                        </div>
                    </div>

                    <div
                        className={`transition-all duration-500 text-center ${!isActive ? 'opacity-100 scale-100' : 'opacity-0 scale-95 hidden'}`}>
                        <div className="mb-2 font-poppins text-xl font-semibold text-slate-900 sm:text-lg">Нажмите, чтобы начать запись</div>
                    </div>
                </div>
            </div>

            <div
                className={`transition-all duration-500 ${isRecordingComplete && currentRecording ? 'opacity-100 scale-100' : 'opacity-0 scale-95 hidden'}`}>
                <div className="flex flex-col items-center gap-4">
                    <div className="flex items-center gap-4">
                        {currentRecording && <audio controls src={currentRecording} className="w-52 h-15" />}
                    </div>

                    {/* Индикатор успеха */}
                    {isTranscriptionSuccess && (
                        <div className="flex items-center space-x-2 text-green-600 bg-green-50 border border-green-200 rounded-lg px-4 py-2">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <span className="text-sm font-medium">Текст успешно добавлен!</span>
                        </div>
                    )}

                    {/* Индикатор ошибки */}
                    {transcriptionError && (
                        <div className="flex items-center space-x-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-sm font-medium">{transcriptionError}</span>
                        </div>
                    )}

                    <div className="flex gap-4">
                        <button
                            onClick={handleRemove}
                            className="p-4 sm:p-3 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                            title="Удалить запись"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>

                        <button
                            onClick={handleRerecord}
                            className="p-4 sm:p-3 bg-gray-500 text-white rounded-full hover:bg-gray-600 transition-colors"
                            title="Перезаписать"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                        </button>


                        <button
                            onClick={handleStartTranscription}
                            disabled={isTranscribing}
                            className="rounded-full bg-primary p-4 text-white transition-colors hover:bg-primaryDark disabled:cursor-not-allowed disabled:opacity-50 sm:p-3"
                            title="Отправить голосовое сообщение"
                        >
                            {isTranscribing ? (
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                </svg>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VoiceRecorder;