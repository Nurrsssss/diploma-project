import { formatDate } from '@/utils/date'
import { getGenderText } from '@/utils/data'
import { ensureText } from '@/utils/formUtils'
import { CalendarIcon, MailIcon, MapPinIcon, PhoneIcon, UserIcon } from 'lucide-react'
import React from 'react'
import { TPatient } from '@/types/patient'

export default function PProfileGeneral({ patient }: { patient: TPatient }) {
    return (
        <div className="bg-white rounded-2xl shadow-md p-6">
            <h3 className="flex items-center gap-2 text-lg font-semibold text-blue-700 mb-6 border-b border-gray-200 pb-2">
                <UserIcon className="w-5 h-5" />
                Персональная информация
            </h3>

            <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Имя:</label>
                        <p className="text-gray-900 font-medium">{ensureText(patient.first_name)}</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Отчество:</label>
                        <p className="text-gray-900">{patient.middle_name || 'Не указано'}</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">ИИН:</label>
                        <p className="text-gray-900">{ensureText(patient.iin)}</p>
                    </div>


                    <div>
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-600 mb-1">
                            <MailIcon className="w-4 h-4 text-gray-500" />
                            Email:</label>
                        <p className="text-gray-900">{ensureText(patient.email)}</p>
                    </div>

                    <div>
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-600 mb-1">
                            <CalendarIcon className="w-4 h-4 text-gray-500" />
                            Дата рождения:
                        </label>
                        <p className="text-gray-900">{formatDate(patient.date_of_birth)}</p>

                    </div>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Фамилия:</label>
                        <p className="text-gray-900 font-medium">{ensureText(patient.last_name)}</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Пол:</label>
                        <p className="text-gray-900">{getGenderText(patient.gender)}</p>
                    </div>

                    <div>
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-600 mb-1">
                            <PhoneIcon className="w-4 h-4 text-gray-500" />

                            Номер телефона:</label>
                        <p className="text-gray-900">{ensureText(patient.phone)}</p>
                    </div>

                    <div>
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-600 mb-1">
                            <MapPinIcon className="w-4 h-4 text-gray-500" />
                            Место прописки:</label>
                        <p className="text-gray-900">{ensureText(patient.address)}</p>
                    </div>
                </div>
            </div>
        </div >
    )
}
