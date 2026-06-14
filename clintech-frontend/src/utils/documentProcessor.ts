import { EXPORT_FORMATS, ExportFormat } from './documentFormats';

// Информация о форматах
export function getFormatInfo(format: ExportFormat) {
  return {
    name: 'PDF',
    description: 'Универсальный формат',
    color: 'bg-red-500',
    hoverColor: 'hover:bg-red-600',
    iconName: 'pdf'
  };
}

// Функция для скачивания файла в определенном формате
export async function downloadInFormat(
  imageDataUrl: string, 
  format: ExportFormat, 
  filename: string
): Promise<void> {
  try {
    // Создаем ссылку для скачивания
    const link = document.createElement('a');
    
    // Для PDF используем библиотеку jsPDF (если доступна)
    if (typeof window !== 'undefined' && (window as any).jsPDF) {
      const { jsPDF } = (window as any);
      const pdf = new jsPDF();
      
      // Добавляем изображение в PDF
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        
        const imgData = canvas.toDataURL('image/jpeg', 0.9);
        pdf.addImage(imgData, 'JPEG', 10, 10, 190, 0);
        pdf.save(`${filename}.pdf`);
      };
      img.src = imageDataUrl;
      return;
    }
    
    // Если jsPDF не доступен, скачиваем как изображение
    link.href = imageDataUrl;
    link.download = `${filename}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
  } catch (error) {
    console.error('Error downloading file:', error);
    throw error;
  }
}

// Реэкспортируем константы для обратной совместимости
export { EXPORT_FORMATS } from './documentFormats';
export type { ExportFormat } from './documentFormats'; 