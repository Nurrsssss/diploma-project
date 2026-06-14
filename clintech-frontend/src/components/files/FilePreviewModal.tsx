'use client';

import React from 'react';
import Modal from '@/components/ui/Modal';
import { X, Download, ZoomIn, ZoomOut } from 'lucide-react';
import MyButton from '@/components/ui/MyButton';
import Loader from '@/components/ui/Loader';

interface FilePreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    previewUrl: string | null;
    loading: boolean;
    error: string | null;
    fileName?: string;
    fileId?: string;
}

export default function FilePreviewModal({
    isOpen,
    onClose,
    previewUrl,
    loading,
    error,
    fileName = 'Файл',
    fileId
}: FilePreviewModalProps) {
    const [zoom, setZoom] = React.useState(1);

    const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 3));
    const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.25));
    const resetZoom = () => setZoom(1);

    React.useEffect(() => {
        if (isOpen) {
            setZoom(1); // Сбрасываем зум при открытии
        }
    }, [isOpen]);

    const getDownloadUrl = (id: string) => `/api/files/${id}/download`;

    const getFileExtension = (fileName: string) => {
        return fileName.split('.').pop()?.toLowerCase() || '';
    };

    const isImage = (fileName: string) => {
        const ext = getFileExtension(fileName);
        return ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'].includes(ext);
    };

    const isPdf = (fileName: string) => {
        return getFileExtension(fileName) === 'pdf';
    };

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={onClose}
            size="xl"
            showCloseButton={false}
            title={
                <div className="flex items-center justify-between w-full">
                    <span className="text-lg font-semibold truncate">
                        Предпросмотр: {fileName}
                    </span>
                    <div className="flex items-center gap-2">
                        {/* Кнопки управления зумом для изображений */}
                        {previewUrl && isImage(fileName) && (
                            <>
                                <MyButton
                                    onClick={handleZoomOut}
                                    disabled={zoom <= 0.25}
                                    className="p-2 bg-gray-100 hover:bg-gray-200"
                                    title="Уменьшить"
                                >
                                    <ZoomOut className="w-4 h-4" />
                                </MyButton>
                                <span className="text-sm text-gray-600 min-w-[3rem] text-center">
                                    {Math.round(zoom * 100)}%
                                </span>
                                <MyButton
                                    onClick={handleZoomIn}
                                    disabled={zoom >= 3}
                                    className="p-2 bg-gray-100 hover:bg-gray-200"
                                    title="Увеличить"
                                >
                                    <ZoomIn className="w-4 h-4" />
                                </MyButton>
                                <MyButton
                                    onClick={resetZoom}
                                    className="p-2 bg-gray-100 hover:bg-gray-200 text-xs"
                                    title="Сбросить зум"
                                >
                                    100%
                                </MyButton>
                            </>
                        )}
                        
                        {/* Кнопка скачивания */}
                        {fileId && (
                            <a
                                href={getDownloadUrl(fileId)}
                                download
                                className="p-2 bg-blue-100 hover:bg-blue-200 rounded flex items-center"
                                title="Скачать файл"
                            >
                                <Download className="w-4 h-4 text-blue-600" />
                            </a>
                        )}
                        
                        {/* Кнопка закрытия */}
                        <MyButton
                            onClick={onClose}
                            className="p-2 bg-gray-100 hover:bg-gray-200"
                            title="Закрыть"
                        >
                            <X className="w-4 h-4" />
                        </MyButton>
                    </div>
                </div>
            }
        >
            <div className="max-h-[80vh] overflow-auto bg-gray-50 rounded-lg">
                {loading && (
                    <div className="flex items-center justify-center h-64">
                        <Loader />
                        <span className="ml-2 text-gray-600">Загрузка предпросмотра...</span>
                    </div>
                )}

                {error && (
                    <div className="flex items-center justify-center h-64 text-red-600">
                        <div className="text-center">
                            <p className="font-semibold">Ошибка предпросмотра</p>
                            <p className="text-sm mt-1">{error}</p>
                        </div>
                    </div>
                )}

                {previewUrl && !loading && !error && (
                    <div className="flex items-center justify-center min-h-[400px] p-4">
                        {isImage(fileName) ? (
                            <img
                                src={previewUrl}
                                alt={fileName}
                                style={{
                                    transform: `scale(${zoom})`,
                                    transition: 'transform 0.2s ease',
                                    maxWidth: '100%',
                                    maxHeight: '100%',
                                    objectFit: 'contain'
                                }}
                                className="rounded shadow-lg"
                            />
                        ) : isPdf(fileName) ? (
                            <iframe
                                src={previewUrl}
                                title={fileName}
                                className="w-full h-[70vh] border-0 rounded"
                                style={{ minHeight: '500px' }}
                            />
                        ) : (
                            <div className="text-center text-gray-600">
                                <p className="font-semibold">Предпросмотр недоступен</p>
                                <p className="text-sm mt-1">
                                    Этот тип файла не поддерживает предпросмотр в браузере
                                </p>
                                {fileId && (
                                    <a
                                        href={getDownloadUrl(fileId)}
                                        download
                                        className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                                    >
                                        <Download className="w-4 h-4" />
                                        Скачать файл
                                    </a>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </Modal>
    );
}
