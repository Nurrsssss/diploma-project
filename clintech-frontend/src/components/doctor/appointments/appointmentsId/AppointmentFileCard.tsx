import MyButton from '@/components/ui/MyButton';
import { Download, FileText, Trash2, Edit, Eye } from 'lucide-react';
import React from 'react'
import { useAuth } from '@/context/AuthContext';
import { formatDateWithTime } from '@/utils/date';

interface AppointmentFileCardProps {
    file: any;
    canEdit: boolean;
    deleteConfirmId: string | null;
    deleteFile: (id: string) => void;
    setDeleteConfirmId: (id: string | null) => void;
    getDownloadUrl: (id: string) => string;
    onEdit?: (fileId: string) => void; // Добавляем пропс для редактирования
    onPreview?: (fileId: string, fileName: string) => void; // Добавляем пропс для предпросмотра
    isHealthPassport?: boolean; // Добавляем флаг для паспорта здоровья
}

export default function AppointmentFileCard({ 
    file, 
    canEdit, 
    deleteConfirmId, 
    deleteFile, 
    setDeleteConfirmId, 
    getDownloadUrl,
    onEdit,
    onPreview,
    isHealthPassport = false
}: AppointmentFileCardProps) {
    const { session } = useAuth();

    // Проверяем, может ли текущий пользователь удалить этот файл
    const canDeleteFile = () => {
        if (!canEdit) return false;
        if (!session?.role) return false;

        // Пациент может удалять только свои файлы
        if (session.role === 'patient') {
            return file.uploaded_by === 'patient';
        }

        // Врач может удалять только свои файлы
        if (session.role === 'doctor') {
            return file.uploaded_by === 'doctor';
        }

        return false;
    };

    // Проверяем, может ли текущий пользователь редактировать паспорт здоровья
    const canEditHealthPassport = () => {
        if (!session?.role) return false;
        
        // Только врач может редактировать паспорт здоровья - ВСЕГДА, даже после завершения
        return session.role === 'doctor' && isHealthPassport;
    };

    // Проверяем, может ли текущий пользователь видеть паспорт здоровья
    const canViewHealthPassport = () => {
        return (session?.role === 'doctor' || session?.role === 'patient') && isHealthPassport;
    };


    console.log('file', file);
    return (
        <>
            <div className="flex flex-col md:flex-row md:items-center gap-2 sm:gap-3 min-w-0 w-0 flex-1">
                <p className='flex items-center gap-2'>
                    <FileText className="hidden md:block w-5 h-5 text-blue-400 shrink-0" />
                    <span className="font-medium truncate max-w-[180px] md:max-w-xs" title={file.file_name}>{isHealthPassport ? 'Паспорт здоровья' : (file.file_name || file.name)}</span>
                </p>
                <p className='flex items-center gap-2'>
                    {file.size && <span className="text-xs text-gray-500 shrink-0">({(file.size / 1024).toFixed(1)} КБ)</span>}
                    {file.created_at && <span className="text-xs text-gray-400 shrink-0">{formatDateWithTime(file.created_at)}</span>}
                </p>
            </div>
            <div className="flex gap-2 items-center shrink-0">
                {/* Кнопка предпросмотра */}
                {onPreview && (
                    <button
                        onClick={() => {
                            console.log('📁 Preview file - file_id:', file.file_id, 'Name:', file.file_name || file.name);
                            onPreview(file.file_id, file.file_name || file.name);
                        }}
                        className="p-2 rounded hover:bg-green-100"
                        title="Предпросмотр"
                    >
                        <Eye className="w-5 h-5 text-green-600" />
                    </button>
                )}

                {/* Кнопка скачивания */}
                <a
                    href={getDownloadUrl(file.file_id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded hover:bg-blue-100"
                    title="Скачать"
                >
                    <Download className="w-5 h-5 text-blue-600" />
                </a>

                {/* Кнопка "Изменить" для паспорта здоровья */}
                {canEditHealthPassport() && onEdit && (
                    <button
                        onClick={() => onEdit(file.id)}
                        className="p-2 rounded hover:bg-orange-100"
                        title="Редактировать паспорт здоровья"
                    >
                        <Edit className="w-5 h-5 text-orange-600" />
                    </button>
                )}

                {canDeleteFile() && (
                    deleteConfirmId === file.id ? (
                        <div className="flex gap-1 items-center">
                            <span className="text-xs text-gray-600">Удалить?</span>
                            <MyButton onClick={() => { deleteFile(file.id); setDeleteConfirmId(null); }} className="bg-red-500 text-white px-2 py-1 text-xs rounded hover:bg-red-600">Да</MyButton>
                            <MyButton onClick={() => setDeleteConfirmId(null)} className="bg-gray-300 text-gray-700 px-2 py-1 text-xs rounded">Нет</MyButton>
                        </div>
                    ) : (
                        <MyButton onClick={() => setDeleteConfirmId(file.id)} className="bg-red-500 text-white px-2 py-1 text-sm rounded hover:bg-red-600">
                            <Trash2 className="w-4 h-4" />
                        </MyButton>
                    )
                )}
            </div>
        </>
    )
}
