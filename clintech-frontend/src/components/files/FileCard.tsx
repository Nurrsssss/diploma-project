import React from 'react'
import { FaFileDownload, FaFilePdf } from 'react-icons/fa';
import { Eye, Check } from 'lucide-react';
import MyButton from '../ui/MyButton';
import { TFile } from '@/types/files';

export default function FileCard({ 
    file, 
    onDownload, 
    onPreview,
    isSelectionMode = false,
    isSelected = false,
    onToggleSelection
}: { 
    file: TFile; 
    onDownload: (fileId: string, fileName: string) => void;
    onPreview?: (fileId: string, fileName: string) => void;
    isSelectionMode?: boolean;
    isSelected?: boolean;
    onToggleSelection?: (fileId: string) => void;
}) {
    return (
        <div className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
            isSelectionMode 
                ? (isSelected ? 'bg-blue-50 border-2 border-blue-300' : 'bg-gray-50 border-2 border-transparent hover:border-gray-300') 
                : 'bg-gray-50 hover:bg-gray-100'
        }`}>
            <div className="flex items-center gap-4">
                {/* Чекбокс выбора в режиме выбора */}
                {isSelectionMode && (
                    <div 
                        className={`w-6 h-6 rounded border-2 flex items-center justify-center cursor-pointer transition-colors ${
                            isSelected 
                                ? 'bg-blue-600 border-blue-600 text-white' 
                                : 'border-gray-300 hover:border-blue-400'
                        }`}
                        onClick={() => onToggleSelection?.(file.id)}
                    >
                        {isSelected && <Check className="w-4 h-4" />}
                    </div>
                )}
                
                <FaFilePdf className="text-red-500 text-3xl" />
                <div>
                    <p className='font-semibold text-gray-800'>{file.name}</p>
                    <p className='text-sm text-gray-500'>{(file.size / 1024).toFixed(2)} KB</p>
                </div>
            </div>
            <div className="flex gap-2">
                {/* Кнопка предпросмотра */}
                {onPreview && (
                    <button
                        className="p-2 bg-blue-200 text-blue-700 hover:bg-blue-300 rounded transition-colors"
                        onClick={() => onPreview(file.id, file.name)}
                        title="Предпросмотр файла"
                    >
                        <Eye className="w-4 h-4" />
                    </button>
                )}
                
                {/* Кнопка скачивания */}
                <button
                    className="p-2 bg-gray-200 text-gray-700 hover:bg-gray-300 rounded transition-colors"
                    onClick={() => onDownload(file.id, file.name)}
                    title="Скачать файл"
                >
                    <FaFileDownload />
                </button>
            </div>
        </div>
    );
}
