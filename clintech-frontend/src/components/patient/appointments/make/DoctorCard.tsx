import React from 'react';
import Image from 'next/image';
import { UserIcon } from 'lucide-react';
import { IoLocationOutline } from 'react-icons/io5';
import { TDoctor } from '@/types/doctors';
import MyButton from '@/components/ui/MyButton';
import Loader from '@/components/ui/Loader';

interface DoctorCardProps {
    doctor: TDoctor;
    onSelect: (doctor: TDoctor) => void;
    isLoading?: boolean;
}

const DoctorCard: React.FC<DoctorCardProps> = ({ doctor, onSelect, isLoading = false }) => {
    const handleSelectDoctor = () => {
        if (!isLoading) {
            onSelect(doctor);
        }
    };


    return (
        <div className="flex flex-col lg:flex-row items-start gap-4 p-4 bg-white rounded-2xl shadow-md hover:shadow-lg transition-shadow">
            {/* Фото врача */}
            <div className="flex-shrink-0 mx-auto lg:mx-0">
                {doctor.avatar_url ? (
                    <Image
                        src={doctor.avatar_url}
                        alt={`${doctor.first_name} ${doctor.last_name}`}
                        width={128}
                        height={128}
                        className="rounded-xl object-cover"
                    />
                ) : (
                    <div className="w-32 h-32 bg-primary rounded-full flex items-center justify-center">
                        <UserIcon className="w-20 h-20 text-white" />
                    </div>
                )}
            </div>

            {/* Информация о враче */}
            <div className="flex-1 w-full">
                <div className="flex flex-col lg:flex-row justify-between gap-4">
                    {/* Основная информация */}
                    <div className="flex-1 space-y-1">
                        <h1 className="font-bold text-xl text-gray-900">
                            {doctor.last_name} {doctor.first_name} {doctor.middle_name || ''}
                        </h1>

                        <p className="flex flex-wrap items-center gap-2">
                            <span className="text-primary text-lg font-semibold">
                                {doctor.roles?.join(', ')}
                            </span>

                        </p>

                        <p className="text-gray-600 text-sm md:text-md line-clamp-2">
                            {doctor.description === 'Не указано' ? 'Врач не указал информацию о себе' : doctor.description}
                        </p>

                        <div className="flex flex-wrap items-center gap-4 text-sm">
                            <div className="flex items-center gap-1">
                                <span className="text-primary font-semibold">
                                    {doctor.price ? `${doctor.price} тенге` : 'Цена не указана'}
                                </span>
                            </div>

                            <div className="flex items-center gap-1 text-gray-500">
                                <IoLocationOutline className="w-4 h-4" />
                                <span>Clintech Clinic</span>
                            </div>
                        </div>
                    </div>

                    {/* Кнопка выбора */}
                    <div className="flex flex-col gap-3 lg:min-w-[200px]">
                        <MyButton
                            onClick={handleSelectDoctor}
                            disabled={isLoading}
                            className={`w-full text-lg font-bold py-3 rounded-xl transition-all ${isLoading
                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                : 'bg-primary hover:bg-primary/90 text-white hover:shadow-md'
                                }`}
                        >
                            {isLoading ? (
                                <div className="flex items-center justify-center gap-2">
                                    <Loader />
                                    <span>Загрузка...</span>
                                </div>
                            ) : (
                                'Выбрать специалиста'
                            )}
                        </MyButton>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DoctorCard; 