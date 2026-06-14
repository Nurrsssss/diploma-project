import { useState, useEffect, useCallback } from 'react';
import { TFile } from '@/types/files';
import { useAuth } from '@/context/AuthContext';
import { useAuthenticatedFetch } from '@/hooks/auth/useAuthenticatedFetch';

export function useFiles(fileIds: string[]) {
    const { isLoggedIn } = useAuth();
    const authenticatedFetch = useAuthenticatedFetch();
    const [files, setFiles] = useState<TFile[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchFiles = useCallback(async () => {
        if (!isLoggedIn || !fileIds || fileIds.length === 0) {
            setFiles([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const filePromises = fileIds.map(async (id) => {
                const res = await authenticatedFetch(`/api/files/${id}`, {
                    method: 'GET'
                });
                if (!res.ok) {
                    throw new Error(`Failed to fetch file with id ${id}`);
                }
                return res.json();
            });

            const filesData = await Promise.all(filePromises);
            setFiles(filesData);
        } catch (err: any) {
            setError(err.message || 'An error occurred while fetching files.');
            setFiles([]);
        } finally {
            setLoading(false);
        }
    }, [JSON.stringify(fileIds), isLoggedIn, authenticatedFetch]);

    useEffect(() => {
        fetchFiles();
    }, [fetchFiles]);

    return { files, loading, error };
} 