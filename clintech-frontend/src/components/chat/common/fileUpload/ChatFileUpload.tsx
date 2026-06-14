'use client';

import React, { useState } from 'react';
import FileUpload from '@/components/scanner/FileUpload';
import SmartCamera from '@/components/scanner/SmartCamera';
import Image from 'next/image';
import MyButton from '@/components/ui/MyButton';
import ChatSelectedFile from './ChatSelectedFile';
import ChatChoiceMethod from './ChatChoiceMethod';
import ChatUploadActions from './ChatUploadActions';

interface Props {
    onFilesSelected: (files: File[]) => void;
    onSubmit: () => void;
    onSkip: () => void;
}

const ChatFileUpload: React.FC<Props> = ({ onFilesSelected, onSubmit, onSkip }) => {
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [isScanOptionsModalOpen, setIsScanOptionsModalOpen] = useState(false);
    const [isFileUploadOpen, setIsFileUploadOpen] = useState(false);
    const [isSmartCameraOpen, setIsSmartCameraOpen] = useState(false);

    const handleFilesSelect = (files: File[]) => {
        setSelectedFiles(files);
        onFilesSelected(files);
    };

    const removeFile = (index: number) => {
        const updatedFiles = selectedFiles.filter((_, i) => i !== index);
        setSelectedFiles(updatedFiles);
        onFilesSelected(updatedFiles);
    };


    return (
        <div
            className="fixed bottom-0 left-0 right-0 border-t border-teal-200/50 bg-cyan-50/90 p-4 shadow backdrop-blur-sm sm:static sm:rounded-b-xl">
            <div className="flex flex-col gap-4">
                {/* Кнопка открытия модалки выбора */}
                <MyButton
                    onClick={() => setIsScanOptionsModalOpen(true)}
                    className="
                      flex items-center justify-center gap-3
                      w-full bg-primary hover:bg-primary/90
                      text-white font-semibold
                      rounded-lg py-4 px-6 shadow-lg
                      transition-all duration-300 transform
                    "
                >
                    <Image
                        src="/image/chat/upload.svg"
                        alt="upload"
                        width={24}
                        height={24}
                    />
                    <span className="text-lg">Добавить файлы или сделать снимок</span>
                </MyButton>


                {/* Список выбранных файлов */}
                {selectedFiles.length > 0 && (
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                        {selectedFiles.map((file, index) => (
                            <ChatSelectedFile key={index} file={file} index={index} removeFile={removeFile} />
                        ))}
                    </div>
                )}

                {/* Кнопки действий */}
                <ChatUploadActions
                    onSkip={onSkip}
                    onSubmit={onSubmit}
                    selectedFiles={selectedFiles}
                />
            </div>

            {/* Модальное окно выбора способа загрузки */}
            {isScanOptionsModalOpen && (
                <ChatChoiceMethod
                    onClose={() => setIsScanOptionsModalOpen(false)}
                    onFileUpload={() => setIsFileUploadOpen(true)}
                    onSmartCamera={() => setIsSmartCameraOpen(true)}
                />
            )}

            {/* Модалки FileUpload и SmartCamera */}
            <FileUpload
                isOpen={isFileUploadOpen}
                onClose={() => setIsFileUploadOpen(false)}
                onFilesSelect={handleFilesSelect}
                currentFiles={selectedFiles}
            />

            <SmartCamera
                isOpen={isSmartCameraOpen}
                onClose={() => setIsSmartCameraOpen(false)}
                onFileProcessed={(file) => {
                    // Добавляем обработанный файл в список выбранных файлов
                    const updatedFiles = [...selectedFiles, file];
                    setSelectedFiles(updatedFiles);
                    onFilesSelected(updatedFiles);
                }}
            />
        </div>
    );
};

export default ChatFileUpload;
