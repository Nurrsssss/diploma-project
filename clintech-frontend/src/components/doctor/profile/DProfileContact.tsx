'use client'
import { TDoctor } from '@/types/doctors';
import Image from 'next/image';

interface DProfileContactProps {
    contactInfo: TDoctor;
}

export const DProfileContact = ({ contactInfo }: DProfileContactProps) => {
    const contactItems = [
        // {
        //     icon: "/image/doctor/profile/buildings.svg",
        //     label: "Отделение",
        //     value: contactInfo.contactInfo?.department || 'Не указано'
        // },
        // {
        //     icon: "/image/doctor/profile/address.svg",
        //     label: "Адрес",
        //     value: contactInfo.contactInfo?.address || 'Не указано'
        // },
        {
            icon: "/image/doctor/profile/phone.svg",
            label: "Телефон",
            value: contactInfo?.phone || 'Не указано'
        },
        {
            icon: "/image/doctor/profile/email.svg",
            label: "Email",
            value: contactInfo?.email || 'Не указано'
        }
    ];

    return (
        <div className="flex flex-col gap-4 bg-white rounded-xl p-6">
            <h2 className="font-semibold text-[16px] ml-2">Контактная информация</h2>
            
            <div className="space-y-3">
                {contactItems.map((item, index) => (
                    <div key={index} className="flex">
                        <div className="w-8 h-8 flex items-center justify-center mr-1">
                            <Image
                                src={item.icon}
                                alt={item.label}
                                width={20}
                                height={20}
                            />
                        </div>
                        <div className="flex flex-col ml-2">
                            <span className="text-[#64748B] w-32 font-sans text-sm">{item.label}</span>
                            <span className="font-sans text-sm">{item.value}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
