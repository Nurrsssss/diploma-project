'use client';

import React, { useState, useEffect } from 'react';
import { downloadInFormat, getFormatInfo, EXPORT_FORMATS, ExportFormat } from '@/utils/documentProcessor';
import { useDocumentProcessor } from '@/hooks/files/useDocumentProcessor';
import FormatIcon from './FormatIcon';
import { Brain, RotateCcw, Check, X, AlertCircle } from 'lucide-react';

interface DocumentProcessorProps {
  isOpen: boolean;
  onClose: () => void;
  file: File;
}

interface ProcessDocumentResult {
    success: boolean;
    message?: string;
    processedImageUrl?: string;
}

const DocumentProcessor: React.FC<DocumentProcessorProps> = ({ isOpen, onClose, file }) => {
  const { processDocument, isProcessing, error, progress } = useDocumentProcessor();
  const [isDownloading, setIsDownloading] = useState<ExportFormat | null>(null);
  const [result, setResult] = useState<ProcessDocumentResult | null>(null);

  useEffect(() => {
    if (isOpen && file && !isProcessing) {
      handleProcessDocument();
    }
  }, [isOpen, file]);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const handleProcessDocument = async () => {
    try {
      setResult(null);
      const base64Data = await fileToBase64(file);
      const processResult = await processDocument(base64Data);
      if (processResult) {
        setResult(processResult);
      }
    } catch (error) {
      console.error('Ошибка конвертации файла:', error);
    }
  };

  const handleDownload = async (format: ExportFormat) => {
    if (!result?.processedImageUrl) return;
    
    setIsDownloading(format);
    try {
      const baseName = file.name.replace(/\.[^/.]+$/, '');
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
      const filename = `${baseName}_document_${timestamp}`;
      
      await downloadInFormat(result.processedImageUrl, format, filename);
    } catch (error) {
      console.error(`Ошибка скачивания в формате ${format}:`, error);
    } finally {
      setIsDownloading(null);
    }
  };

  if (!isOpen) return null;

  const hasError = error;

  return (
    <div className={`fixed inset-0 z-50 ${isOpen ? 'flex' : 'hidden'} items-center justify-center`}>
      {/* Затемнение фона */}
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose}></div>
      
      {/* Модальное окно */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl mx-4 overflow-y-auto max-h-[90vh]">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 z-10"
        >
          <X size={24} />
        </button>

        <div className="p-6 space-y-6">
          {/* Заголовок */}
          <div className="text-center mb-6">
            <div className="flex items-center justify-center gap-2 mb-2">
              {result?.processedImageUrl ? (
                <Check className="text-green-600" size={28} />
              ) : hasError ? (
                <AlertCircle className="text-red-600" size={28} />
              ) : (
                <Brain className="text-blue-600" size={28} />
              )}
              <h3 className="text-2xl font-bold text-gray-900">
                {result?.processedImageUrl ? 'Документ готов!' : hasError ? 'Ошибка обработки' : 'ИИ анализ и обрезка'}
              </h3>
            </div>
            <p className="text-gray-600">{file.name}</p>
          </div>

          {/* Процесс загрузки */}
          {isProcessing && !hasError && (
            <div className="text-center py-12">
              <div className="inline-block">
                <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
              </div>
              <p className="text-lg font-medium text-gray-700 mb-2">AI определяет координаты документа...</p>
              <p className="text-gray-500 text-sm">Grounding DINO → обрезка по bbox → готово!</p>
            </div>
          )}

          {/* Ошибка */}
          {hasError && (
            <div className="text-center p-6 bg-red-50 rounded-xl mb-6">
              <div className="flex justify-center mb-4">
                <AlertCircle className="text-red-500" size={64} />
              </div>
              <p className="text-lg font-medium text-red-800 mb-2">{error}</p>
              <p className="text-red-600 text-sm">Попробуйте загрузить другое изображение с документом</p>
            </div>
          )}

          {/* Результат с обрезанным изображением */}
          {result?.processedImageUrl && (
            <div className="space-y-6">
              {/* Сообщение о детекции */}
              <div className="text-center p-4 bg-green-50 rounded-xl">
                <p className="text-green-800 font-medium">Документ успешно обработан</p>
              </div>

              {/* Обрезанное изображение */}
              <div className="text-center">
                <div className="inline-block bg-gray-100 p-4 rounded-xl shadow-inner w-full max-w-4xl">
                  <img 
                    src={result.processedImageUrl} 
                    alt="Обрезанный документ" 
                    className="w-full h-auto rounded-lg shadow-lg"
                    style={{ 
                      maxHeight: '80vh', // 80% высоты экрана
                      objectFit: 'contain',
                      margin: '0 auto'
                    }}
                  />
                </div>
                <p className="text-gray-600 text-sm mt-2 flex items-center justify-center gap-1">
                      <Brain size={16} />
                  Документ автоматически обработан через AI
                </p>
              </div>

              {/* Выбор формата скачивания рядом с результатом */}
              <div className="space-y-4">
                <div className="text-center">
                  <h4 className="text-lg font-semibold text-gray-800 mb-2">В каком формате сохранить обработанный документ?</h4>
                </div>
                
                {/* Кнопка формата */}
                <div className="flex justify-center">
                  {Object.values(EXPORT_FORMATS).map((format) => {
                    const formatInfo = getFormatInfo(format);
                    const isDownloadingThisFormat = isDownloading === format;
                    
                    return (
                      <button
                        key={format}
                        onClick={() => handleDownload(format)}
                        disabled={isDownloading !== null}
                        className={`
                          relative p-6 rounded-xl text-white transition-all duration-200 w-64
                          ${formatInfo.color} ${formatInfo.hoverColor} 
                          ${isDownloadingThisFormat ? 'scale-95 opacity-75' : 'hover:scale-105 shadow-lg hover:shadow-xl'}
                          ${isDownloading && !isDownloadingThisFormat ? 'opacity-50 cursor-not-allowed' : ''}
                        `}
                      >
                        {isDownloadingThisFormat && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-xl">
                            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          </div>
                        )}
                        
                        <div className="flex justify-center mb-3">
                          <FormatIcon iconName={formatInfo.iconName} size={48} className="text-white" />
                        </div>
                        <div className="font-semibold text-xl">{formatInfo.name}</div>
                        <div className="text-sm opacity-90 mt-2">{formatInfo.description}</div>
                      </button>
                    );
                  })}
                </div>
                
                {/* Дополнительные кнопки */}
                <div className="flex justify-center gap-4 pt-4">
                  <button
                    onClick={() => {
                      // Переснять - сбросить состояние и начать заново
                      handleProcessDocument();
                    }}
                    disabled={isDownloading !== null}
                    className="flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors shadow-lg disabled:opacity-50"
                  >
                    <RotateCcw size={18} />
                    Переснять
                  </button>
                  <button
                    onClick={onClose}
                    disabled={isDownloading !== null}
                    className="flex items-center gap-2 px-6 py-3 bg-gray-500 text-white rounded-xl hover:bg-gray-600 transition-colors shadow-lg disabled:opacity-50"
                  >
                    <Check size={18} />
                    Готово
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DocumentProcessor; 