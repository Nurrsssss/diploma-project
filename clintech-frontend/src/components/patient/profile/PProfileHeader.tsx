'use client'
import { CalendarIcon, UserIcon, PencilIcon, TicketIcon } from 'lucide-react'
import { TPatient } from '@/types/patient'
import MyButton from '@/components/ui/MyButton'
import { formatDate } from '@/utils/date'
import { getFullName, getGenderText } from '@/utils/data'
import { Avatar } from '@/components/avatar/Avatar';
import { useState } from 'react';

interface PProfileHeaderProps {
    patient: TPatient;
    onEditClick: () => void;
    updating?: boolean;
}

export default function PProfileHeader({ patient, onEditClick, updating }: PProfileHeaderProps) {
    const [avatarUrl, setAvatarUrl] = useState(patient.avatar_url);

    const handleAvatarChange = (newUrl?: string) => {
        setAvatarUrl(newUrl);
    };

    return (
        <div className="bg-white shadow rounded-2xl p-6">
            {/* Мобильная версия */}
            <div className="md:hidden flex flex-col items-center text-center space-y-4">
                {/* Аватар */}
                <Avatar
                    value={avatarUrl}
                    currentAvatarUrl={avatarUrl}
                    onAvatarChange={handleAvatarChange}
                />

                {/* Информация о пациенте */}
                <div className="space-y-2 w-full">
                    <h2 className="text-2xl font-semibold text-gray-900">
                        {getFullName(patient)}
                    </h2>

                    <p className="text-md text-gray-600 flex flex-col sm:flex-row sm:items-center sm:justify-center gap-1 sm:gap-2">
                        <span className="flex items-center justify-center gap-2">
                            <CalendarIcon className="w-4 h-4" />
                            <b>Дата рождения:</b> {formatDate(patient?.date_of_birth)}
                        </span>
                        <span className="hidden sm:inline">|</span>
                        <span className="flex items-center justify-center gap-2">
                            <b>Пол:</b> {getGenderText(patient?.gender)}
                        </span>
                    </p>

                    {/* Кнопка редактирования */}
                    <div className="pt-2">
                        <MyButton
                            onClick={onEditClick}
                            disabled={updating}
                            className="rounded-xl px-6 bg-primary hover:bg-primary/90 text-white font-semibold flex items-center gap-2 disabled:opacity-50 mx-auto"
                        >
                            <PencilIcon className="w-4 h-4" />
                            {updating ? 'Загрузка...' : 'Изменить профиль'}
                        </MyButton>
                    </div>
                </div>
            </div>

            {/* Десктопная версия */}
            <div className="hidden md:flex items-start gap-6">
                {/* Фото слева */}
                <div className="flex-shrink-0">
                    <Avatar
                        value={avatarUrl}
                        currentAvatarUrl={avatarUrl}
                        onAvatarChange={handleAvatarChange}
                    />
                </div>

                {/* Данные справа */}
                <div className="flex-1 space-y-4">
                    <div>
                        <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                            {getFullName(patient)}
                        </h2>

                        <p className="text-md text-gray-600 flex items-center gap-4">
                            <span className="flex items-center gap-2">
                                <CalendarIcon className="w-4 h-4" />
                                <b>Дата рождения:</b> {formatDate(patient?.date_of_birth)}
                            </span>
                            <span className="flex items-center gap-2">
                                <b>Пол:</b> {getGenderText(patient?.gender)}
                            </span>
                        </p>
                    </div>

                    {/* Кнопка редактирования */}
                    <div>
                        <MyButton
                            onClick={onEditClick}
                            disabled={updating}
                            className="rounded-xl  bg-primary hover:bg-primary/90 text-white font-semibold flex items-center gap-2 disabled:opacity-50"
                        >
                            <PencilIcon className="w-4 h-4" />
                            {updating ? 'Загрузка...' : 'Изменить профиль'}
                        </MyButton>
                    </div>
                </div>
            </div>
        </div>
    )
}
