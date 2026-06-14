'use client';

import React, { useState, useRef } from 'react';
import { X, Plus, Trash2, AlertCircle, Download, FileImage } from 'lucide-react';
import { downloadInFormat, getFormatInfo, EXPORT_FORMATS, ExportFormat } from '@/utils/documentProcessor';
import FormatIcon from './FormatIcon';

interface SendDocumentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  files: File[];
  onComplete: () => void;
}

interface ProcessingFile {
  file: File;
  status: 'waiting' | 'processing' | 'completed' | 'error';
  croppedImageUrl?: string;
  error?: string;
}

const SendDocumentsModal: React.FC<SendDocumentsModalProps> = ({ isOpen, onClose, files, onComplete }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingFiles, setProcessingFiles] = useState<ProcessingFile[]>([]);

  React.useEffect(() => {
    if (isOpen) {
      setProcessingFiles(files.map(file => ({ file, status: 'waiting' })));
      setIsProcessing(false);
    }
  }, [isOpen, files]);

  const startProcessingWithFormat = async (format: ExportFormat) => {
    setIsProcessing(true);
    
    try {
      const updatedFiles = [...processingFiles];
      
      for (const fileInfo of updatedFiles) {
        try {
          const file = fileInfo.file;
          const baseName = file.name.replace(/\.[^/.]+$/, '');
          const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
          const filename = `${baseName}_${timestamp}`;
          
          const dataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
          });
          
          await downloadInFormat(dataUrl, format, filename);
          fileInfo.status = 'completed';
          
        } catch (error) {
          fileInfo.status = 'error';
          fileInfo.error = error instanceof Error ? error.message : 'Ошибка скачивания';
        }
      }
      
      onComplete();
      onClose();
      
    } catch (error) {
      console.error('Ошибка обработки:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 relative">
        <button
          onClick={onClose}
          disabled={isProcessing}
          className="absolute top-4 right-4 p-3 hover:bg-red-100 hover:text-red-600 rounded-full transition-all duration-300 hover:scale-110 font-bold text-xl text-gray-600 disabled:opacity-50"
        >
          <X size={20} />
        </button>

        <div className="text-center mb-6">
          <h3 className="text-2xl font-bold text-gray-900 mb-2">
            В каком формате сохранить обработанный документ?
          </h3>
        </div>

        {/* Кнопка формата */}
        <div className="flex justify-center">
          {Object.values(EXPORT_FORMATS).map((format) => {
            const formatInfo = getFormatInfo(format);
            
            return (
              <button
                key={format}
                onClick={() => startProcessingWithFormat(format)}
                disabled={isProcessing}
                className={`
                  relative p-6 rounded-xl text-white transition-all duration-200 w-64
                  ${formatInfo.color} ${formatInfo.hoverColor} 
                  hover:scale-105 shadow-lg hover:shadow-xl
                  disabled:opacity-50 disabled:cursor-not-allowed
                `}
              >
                {isProcessing && (
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
      </div>
    </div>
  );
};

export default SendDocumentsModal; 