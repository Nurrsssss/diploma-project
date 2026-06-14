'use client';

import React, { useState, useRef } from 'react';

interface FileUploadProps {
  isOpen: boolean;
  onClose: () => void;
  onFilesSelect: (files: File[]) => void;
  currentFiles?: File[];
}

const FileUpload: React.FC<FileUploadProps> = ({ isOpen, onClose, onFilesSelect, currentFiles = [] }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>(currentFiles);

  // Обновляем локальные файлы когда передаются новые currentFiles
  React.useEffect(() => {
    setSelectedFiles(currentFiles);
  }, [currentFiles]);

  if (!isOpen) return null;

  const addFiles = (newFiles: File[]) => {
    const updatedFiles = [...selectedFiles, ...newFiles];
    setSelectedFiles(updatedFiles);
    onFilesSelect(updatedFiles);
  };

  const removeFile = (index: number) => {
    const updatedFiles = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(updatedFiles);
    onFilesSelect(updatedFiles);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      addFiles(files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      addFiles(Array.from(files));
    }
  };

  const getFileIcon = (file: File) => {
    if (file.type.includes('pdf')) return '📄';
    return '📷';
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 relative">
      <button
          onClick={onClose}
          className="absolute top-4 right-4 p-3 hover:bg-red-100 hover:text-red-600 rounded-full transition-all duration-300 hover:scale-110 font-bold text-xl text-black">
          ✕
        </button>

        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Загрузить файлы</h2>
          <p className="text-gray-600">Выберите несколько файлов для обработки</p>
        </div>

        <div
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors mb-6 ${
            dragOver 
              ? 'border-blue-400 bg-blue-50' 
              : 'border-gray-300 hover:border-gray-400'
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <div className="text-4xl mb-4">📤</div>
          <p className="text-gray-600 mb-4">
            Перетащите файлы сюда или нажмите для выбора
          </p>
          
          <input
            type="file"
            onChange={handleInputChange}
            className="hidden"
            ref={fileInputRef}
            accept=".pdf,image/*"
            multiple
          />
          
          <button
            onClick={() => fileInputRef.current?.click()}
            className="relative bg-gradient-to-r from-blue-500 via-cyan-500 to-teal-500 hover:from-blue-600 hover:via-cyan-600 hover:to-teal-600 text-white px-8 py-3 rounded-xl font-semibold transition-all duration-300 shadow-lg hover:shadow-cyan-500/25 hover:scale-105 transform group overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 transform skew-x-12 translate-x-[-100%] group-hover:translate-x-[100%]"></div>
            <span className="relative flex items-center justify-center gap-2">
              <span className="text-lg">📁</span>
              Выбрать файлы
            </span>
          </button>
        </div>

        {/* Список выбранных файлов */}
        {selectedFiles.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              Выбрано файлов: {selectedFiles.length}
            </h3>
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {selectedFiles.map((file, index) => (
                <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg group hover:bg-gray-100 transition-colors">
                  <div className="text-2xl">{getFileIcon(file)}</div>
                  
                  {/* Превью для изображений */}
                  {file.type.startsWith('image/') && (
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0">
                      <img 
                        src={URL.createObjectURL(file)} 
                        alt={file.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 truncate">{file.name}</p>
                    <p className="text-sm text-gray-600">{formatFileSize(file.size)}</p>
                  </div>
                  
                  <button
                    onClick={() => removeFile(index)}
                    className="p-2 text-red-500 hover:bg-red-100 rounded-full transition-all duration-200 opacity-100 md:opacity-0 md:group-hover:opacity-100 hover:scale-110 flex-shrink-0"
                    title="Удалить файл"
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Информация о поддерживаемых форматах */}
        <div className="text-center mt-4">
          <p className="text-sm text-gray-500 mb-2">Поддерживаемые форматы:</p>
          <div className="flex flex-wrap justify-center gap-2">
            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">PDF</span>
            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">Фото</span>
          </div>
        </div>

        <div className="text-center">
          <p className="text-xs text-gray-400 mb-4">
            Выберите файлы для загрузки в приложение
          </p>
          
          {selectedFiles.length > 0 && (
            <button
              onClick={() => {
                onFilesSelect(selectedFiles);
                onClose();
              }}
              className="bg-primary hover:bg-primary/90 text-white px-8 py-3 rounded-xl font-semibold transition-all duration-300 shadow-lg hover:shadow-green-500/25 hover:scale-105 transform"
            >
              Готово ({selectedFiles.length} файлов)
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default FileUpload; 