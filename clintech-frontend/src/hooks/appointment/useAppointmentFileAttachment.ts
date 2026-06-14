'use client'
import { useState, useCallback } from 'react';
import { useAuthenticatedFetch } from '../auth/useAuthenticatedFetch';

interface AttachFilesRequest {
    file_ids: string[];
}

interface AttachedFile {
    id: string;
    appointment_id: string;
    file_id: string;
    file_type: string;
    uploaded_by: string;
    created_at: string;
    file_name: string;
    original_name: string;
    mime_type: string;
    size: number;
}

interface AttachFilesResponse {
    success: boolean;
    data: {
        added_files: AttachedFile[];
        errors: string[];
    };
}

interface UseAppointmentFileAttachmentResult {
    attachFiles: (appointmentId: string, fileIds: string[]) => Promise<AttachFilesResponse>;
    loading: boolean;
    error: string | null;
}

export const useAppointmentFileAttachment = (): UseAppointmentFileAttachmentResult => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const authenticatedFetch = useAuthenticatedFetch();

    const attachFiles = useCallback(async (appointmentId: string, fileIds: string[]): Promise<AttachFilesResponse> => {
        try {
            setLoading(true);
            setError(null);

            const requestBody: AttachFilesRequest = {
                file_ids: fileIds
            };

            const response = await authenticatedFetch(`/api/appointments/${appointmentId}/files/add`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Ошибка привязки файлов: ${response.status}`);
            }

            const result: AttachFilesResponse = await response.json();
            return result;

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Неизвестная ошибка при привязке файлов';
            setError(errorMessage);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [authenticatedFetch]);

    return {
        attachFiles,
        loading,
        error
    };
};
