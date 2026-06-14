import { DocumentFormat } from '../components/scanner/FormatSelectionModal';
import { jsPDF } from 'jspdf';
import { formatDate } from './date';

// Функция для конвертации изображения в различные форматы
export const convertImageToFormat = async (
  imageDataUrl: string,
  format: DocumentFormat,
  originalFileName?: string
): Promise<File> => {
  const baseName = originalFileName?.replace(/\.[^/.]+$/, '') || 'document';
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
  
  switch (format.type) {
    
    
    
    case 'pdf':
      return await convertToPDF(imageDataUrl, `${baseName}_${timestamp}.pdf`);
    
    
    
    
    
    default:
      return await convertToJPG(imageDataUrl, `${baseName}_${timestamp}.jpg`);
  }
};

// Конвертация в JPG
const convertToJPG = async (imageDataUrl: string, fileName: string): Promise<File> => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const img = new Image();

  return new Promise((resolve, reject) => {
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      
      if (ctx) {
        // Белый фон для JPG
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], fileName, { type: 'image/jpeg' });
            resolve(file);
          } else {
            reject(new Error('Ошибка конвертации в JPG'));
          }
        }, 'image/jpeg', 0.9);
      } else {
        reject(new Error('Не удалось создать canvas контекст'));
      }
    };
    
    img.onerror = () => reject(new Error('Ошибка загрузки изображения'));
    img.src = imageDataUrl;
  });
};

// Конвертация в PNG
const convertToPNG = async (imageDataUrl: string, fileName: string): Promise<File> => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const img = new Image();

  return new Promise((resolve, reject) => {
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      
      if (ctx) {
        // Прозрачный фон для PNG
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], fileName, { type: 'image/png' });
            resolve(file);
          } else {
            reject(new Error('Ошибка конвертации в PNG'));
          }
        }, 'image/png');
      } else {
        reject(new Error('Не удалось создать canvas контекст'));
      }
    };
    
    img.onerror = () => reject(new Error('Ошибка загрузки изображения'));
    img.src = imageDataUrl;
  });
};

// Конвертация в PDF
const convertToPDF = async (imageDataUrl: string, fileName: string): Promise<File> => {
  return new Promise((resolve, reject) => {
    try {
      // Создаем новый PDF документ
      const pdf = new jsPDF();
      
      // Создаем изображение для добавления в PDF
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Не удалось создать контекст canvas'));
          return;
        }
        
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        
        const imgData = canvas.toDataURL('image/jpeg', 0.9);
        pdf.addImage(imgData, 'JPEG', 10, 10, 190, 0);
        
        // Конвертируем PDF в Blob
        const pdfBlob = pdf.output('blob');
        const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
        resolve(file);
      };
      
      img.onerror = () => reject(new Error('Ошибка загрузки изображения'));
      img.src = imageDataUrl;
      
    } catch (error) {
      reject(new Error('Ошибка конвертации в PDF'));
    }
  });
};

// Конвертация в DOCX
const convertToDOCX = async (imageDataUrl: string, fileName: string): Promise<File> => {
  // Простая реализация - создаем базовый DOCX с изображением
  // В реальном проекте можно использовать docx библиотеку
  
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const img = new Image();

  return new Promise((resolve, reject) => {
    img.onload = async () => {
      canvas.width = img.width;
      canvas.height = img.height;
      
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        
        // Простая имитация DOCX - создаем ZIP-подобную структуру
        const imageData = canvas.toDataURL('image/jpeg', 0.9);
        const docxContent = `
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:r>
        <w:t>Обработанный документ</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:r>
        <w:drawing>
          <wp:inline>
            <a:graphic>
              <a:graphicData>
                <pic:pic>
                  <pic:blipFill>
                    <a:blip r:embed="rId1"/>
                  </pic:blipFill>
                </pic:pic>
              </a:graphicData>
            </a:graphic>
          </wp:inline>
        </w:drawing>
      </w:r>
    </w:p>
  </w:body>
</w:document>`;

        const blob = new Blob([docxContent], { 
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
        });
        const file = new File([blob], fileName, { 
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
        });
        resolve(file);
      } else {
        reject(new Error('Не удалось создать canvas контекст'));
      }
    };
    
    img.onerror = () => reject(new Error('Ошибка загрузки изображения'));
    img.src = imageDataUrl;
  });
};

// Конвертация в TXT (OCR имитация)
const convertToTXT = async (imageDataUrl: string, fileName: string): Promise<File> => {
  // Простая имитация OCR - в реальном проекте нужна OCR библиотека
  const textContent = `Обработанный документ
  
Дата создания: ${formatDate(new Date().toISOString())}
Время: ${new Date().toLocaleTimeString('ru-RU')}

Примечание: Это автоматически сгенерированный текстовый файл из обработанного изображения.
Для получения точного текста требуется OCR обработка.

Размер изображения: Доступен после обработки
Формат: ${fileName}
`;

  const blob = new Blob([textContent], { type: 'text/plain; charset=utf-8' });
  const file = new File([blob], fileName, { type: 'text/plain' });
  return file;
};

// Функция для конвертации файла в нужный формат
export async function convertFile(imageDataUrl: string, format: string, baseName: string): Promise<File> {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
  
  // Конвертируем только в PDF
  return await convertToPDF(imageDataUrl, `${baseName}_${timestamp}.pdf`);
} 
