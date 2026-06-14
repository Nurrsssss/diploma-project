import { TPatient } from '@/types/patient'
import React from 'react'
import NoContent from '@/components/ui/NoContent'
import { displayArray } from '@/utils/formUtils'
import { getGenderText } from '@/utils/data'
import { formatDate } from '@/utils/date'
import { getLabel, getLabels } from '@/utils/labels'
import { diagnoses, allergens, diets, physActivity } from '@/arrays/patient/register'
import {
    FaUser,
    FaCalendar,
    FaPhone,
    FaEnvelope,
    FaMapMarkerAlt,
    FaIdCard,
    FaRunning,
    FaStethoscope,
    FaAllergies,
    FaAppleAlt,
    FaRulerVertical,
    FaWeight,
    FaVenusMars
} from 'react-icons/fa'

export default function PatientFullInfo({ patient }: { patient: TPatient }) {
    if (!patient) {
        return (
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <NoContent title="Нет данных о пациенте" description="Пациент не найден. Проверьте, что вы перешли по правильной ссылке" />
            </div>
        )
    }

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
            {/* Заголовок */}
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 sm:mb-6">Данные пациента</h2>

            {/* Основная информация */}
            <div className="space-y-3 sm:space-y-4">
                {/* ФИО */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 py-3 border-b border-gray-100">
                    <div className="flex items-center gap-3 min-w-0">
                        <FaUser className="text-gray-400 text-sm flex-shrink-0" />
                        <span className="text-gray-600 text-sm flex-shrink-0">ФИО:</span>
                    </div>
                    <span className="font-semibold text-gray-900 break-words pl-6 sm:pl-0">
                        {patient.last_name} {patient.first_name} {patient?.middle_name || ''}
                    </span>
                </div>

                {/* Дата рождения */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 py-3 border-b border-gray-100">
                    <div className="flex items-center gap-3 min-w-0">
                        <FaCalendar className="text-gray-400 text-sm flex-shrink-0" />
                        <span className="text-gray-600 text-sm flex-shrink-0">Дата рождения:</span>
                    </div>
                    <span className="font-semibold text-gray-900 break-words pl-6 sm:pl-0">
                        {formatDate(patient.date_of_birth)}
                    </span>
                </div>

                {/* Пол */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 py-3 border-b border-gray-100">
                    <div className="flex items-center gap-3 min-w-0">
                        <FaVenusMars className="text-gray-400 text-sm flex-shrink-0" />
                        <span className="text-gray-600 text-sm flex-shrink-0">Пол:</span>
                    </div>
                    <span className="font-semibold text-gray-900 break-words pl-6 sm:pl-0">
                        {getGenderText(patient.gender)}
                    </span>
                </div>

                {/* Рост */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 py-3 border-b border-gray-100">
                    <div className="flex items-center gap-3 min-w-0">
                        <FaRulerVertical className="text-gray-400 text-sm flex-shrink-0" />
                        <span className="text-gray-600 text-sm flex-shrink-0">Рост:</span>
                    </div>
                    <span className="font-semibold text-gray-900 break-words pl-6 sm:pl-0">
                        {patient.height === 0 ? 'Не указано' : `${patient.height} см`}
                    </span>
                </div>

                {/* Вес */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 py-3 border-b border-gray-100">
                    <div className="flex items-center gap-3 min-w-0">
                        <FaWeight className="text-gray-400 text-sm flex-shrink-0" />
                        <span className="text-gray-600 text-sm flex-shrink-0">Вес:</span>
                    </div>
                    <span className="font-semibold text-gray-900 break-words pl-6 sm:pl-0">
                        {patient.weight === 0 ? 'Не указано' : `${patient.weight} кг`}
                    </span>
                </div>

                {/* Физическая активность */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 py-3 border-b border-gray-100">
                    <div className="flex items-center gap-3 min-w-0">
                        <FaRunning className="text-gray-400 text-sm flex-shrink-0" />
                        <span className="text-gray-600 text-sm flex-shrink-0">Физ. активность:</span>
                    </div>
                    <span className="font-semibold text-gray-900 break-words pl-6 sm:pl-0">
                        {getLabel(physActivity, patient.phys_activity || '')}
                    </span>
                </div>

                {/* Диагнозы */}
                <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3 py-3 border-b border-gray-100">
                    <div className="flex items-center gap-3 min-w-0">
                        <FaStethoscope className="text-gray-400 text-sm flex-shrink-0" />
                        <span className="text-gray-600 text-sm flex-shrink-0">Диагнозы:</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-900 break-words pl-6 sm:pl-0">
                        {getLabels(diagnoses, patient.diagnoses)}
                    </span>
                </div>

                {/* Аллергены */}
                <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3 py-3 border-b border-gray-100">
                    <div className="flex items-center gap-3 min-w-0">
                        <FaAllergies className="text-gray-400 text-sm flex-shrink-0" />
                        <span className="text-gray-600 text-sm flex-shrink-0">Аллергены:</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-900 break-words pl-6 sm:pl-0">
                        {getLabels(allergens, patient.allergens)}
                    </span>
                </div>

                {/* Диета */}
                <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3 py-3 border-b border-gray-100">
                    <div className="flex items-center gap-3 min-w-0">
                        <FaAppleAlt className="text-gray-400 text-sm flex-shrink-0" />
                        <span className="text-gray-600 text-sm flex-shrink-0">Диета:</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-900 break-words pl-6 sm:pl-0">
                        {getLabels(diets, patient.diet)}
                    </span>
                </div>
            </div>
        </div>
    )
}
