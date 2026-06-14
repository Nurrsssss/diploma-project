'use client';

import React, { useState, useRef, useCallback } from 'react';
import { useAvatar } from '@/hooks/avatar/useAvatar';
import { Camera, Upload, Trash2, X } from 'lucide-react';

interface IAvatarProps {
    value?: string;
    currentAvatarUrl?: string;
    onAvatarChange?: (avatarUrl?: string) => void;
    className?: string;
}

export const Avatar: React.FC<IAvatarProps> = ({
    value,
    currentAvatarUrl,
    onAvatarChange,
    className = '',
}) => {
    const { uploadAvatar, deleteAvatar, loading, error, clearError } = useAvatar();
    const [dragActive, setDragActive] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = useCallback(async (file: File) => {
        // Проверяем тип файла
        // Проверяем тип файла
        if (!['image/jpeg', 'image/png'].includes(file.type)) {
            throw new Error('Разрешены только файлы JPEG и PNG');
        }

        // Проверяем размер файла (максимум 5MB)
        if (file.size > 5 * 1024 * 1024) {
            throw new Error('Размер файла не должен превышать 5MB');
        }

        try {
            // Создаем предпросмотр
            const reader = new FileReader();
            reader.onload = (e) => {
                setPreviewUrl(e.target?.result as string);
            };
            reader.readAsDataURL(file);

            // Загружаем аватарку
            const result = await uploadAvatar(file);

            if (result.success && onAvatarChange) {
                onAvatarChange(result.avatar_url);
            }
        } catch (err) {
            console.error('Ошибка загрузки аватарки:', err);
        }
    }, [uploadAvatar, onAvatarChange]);

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            handleFileSelect(file);
        }
    }, [handleFileSelect]);

    const handleDrag = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        const file = e.dataTransfer.files?.[0];
        if (file) {
            handleFileSelect(file);
        }
    }, [handleFileSelect]);

    const handleDelete = useCallback(async () => {
        if (!confirm('Вы уверены, что хотите удалить аватарку?')) {
            return;
        }

        try {
            await deleteAvatar();
            setPreviewUrl(null);
            if (onAvatarChange) {
                onAvatarChange(undefined);
            }
        } catch (err) {
            console.error('Ошибка удаления аватарки:', err);
        }
    }, [deleteAvatar, onAvatarChange]);

    const handleClick = useCallback(() => {
        fileInputRef.current?.click();
    }, []);


    return (
        <div className={`flex flex-col items-center space-y-4 ${className}`}>
            {/* Сообщение об ошибке */}
            {error && (
                <div className="flex items-center gap-2 bg-red-50 text-red-600 px-3 py-2 rounded-md text-sm">
                    <span>Ошибка загрузки аватарки</span>
                    <button onClick={clearError} className="hover:text-red-700">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}
            
            {/* Аватарка */}
            <div className="relative group">
                <div
                    className={`w-32 h-32 rounded-full overflow-hidden border-2 border-gray-200 cursor-pointer transition-all duration-200 ${dragActive ? 'border-blue-500 bg-blue-50' : 'hover:border-gray-300'
                        }`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    onClick={handleClick}
                >
                    {loading ? (
                        <div className="w-full h-full bg-gray-50 flex items-center justify-center">
                            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : value ? (
                        <img
                            src={value}
                            alt="Аватарка"
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                            <Camera className="w-8 h-8 text-gray-400" />
                        </div>
                    )}

                    {/* Overlay при hover */}
                    <div className="absolute inset-0 rounded-full bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200 flex items-center justify-center">
                        <Upload className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                    </div>
                </div>

                {/* Кнопка удаления */}
                {value && (
                    <button
                        onClick={handleDelete}
                        disabled={loading}
                        className="absolute -top-2 -right-2 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors duration-200 disabled:opacity-50"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                )}
            </div>

            {/* Скрытый input */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png"
                onChange={handleInputChange}
                className="hidden"
            />
        </div>
    );
}; 