'use client';

import React from 'react';

interface FormatSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFormatSelect: (format: DocumentFormat) => void;
  imageUrl: string;
}

export interface DocumentFormat {
  type: 'pdf';
  name: string;
  icon: string;
  description: string;
}

const formats: DocumentFormat[] = [
  {
    type: 'pdf',
    name: 'PDF',
    icon: '📄',
    description: 'Универсальный формат документа'
  }
];

const FormatSelectionModal: React.FC<FormatSelectionModalProps> = ({
  isOpen,
  onClose,
  onFormatSelect,
  imageUrl
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 relative">
        
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-3 hover:bg-red-100 hover:text-red-600 rounded-full transition-all duration-300 hover:scale-110 font-bold text-xl text-gray-600"
        >
          ✕
        </button>

        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">В каком формате сохранить обработанный документ?</h2>
        </div>

        {/* Превью изображения */}
        <div className="flex justify-center mb-6">
          <div className="w-48 h-48 rounded-xl overflow-hidden shadow-lg border">
            <img 
              src={imageUrl} 
              alt="Preview"
              className="w-full h-full object-contain bg-gray-50"
            />
          </div>
        </div>

        {/* Формат PDF */}
        <div className="flex justify-center">
          {formats.map((format) => (
            <button
              key={format.type}
              onClick={() => onFormatSelect(format)}
              className="flex items-center gap-4 p-6 border-2 border-gray-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-all duration-300 group text-left w-96"
            >
              <div className="text-4xl group-hover:scale-110 transition-transform duration-300">
                {format.icon}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-800 text-xl">{format.name}</h3>
                <p className="text-gray-600">{format.description}</p>
              </div>
              <div className="text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                →
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FormatSelectionModal; 