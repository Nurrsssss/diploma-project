import React, { useMemo, useState, useCallback } from 'react'
import { TAnalysis } from '@/types/questionnaire'
import { useFiles } from '@/hooks/files/useFiles'
import { useFileDownload } from '@/hooks/files/useFileDownload'
import { useAuth } from '@/context/AuthContext'
import { TFile } from '@/types/files'
import Loader from '@/components/ui/Loader'
import NoContent from '@/components/ui/NoContent'
import FileCard from '@/components/files/FileCard'
import { useFilePreview } from '@/hooks/files/useFilePreview'
import FilePreviewModal from '@/components/files/FilePreviewModal'
import MyButton from '@/components/ui/MyButton'
import { useAppointmentFileAttachment } from '@/hooks/appointment/useAppointmentFileAttachment'

interface ChatIdFilesProps {
    analysis: TAnalysis
    appointmentId?: string
}


export default function ChatIdFiles({ analysis, appointmentId }: ChatIdFilesProps) {
    const { session } = useAuth()
    const { downloadFile } = useFileDownload()
    const { attachFiles, loading: attaching, error: attachError } = useAppointmentFileAttachment()

    const [isSelectionMode, setIsSelectionMode] = useState(false)
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

    // Собираем все ID файлов из анализа
    const fileIds = useMemo(() => {
        if (!analysis) return [];
        const ids = new Set<string>();

        // Добавляем обычные файлы
        if (Array.isArray(analysis.files)) {
            analysis.files.forEach((id: string) => id && ids.add(id));
        }

        // Добавляем PDF файлы
        if (analysis.health_passport_pdf) {
            ids.add(analysis.health_passport_pdf);
        }

        return Array.from(ids);
    }, [analysis]);

    const { files: documentFiles, loading: documentsLoading, error: documentsError } = useFiles(fileIds);
    const { previewUrl, loading: previewLoading, error: previewError, openPreview, closePreview, clearError } = useFilePreview();
    const [previewMeta, setPreviewMeta] = useState<{ id: string, name: string } | null>(null)

    console.log("analysis", analysis)
    // Разделяем файлы по категориям
    const { attachedFiles, healthPassportFile } = useMemo(() => {
        if (!analysis || !documentFiles) {
            return { attachedFiles: [], healthPassportFile: null };
        }

        const passportId = analysis.health_passport_pdf;
        const attachedIds = new Set(analysis.files || []);

        const attached: TFile[] = [];
        let passport: TFile | null = null;

        for (const file of documentFiles) {
            if (file.id === passportId) passport = file;
            else if (attachedIds.has(file.id)) attached.push(file);
        }

        return { attachedFiles: attached, healthPassportFile: passport };
    }, [analysis, documentFiles]);

    // Функция для скачивания файла
    const handleDownload = async (fileId: string, fileName: string) => {
        if (!session.isLoggedIn) {
            alert('Ошибка авторизации');
            return;
        }

        const success = await downloadFile({
            fileId,
            fileName,
            defaultFileName: 'downloaded_file'
        });

        if (!success) {
            alert('Не удалось скачать файл.');
        }
    };

    const handlePreview = (fileId: string, fileName: string) => {
        setPreviewMeta({ id: fileId, name: fileName })
        openPreview(fileId)
    }

    const toggleSelection = useCallback((fileId: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev)
            if (next.has(fileId)) next.delete(fileId)
            else next.add(fileId)
            return next
        })
    }, [])

    const startSelection = useCallback(() => {
        setIsSelectionMode(true)
        setSelectedIds(new Set())
    }, [])

    const cancelSelection = useCallback(() => {
        setIsSelectionMode(false)
        setSelectedIds(new Set())
    }, [])

    const saveSelection = useCallback(async () => {
        if (!appointmentId) return
        if (selectedIds.size === 0) return
        try {
            const response = await attachFiles(appointmentId, Array.from(selectedIds))
            if (response?.success) {
                const hasErrors = response.data?.errors && response.data.errors.length > 0
                if (hasErrors) {
                    alert(`Частично успешно. Ошибки: \n${response.data.errors.join('\n')}`)
                } else {
                    alert('Файлы успешно привязаны к приему')
                }
                cancelSelection()
            } else {
                alert('Не удалось привязать файлы')
            }
        } catch (e: any) {
            alert(e?.message || 'Ошибка при привязке файлов')
        }
    }, [appointmentId, selectedIds, attachFiles, cancelSelection])




    if (documentsLoading) return <Loader />

    if (documentsError) {
        return (
            <div className='container bg-white rounded-lg p-4 mt-4'>
                <h2 className='text-lg font-bold mb-4'>Прикрепленные файлы</h2>
                <NoContent title="Ошибка загрузки файлов" description={documentsError} />
            </div>
        )
    }

    return (
        <div className="bg-white rounded-xl p-3 sm:p-6 shadow space-y-4 max-w-full w-full">
            <div className="flex justify-between items-center mb-4">
                <h2 className='text-lg font-bold'>Прикрепленные файлы</h2>
                {appointmentId && (
                    <div className="flex items-center gap-2">
                        {isSelectionMode ? (
                            <>
                                <MyButton 
                                    className="bg-gray-100 text-gray-800 hover:bg-gray-200"
                                    onClick={cancelSelection}
                                    disabled={attaching}
                                >
                                    Отмена
                                </MyButton>
                                <MyButton 
                                    className="bg-primary text-white hover:bg-primary/90 disabled:opacity-50"
                                    onClick={saveSelection}
                                    disabled={attaching || selectedIds.size === 0}
                                >
                                    {attaching ? 'Сохранение...' : 'Сохранить'}
                                </MyButton>
                            </>
                        ) : (
                            <MyButton 
                                className="bg-primary text-white hover:bg-primary/90"
                                onClick={startSelection}
                            >
                                Добавить файлы к приему
                            </MyButton>
                        )}
                    </div>
                )}
            </div>

            <div className="space-y-6">
                {/* Обычные прикрепленные файлы */}
                <div>
                    <h3 className="text-base font-semibold text-gray-800 mb-3">Загруженные документы</h3>
                    {attachedFiles.length > 0 ? (
                        <div className="space-y-3">
                            {attachedFiles.map((file) => (
                                <FileCard
                                    key={file.id}
                                    file={file}
                                    onDownload={handleDownload}
                                    onPreview={handlePreview}
                                    isSelectionMode={isSelectionMode}
                                    isSelected={isSelectionMode ? selectedIds.has(file.id) : false}
                                    onToggleSelection={isSelectionMode ? toggleSelection : undefined}
                                />
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-gray-500 bg-gray-50 p-3 rounded-lg">
                            К этой анкете не прикреплены дополнительные файлы
                        </p>
                    )}
                </div>
            {/* Preview modal */}
            <FilePreviewModal 
                isOpen={!!previewUrl}
                onClose={() => { closePreview(); setPreviewMeta(null); clearError(); }}
                previewUrl={previewUrl}
                loading={previewLoading}
                error={previewError}
                fileName={previewMeta?.name}
                fileId={previewMeta?.id}
            />
            </div>


        </div>
    )
}
