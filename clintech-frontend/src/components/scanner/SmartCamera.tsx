'use client';

import React, { useState, useRef } from 'react';

import { 
  Camera, 
  X, 
  RotateCcw, 
  Upload, 
  CheckCircle, 
  Target, 
  Zap, 
  Lightbulb,
  Brain,
  Sparkles,
  Plus,
  FileText,
  Download
} from 'lucide-react';
import FormatSelectionModal, { DocumentFormat } from './FormatSelectionModal';
import { convertImageToFormat } from '@/utils/fileConverter';
import { useDocumentProcessor } from '@/hooks/files/useDocumentProcessor';

interface SmartCameraProps {
  isOpen: boolean;
  onClose: () => void;
  onFileProcessed: (file: File) => void;
}

interface DetectionInfo {
  label: string;
  confidence: number;
  bbox: number[];
}

interface ProcessedDocument {
  file: File;
  croppedImageUrl: string;
  timestamp: number;
}

const SmartCamera: React.FC<SmartCameraProps> = ({ isOpen, onClose, onFileProcessed }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [processedImage, setProcessedImage] = useState<string>('');
  const [originalImage, setOriginalImage] = useState<string>(''); // Оригинальное изображение для скачивания
  const [detectionInfo, setDetectionInfo] = useState<DetectionInfo | null>(null);
  const [apiMessage, setApiMessage] = useState<string>('');
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [processedDocuments, setProcessedDocuments] = useState<ProcessedDocument[]>([]);
  const [isFormatModalOpen, setIsFormatModalOpen] = useState(false);
  const [localIsProcessing, setIsProcessing] = useState(false);
  const [localProgress, setProgress] = useState(0);
  const [localCurrentStep, setCurrentStep] = useState('');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const { 
    isProcessing, 
    error, 
    progress, 
    currentStep, 
    processDocument, 
    downloadImage: downloadImageFromUrl, 
    clearError, 
    reset: resetProcessor 
  } = useDocumentProcessor();

  // Функция скачивания файла
  const downloadImage = (dataUrl: string, filename: string) => {
    try {
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Ошибка при скачивании файла');
    }
  };

  // Обрезка изображения по координатам bbox на клиенте  
  const cropImageLocal = (imageDataUrl: string, bbox: number[]): Promise<string> => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      if (!ctx) {
        reject(new Error('Canvas context недоступен'));
        return;
      }
      
      img.onload = () => {
        try {
          const [x1, y1, x2, y2] = bbox;
          
          // Получаем размеры изображения
          const imgWidth = img.naturalWidth;
          const imgHeight = img.naturalHeight;
          
          // Проверяем формат координат - нормализованные (0-1) или абсолютные пиксели
          const isNormalized = x1 <= 1 && y1 <= 1 && x2 <= 1 && y2 <= 1;
          
          let minX, maxX, minY, maxY;
          
          if (isNormalized) {
            // Конвертируем нормализованные координаты в пиксели
            minX = Math.min(x1, x2) * imgWidth;
            maxX = Math.max(x1, x2) * imgWidth;
            minY = Math.min(y1, y2) * imgHeight;
            maxY = Math.max(y1, y2) * imgHeight;
          } else {
            // Координаты уже в пикселях
            minX = Math.min(x1, x2);
            maxX = Math.max(x1, x2);
            minY = Math.min(y1, y2);
            maxY = Math.max(y1, y2);
          }
          
          // Ограничиваем координаты в пределах изображения
          const pixelX = Math.max(0, Math.min(imgWidth - 1, Math.floor(minX)));
          const pixelY = Math.max(0, Math.min(imgHeight - 1, Math.floor(minY)));
          const pixelX2 = Math.max(pixelX + 1, Math.min(imgWidth, Math.floor(maxX)));
          const pixelY2 = Math.max(pixelY + 1, Math.min(imgHeight, Math.floor(maxY)));
          
          const pixelWidth = pixelX2 - pixelX;
          const pixelHeight = pixelY2 - pixelY;
          
          // Проверка корректности размеров
          if (pixelWidth <= 0 || pixelHeight <= 0) {
            throw new Error(`Некорректные размеры: ${pixelWidth}x${pixelHeight}`);
          }
          
          // Проверка минимальных размеров (избегаем слишком маленькие области)
          if (pixelWidth < 50 || pixelHeight < 50) {
            throw new Error('Область обрезки слишком мала - возможно проблема с координатами');
          }
          
          // Дополнительная проверка разумности размеров (не меньше 10% от изображения)
          const minWidth = imgWidth * 0.1;
          const minHeight = imgHeight * 0.1;
          if (pixelWidth < minWidth || pixelHeight < minHeight) {
            throw new Error('Область обрезки слишком мала относительно изображения');
          }
          
          canvas.width = pixelWidth;
          canvas.height = pixelHeight;
          
          // Проверяем что координаты не выходят за границы
          if (pixelX + pixelWidth > imgWidth || pixelY + pixelHeight > imgHeight) {
            throw new Error('Координаты выходят за границы изображения');
          }
          
          // Обрезаем изображение по координатам (БЕЗ белого фона)
          ctx.drawImage(img, pixelX, pixelY, pixelWidth, pixelHeight, 0, 0, pixelWidth, pixelHeight);
          
          // Возвращаем обрезанное изображение как base64
          const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.9);
          resolve(croppedDataUrl);
        } catch (error) {
          reject(error);
        }
      };
      
      img.onerror = (error) => {
        reject(new Error('Ошибка загрузки изображения для обрезки'));
      };
      
      img.src = imageDataUrl;
    });
  };

  // Скачать готовый документ (улучшенное качество)
  const downloadProcessedDocument = () => {
    if (processedImage) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      downloadImage(processedImage, `ready-document-${timestamp}.pdf`);
    }
  };

  // Скачать обрезанный документ (только документ без фона)
  const downloadCroppedDocument = async () => {
    if (!originalImage) {
      console.error('Изображение не найдено');
      return;
    }

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      
      // Если есть информация о детекции - обрезаем точно по документу
      if (detectionInfo && detectionInfo.bbox) {
        const croppedImage = await cropImageLocal(originalImage, detectionInfo.bbox);
        downloadImage(croppedImage, `cropped-document-${timestamp}.pdf`);
      } else {
        // Если детекция не сработала - скачиваем улучшенное изображение
        if (processedImage) {
          downloadImage(processedImage, `clean-document-${timestamp}.pdf`);
        } else {
          downloadImage(originalImage, `document-${timestamp}.pdf`);
        }
      }
    } catch (error) {
      console.error('Ошибка при обработке документа');
    }
  };

  // Скачать оригинальное фото
  const downloadOriginalPhoto = () => {
    if (originalImage) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      downloadImage(originalImage, `original-photo-${timestamp}.pdf`);
    }
  };

  // Обработка выбранного файла с камеры
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;


    // Проверяем тип файла
    if (!file.type.startsWith('image/')) {
      console.error('Пожалуйста, выберите изображение');
      return;
    }

    // Сохраняем файл для скачивания
    setOriginalFile(file);

    // Читаем файл как DataURL
    const reader = new FileReader();
    reader.onload = async (e) => {
      const imageDataUrl = e.target?.result as string;
      
      setCapturedImage(imageDataUrl);
      clearError();
      
      // Запускаем AI обработку
      await processWithAI(imageDataUrl);
    };
    
    reader.onerror = () => {
      console.error('Ошибка при загрузке изображения');
    };
    
    reader.readAsDataURL(file);
  };

  // Открыть камеру (вызывает системную камеру)
  const openCamera = () => {
    clearError();
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Функция для изменения размера изображения
  const resizeImage = (imageDataUrl: string, maxWidth: number = 1920, maxHeight: number = 1080, quality: number = 0.8): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          resolve(imageDataUrl);
          return;
        }
        
        // Вычисляем новые размеры с сохранением пропорций
        let { width, height } = img;
        
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.floor(width * ratio);
          height = Math.floor(height * ratio);
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // Рисуем изображение с новым размером
        ctx.drawImage(img, 0, 0, width, height);
        
        // Возвращаем сжатое изображение
        const resizedDataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(resizedDataUrl);
      };
      
      img.onerror = () => resolve(imageDataUrl);
      img.src = imageDataUrl;
    });
  };

  // AI обработка изображения
  const processWithAI = async (imageDataUrl: string) => {
    try {
      // Сначала изменяем размер изображения для стабильной работы на всех устройствах
      const resizedImageDataUrl = await resizeImage(imageDataUrl, 1920, 1080, 0.85);
      
      // Используем хук для обработки документа
      const result = await processDocument(resizedImageDataUrl);
      
      if (result) {
        // Сохраняем сообщение от API
        if (result.message) {
          setApiMessage(result.message);
        }

        // Сохраняем оригинальное изображение для скачивания
        if (result.originalImageUrl) {
          setOriginalImage(result.originalImageUrl);
        }

        // Сохраняем информацию о детекции документа
        if (result.detectionInfo) {
          setDetectionInfo(result.detectionInfo);
        }
        
        // Обрабатываем результат
        let imageUrl = result.processedImageUrl;
        
        // Проверяем есть ли детекция документа и автоматически обрезаем
        if (result.detectionInfo && result.detectionInfo.bbox) {
          try {
            // Используем изображение с удаленным фоном для обрезки
            let sourceImageForCropping = imageDataUrl;
            
            // Если получили изображение с удаленным фоном от API, используем его для обрезки
            if (typeof imageUrl === 'string' && imageUrl.startsWith('https')) {
              const downloadedImage = await downloadImageFromUrl(imageUrl);
              if (downloadedImage) {
                sourceImageForCropping = downloadedImage;
              }
            } else if (typeof imageUrl === 'string' && imageUrl.startsWith('data:')) {
              sourceImageForCropping = imageUrl;
            }
            
            // Обрезаем изображение по найденным координатам документа
            const croppedImage = await cropImageLocal(sourceImageForCropping, result.detectionInfo.bbox);
            setProcessedImage(croppedImage);
          } catch (cropError) {
            console.error('🔄 Fallback: показываем изображение с удаленным фоном без обрезки');
            
            // Устанавливаем сообщение о проблеме
            setApiMessage('Документ найден и фон удален, но обрезка не удалась');
            
            // Fallback на изображение с удаленным фоном
            if (typeof imageUrl === 'string') {
              setProcessedImage(imageUrl);
            } else {
              setProcessedImage(imageDataUrl);
            }
          }
        } else {
          // Если документ не найден, показываем как есть
          if (typeof imageUrl === 'string') {
            setProcessedImage(imageUrl);
          } else {
            setProcessedImage(imageDataUrl);
          }
        }
      } else {
        // Fallback: используем оригинал
        setProcessedImage(imageDataUrl);
      }
    } catch (processError) {
      setProcessedImage(imageDataUrl);
    }
  };

  // Переснять
  const retake = () => {
    setCapturedImage(null);
    setProcessedImage('');
    setOriginalImage(''); // Очищаем оригинал
    setDetectionInfo(null);
    setApiMessage('');
    setOriginalFile(null);
    resetProcessor(); // Сбрасываем состояние процессора документов
    clearError(); // Очищаем ошибки
  };

  // Функция для открытия выбора формата
  const uploadToMain = () => {
    if (processedImage) {
      setIsFormatModalOpen(true);
    }
  };

  // Обработка выбора формата документа
  const handleFormatSelect = async (format: DocumentFormat) => {
    if (!processedImage || !originalFile) {
      console.error('Нет обработанного изображения для конвертации');
      return;
    }

    try {
      setIsFormatModalOpen(false);
      setIsProcessing(true);
      setCurrentStep(`Конвертация в ${format.name}...`);
      setProgress(50);

      // Конвертируем изображение в выбранный формат
      const convertedFile = await convertImageToFormat(
        processedImage, 
        format, 
        originalFile.name
      );

      // Добавляем документ в локальный список обработанных
      const newDocument: ProcessedDocument = {
        file: convertedFile,
        croppedImageUrl: processedImage,
        timestamp: Date.now()
      };

      setProcessedDocuments(prev => [...prev, newDocument]);

      // Добавляем конвертированный файл в главное окно (чат)
      onFileProcessed(convertedFile);

      setTimeout(() => {
        setIsProcessing(false);
        retake();
        onClose();
      }, 500);

    } catch (error) {
      console.error('Ошибка при конвертации файла:', error);
      setIsProcessing(false);
      setIsFormatModalOpen(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full relative max-h-[95vh] overflow-y-auto">
        
        {/* Заголовок */}
        <div className="text-center p-6 border-b border-gray-100">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-3 hover:bg-red-100 hover:text-red-600 rounded-full transition-all duration-300 hover:scale-110 font-bold text-xl text-black"
          >
            <X size={20} />
          </button>
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-semibold text-gray-900">Clintech Камера</h2>
              {processedDocuments.length > 0 && (
                <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                  {processedDocuments.length} добавлено
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600">Сфотографируйте документ - AI улучшит качество автоматически</p>
          </div>
        </div>

        <div className="p-6">
          
          {/* Скрытый input для камеры */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Экран AI обработки */}
          {localIsProcessing && (
            <div className="space-y-6">
              
              <div className="text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6">
                  <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4">{localCurrentStep}</h3>
                <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
                  <div 
                    className="bg-gradient-to-r from-blue-500 to-purple-600 h-3 rounded-full transition-all duration-500"
                    style={{ width: `${localProgress}%` }}
                  ></div>
                </div>
                <p className="text-lg font-medium text-blue-600">{localProgress}% завершено</p>
              </div>

              {capturedImage && (
                <div className="flex justify-center">
                  <img 
                    src={capturedImage} 
                    alt="Processing"
                    className="max-w-md max-h-80 object-contain rounded-xl shadow-lg border"
                  />
                </div>
              )}
            </div>
          )}

          {/* Экран результата */}
          {!localIsProcessing && processedImage && (
            <div className="space-y-6">
              
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-4">
                  <CheckCircle className="text-green-600" size={24} />
                  <h3 className="text-xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-blue-800 bg-clip-text text-transparent">Документ готов!</h3>
                </div>
              </div>

              <div className="flex justify-center">
                <div className="w-full max-w-4xl space-y-6">
                  {/* Сравнение: Оригинал vs AI обработка */}
                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Оригинальное изображение */}
                    <div>
                      <p className="text-lg font-medium text-gray-700 mb-3 text-center">Оригинал</p>
                      {capturedImage && (
                        <img
                          src={capturedImage}
                          alt="Оригинальное изображение"
                          className="w-full h-80 object-contain rounded-xl border-2 border-gray-200 shadow-lg bg-gray-50"
                        />
                      )}
                    </div>
                    
                    {/* AI обработанное изображение */}
                    <div>
                      <p className="text-lg font-medium text-gray-700 mb-3 text-center">AI обработка</p>
                      <img
                        src={processedImage}
                        alt="AI Processed Document"
                        className="w-full h-80 object-contain rounded-xl border-2 border-blue-200 shadow-lg bg-white"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Кнопки действий */}
              <div className="flex gap-3">
                <button
                  onClick={retake}
                  className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-xl hover:border-purple-400 hover:bg-purple-50 transition-all duration-300 font-semibold text-gray-700 hover:text-purple-700 hover:scale-105 flex items-center justify-center gap-2"
                >
                  <RotateCcw size={18} />
                  Переснять
                </button>
                <button
                  onClick={uploadToMain}
                  className="flex-1 px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-semibold transition-all duration-300 shadow-lg hover:scale-105 flex items-center justify-center gap-2"
                >
                  <Upload size={18} />
                  Отправить
                </button>
              </div>

              <div className="bg-gradient-to-r from-blue-50 via-purple-50 to-blue-50 p-4 rounded-lg border border-purple-200">
                <h4 className="font-medium bg-gradient-to-r from-blue-700 via-purple-700 to-blue-800 bg-clip-text text-transparent mb-2">✅ AI обработка:</h4>
                {apiMessage ? (
                  <div className="space-y-1">
                    <p className="text-sm text-blue-800 font-medium">• {apiMessage}</p>
                    {detectionInfo && (
                      <p className="text-xs text-blue-700">
                        🎯 Найден "{detectionInfo.label}" с точностью {Math.round(detectionInfo.confidence * 100)}%
                      </p>
                    )}
                  </div>
                ) : (
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>• Документ найден AI детекцией</li>
                    <li>• Координаты определены</li>
                    <li>• Готов для использования</li>
                  </ul>
                )}
              </div>
            </div>
          )}

          {/* Главный экран - кнопка камеры */}
          {!localIsProcessing && !processedImage && (
            <div className="text-center space-y-6">
              
              
              {/* Ошибка */}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  <p className="font-medium">⚠ {error}</p>
                </div>
              )}

              {/* Иконка камеры */}
              <div className="flex justify-center">
                <div className="w-32 h-32 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-2xl">
                  <Camera className="text-white" size={64} />
                </div>
              </div>

              {/* Заголовок */}
              <div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">AI Камера готова</h3>
                <p className="text-gray-600">Нажмите кнопку чтобы убрать фон с документа</p>
              </div>

              {/* Кнопка съемки */}
              <button
                onClick={openCamera}
                className="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-800 hover:from-blue-700 hover:via-purple-700 hover:to-blue-900 text-white px-8 py-4 rounded-xl font-semibold transition-all duration-300 shadow-2xl hover:shadow-purple-500/25 hover:scale-105 text-lg"
              >
                <span className="flex items-center gap-3">
                  <Camera size={24} />
                  Сделать снимок
                </span>
              </button>

              {/* Информация о AI */}
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-6 rounded-xl border border-blue-200 text-left">
                <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                  <Brain size={20} className="text-blue-900" />
                  AI автоматически обработает:
                </h4>
                <ul className="text-sm text-blue-800 space-y-2">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="text-green-500" size={16} />
                    Уберёт задний фон с документа
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="text-green-500" size={16} />
                    Выделит только документ
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="text-green-500" size={16} />
                    Сделает чистый фон
                  </li>
                </ul>
              </div>

              {/* Подсказка */}
              <div className="text-xs text-gray-500 bg-gray-50 p-4 rounded-lg">
                <p className="flex items-center gap-1 mb-2">
                  <Lightbulb size={14} className="text-yellow-500" />
                  Советы для лучшего результата:
                </p>
                <p>• Расположите документ на контрастном фоне</p>
                <p>• Используйте хорошее освещение</p>
                <p>• Убедитесь что весь документ в кадре</p>
              </div>


            </div>
          )}
        </div>
      </div>

      {/* Модальное окно выбора формата */}
      <FormatSelectionModal 
        isOpen={isFormatModalOpen}
        onClose={() => setIsFormatModalOpen(false)}
        onFormatSelect={handleFormatSelect}
        imageUrl={processedImage}
      />
    </div>
  );
};

export default SmartCamera;
