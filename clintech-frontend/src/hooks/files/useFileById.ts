import { useState, useCallback, useEffect } from 'react';
import { useAuthenticatedFetch } from '../auth/useAuthenticatedFetch';

export type FileData = {
  id: string;
  name: string;
  original_name: string;
  size: number;
  mime_type: string;
  created_at: string;
  [key: string]: any;
};

interface UseFileByIdReturn {
  file: FileData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const useFileById = (fileId: string | null): UseFileByIdReturn => {
  const [file, setFile] = useState<FileData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const authenticatedFetch = useAuthenticatedFetch();

  const fetchFile = useCallback(async () => {
    if (!fileId) {
      setFile(null);
      setLoading(false);
      setError(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await authenticatedFetch(`/api/files/${fileId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          setFile(null);
          return;
        }
        throw new Error(`Ошибка получения файла: ${response.status}`);
      }

      const data = await response.json();
      setFile(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Ошибка при получении файла';
      console.error('useFileById: Error:', err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [fileId, authenticatedFetch]);

  useEffect(() => {
    fetchFile();
  }, [fetchFile]);

  return {
    file,
    loading,
    error,
    refetch: fetchFile
  };
}; 