'use client'
import { useDoctor } from '@/hooks/doctor/useDoctor'
import { FaUserMd } from 'react-icons/fa'
import { UserIcon } from 'lucide-react'
import Image from 'next/image'

interface DoctorInfoProps {
    doctorId: string
    compact?: boolean
    showAvatar?: boolean
}

export default function DoctorInfo({ doctorId, compact = false, showAvatar = true }: DoctorInfoProps) {
    const { doctor, loading } = useDoctor(doctorId)

    if (loading) {
        return (
            <div className="flex items-center gap-2">
                <FaUserMd className="text-purple-500" />
                <span className="text-sm text-gray-500">Загрузка...</span>
            </div>
        )
    }

    if (!doctor) {
        return (
            <div className="flex items-center gap-2">
                <FaUserMd className="text-gray-400" />
                <span className="text-sm text-gray-500">Врач не найден</span>
            </div>
        )
    }

    const doctorName = `${doctor.last_name || ''} ${doctor.first_name || ''} ${doctor.middle_name || ''}`.trim() || 'Врач'
    const doctorSpecialty = doctor.roles?.join(', ') || ''

    if (compact) {
        return (
            <div className="flex items-center gap-2 mt-">
                {showAvatar && doctor.avatar_url ? (
                    <Image
                        src={doctor.avatar_url}
                        alt={doctorName}
                        width={48}
                        height={48}
                        className="rounded-full object-cover"
                    />
                ) : (
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                        <FaUserMd className="text-primary" size={24} />
                    </div>
                )}
                <div className="text-sm">
                    <div className="font-medium text-gray-900">{doctorName}</div>
                    {doctorSpecialty && (
                        <div className="text-gray-500 text-xs">{doctorSpecialty}</div>
                    )}
                </div>
            </div>
        )
    }

    return (
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            {showAvatar && doctor.avatar_url ? (
                <Image
                    src={doctor.avatar_url}
                    alt={doctorName}
                    width={48}
                    height={48}
                    className="rounded-full object-cover"
                />
            ) : (
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                    <FaUserMd className="text-primary text-2xl" size={40} />
                </div>
            )}
            <div>
                <div className="font-semibold text-gray-900">{doctorName}</div>
                {doctorSpecialty && (
                    <div className="text-primary font-semibold text-md">{doctorSpecialty}</div>
                )}
                {doctor.description && (
                    <div className="text-gray-500 text-sm mt-1">{doctor.description}</div>
                )}
            </div>
        </div>
    )
} 