'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useReactMediaRecorder } from 'react-media-recorder';
import Image from 'next/image';
import { DictButton, ControlButton, AudioRemoveButton } from '@/components/voice-recorder/VoiceRecorderButtons'
import { useVoiceTranscription } from '@/hooks/chat/useVoiceTranscription';

type RecordingStatus = 'idle' | 'recording' | 'paused' | 'stopped';

interface VoiceRecorderProps {
    questionId: string;
    onRecordingChange: (isRecording: boolean) => void;
    onTranscriptionComplete?: (text: string) => void;
}

const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
    questionId,
    onRecordingChange,
    onTranscriptionComplete
}) => {
    const [timer, setTimer] = useState(0);
    const [isTimerRunning, setIsTimerRunning] = useState(false);
    const [isRecordingComplete, setIsRecordingComplete] = useState(false);
    const [currentRecording, setCurrentRecording] = useState<string | null>(null);
    const isRemoving = useRef(false);
    
    const { isTranscribing, transcribeAudio, error: transcriptionError } = useVoiceTranscription();

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
            if (blob && !isRemoving.current) {
                await handleTranscription(blob);
            }
        }
    });

    const handleTranscription = async (audioBlob: Blob) => {
        if (isRemoving.current) return;

        const transcription = await transcribeAudio(audioBlob);
        if (transcription && onTranscriptionComplete && !isRemoving.current) {
            onTranscriptionComplete(transcription);
        }
    };

    const recordingStatus = status as RecordingStatus;

    useEffect(() => {
        // Reset state when question changes
        setTimer(0);
        setIsTimerRunning(false);
        setIsRecordingComplete(false);
        setCurrentRecording(null);
        isRemoving.current = false;
    }, [questionId]);

    useEffect(() => {
        // Notify parent about recording state
        onRecordingChange(recordingStatus === 'recording' || recordingStatus === 'paused');
    }, [recordingStatus, onRecordingChange]);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isTimerRunning) {
            interval = setInterval(() => {
                setTimer((prev) => prev + 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isTimerRunning]);

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
    };

    const handleStop = () => {
        isRemoving.current = false;
        stopRecording();
        setIsTimerRunning(false);
        setIsRecordingComplete(true);
        onRecordingChange(false);
    };

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
        onRecordingChange(false);
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
                    className="group relative transition-all duration-300 hover:scale-110 active:scale-95"
                >
                    <div
                        className="absolute inset-0 animate-pulse rounded-full bg-teal-400/40 opacity-0 transition-opacity duration-300 group-active:opacity-80 group-hover:opacity-100" />
                    <div
                        className="absolute inset-[-18px] animate-pulse rounded-full bg-cyan-300/35 opacity-0 transition-opacity duration-300 group-active:opacity-80 group-hover:opacity-100"
                        style={{ animationDelay: '0.2s' }} />
                    <div
                        className="absolute inset-[-36px] animate-pulse rounded-full bg-teal-100/50 opacity-0 transition-opacity duration-300 group-active:opacity-80 group-hover:opacity-100"
                        style={{ animationDelay: '0.4s' }} />
                    <Image
                        src={`/image/health-check/voice/${recordingStatus === 'paused' ? 'resume' : 'stop'}.svg`}
                        alt={recordingStatus === 'paused' ? 'Resume' : 'Stop'}
                        width={64}
                        height={64}
                        className="relative rounded-full transition-all duration-300 group-hover:scale-105 group-active:scale-95"
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
                    <div className="flex mb-8 gap-20">
                        <ControlButton type="remove" onClick={handleRemove} className={`mt-3 transition-all duration-500 ${isActive ? 'opacity-100 scale-100' : 'opacity-0 scale-95 hidden'}`} />
                        <div className="flex flex-col items-center gap-2">
                            <div className="flex">
                                {renderMainButton()}
                            </div>
                        </div>
                        <ControlButton type="done" onClick={handleStop} className={`mt-3 transition-all duration-500 ${isActive ? 'opacity-100 scale-100' : 'opacity-0 scale-95 hidden'}`} />
                    </div>
                    <div
                        className={`transition-all text-center duration-500 ${isActive ? 'opacity-100 scale-100' : 'opacity-0 scale-95 hidden'}`}>
                        <div className="my-2 font-poppins text-3xl font-bold text-teal-900">{formatTime(timer)}</div>
                        <div className="font-sans text-lg font-normal text-slate-600">
                            {isTranscribing ? 'Транскрибируем запись...' : 'Ваша запись идет...'}
                        </div>
                    </div>

                    <div
                        className={`transition-all duration-500 text-center ${!isActive ? 'opacity-100 scale-100' : 'opacity-0 scale-95 hidden'}`}>
                        <div className="mb-2 font-poppins text-lg font-semibold text-slate-900">Нажмите, чтобы начать запись</div>
                    </div>
                </div>
            </div>

            <div
                className={`transition-all duration-500 ${isRecordingComplete && currentRecording ? 'opacity-100 scale-100' : 'opacity-0 scale-95 hidden'}`}>
                <div className="flex items-center gap-4">
                    {currentRecording && <audio controls src={currentRecording} className="w-70 h-15" />}
                    <AudioRemoveButton onClick={handleRemove} />
                </div>
            </div>
        </div>
    );
};

export default VoiceRecorder; 