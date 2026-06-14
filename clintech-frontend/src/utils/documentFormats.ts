// Поддерживаемые форматы экспорта
export const EXPORT_FORMATS = {
  PDF: 'pdf'
} as const;

export type ExportFormat = typeof EXPORT_FORMATS[keyof typeof EXPORT_FORMATS];

export interface GenerateFormatRequest {
  imageDataUrl: string;
  format: ExportFormat;
  filename?: string;
  quality?: number;
}

export interface GenerateFormatResponse {
  success: boolean;
  fileDataUrl?: string;
  filename?: string;
  format?: ExportFormat;
  message: string;
} 