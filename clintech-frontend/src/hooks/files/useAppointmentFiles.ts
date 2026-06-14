import { useState, useCallback, useEffect } from 'react';

export type AppointmentFile = {
  id: string;
  name: string;
  size?: number;
  created_at?: string;
  [key: string]: any;
};

export function useAppointmentFiles(id: string) {
  const [files, setFiles] = useState<AppointmentFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/appointments/${id}/files`);
      if (!res.ok) throw new Error('Ошибка загрузки файлов');
      const data = await res.json();

      // Универсальная обработка: если data.data — массив, используем его, иначе []
      if (Array.isArray(data.data)) {
        setFiles(data.data);
      } else if (Array.isArray(data)) {
        setFiles(data);
      } else {
        setFiles([]);
      }
    } catch (e: any) {
      setError(e.message || 'Ошибка загрузки файлов');
      setFiles([]); // <-- обязательно сбрасывай в []
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) fetchFiles();
  }, [id, fetchFiles]);

  const uploadFile = useCallback(async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/appointments/${id}/files`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error('Ошибка загрузки файла');
      await fetchFiles();
    } catch (e: any) {
      setError(e.message || 'Ошибка загрузки файла');
    } finally {
      setLoading(false);
    }
  }, [id, fetchFiles]);

  const deleteFile = useCallback(async (fileId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/appointments/${id}/files/${fileId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Ошибка удаления файла');
      await fetchFiles();
    } catch (e: any) {
      setError(e.message || 'Ошибка удаления файла');
    } finally {
      setLoading(false);
    }
  }, [id, fetchFiles]);

  const getDownloadUrl = (fileId: string) => `/api/files/${fileId}/download`;

  return { files, loading, error, uploadFile, deleteFile, getDownloadUrl, refetch: fetchFiles };
} 