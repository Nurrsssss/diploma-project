import sharp from 'sharp';

interface EnhancementOptions {
  contrast?: number;
  brightness?: number;
  saturation?: number;
  sharpness?: number;
}

export async function enhanceImage(
  imageBuffer: Buffer,
  options: EnhancementOptions = {}
): Promise<Buffer> {
  try {
    let pipeline = sharp(imageBuffer)
      // Базовое преобразование в ч/б
      .grayscale()
      // Нормализация
      .normalise()
      // Легкое усиление контраста
      .linear(1.2, -0.1)
      // Базовая резкость
      .sharpen({
        sigma: 1.0,
        m1: 1.5,
        m2: 15,
        x1: 2.0,
        y2: 15,
        y3: 0.5
      })
      // Проверяем что текст черный на белом фоне
      .negate(false)
      .withMetadata();

    // Сохраняем в PNG
    const enhancedImage = await pipeline
      .png({
        compressionLevel: 9,
        force: true
      })
      .toBuffer();

    return enhancedImage;
  } catch (error) {
    console.error('Error enhancing image:', error);
    return imageBuffer;
  }
}

// Helper function для base64 теперь возвращает PNG
export function bufferToBase64(buffer: Buffer): string {
  return `data:image/png;base64,${buffer.toString('base64')}`;
}

// Helper function для base64 принимает оба формата
export function base64ToBuffer(base64String: string): Buffer {
  // Remove data URL prefix if present (поддерживаем оба формата)
  const base64Data = base64String.replace(/^data:image\/(png|jpeg);base64,/, '');
  return Buffer.from(base64Data, 'base64');
} 