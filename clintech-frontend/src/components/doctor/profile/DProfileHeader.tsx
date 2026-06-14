'use client'
import { TDoctor } from '@/types/doctors';
import { Avatar } from '@/components/avatar/Avatar';
import { useState } from 'react';



export const DProfileHeader = ({ personalInfo }: { personalInfo: TDoctor }) => {
    const [avatarUrl, setAvatarUrl] = useState(personalInfo.avatar_url);

    const handleAvatarChange = (newUrl?: string) => {
        setAvatarUrl(newUrl);
    };

    return (

        <div className="bg-white rounded-xl p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6">
                {/* Аватар */}
                <Avatar
                    value={avatarUrl}
                    currentAvatarUrl={avatarUrl}
                    onAvatarChange={handleAvatarChange}
                />
                <div className="flex flex-col gap-1 text-center sm:text-left flex-1">
                    <h2 className="font-bold text-lg sm:text-xl text-black">
                        {personalInfo.last_name} {personalInfo.first_name} {personalInfo.middle_name || ''}
                    </h2>
                    <h3 className="text-sm font-semibold text-primary sm:text-base">
                        {personalInfo.roles?.join(', ')}
                    </h3>
                    <p className="font-normal text-[#64748B] text-sm sm:text-base">{personalInfo.description}</p>
                    <p className="font-normal text-[#64748B] text-sm sm:text-base">{personalInfo.price ? `Стоимость приема: ${personalInfo.price} тг` : 'Стоимость приема: не указана'}</p>
                </div>

            </div>
        </div>
    );
};

