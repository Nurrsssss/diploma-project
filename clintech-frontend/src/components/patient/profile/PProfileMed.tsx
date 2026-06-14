import { ensureArray, ensureText } from '@/utils/formUtils'
import { HeartIcon } from 'lucide-react'
import { TPatient } from '@/types/patient'
import { diagnoses, diets, allergens, physActivity } from '@/arrays/patient/register'
import { getLabel, getLabels } from '@/utils/labels'


export default function PProfileMed({ patient }: { patient: TPatient }) {
    return (
        <div className="bg-white rounded-2xl shadow-md p-6">
            <h3 className="flex items-center gap-2 text-lg font-semibold text-red-700 mb-6 border-b border-gray-200 pb-2">
                <HeartIcon className="w-5 h-5" />
                Медицинская информация
            </h3>

            <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Рост (см):</label>
                        <p className="text-gray-900">{ensureText(patient.height)}</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Физическая активность:</label>
                        <p className="text-gray-900">{getLabel(physActivity, patient.phys_activity || '')}</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Диагнозы:</label>
                        <p className="text-gray-900">{getLabels(diagnoses, ensureArray(patient.diagnoses))}</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Диета:</label>
                        <p className="text-gray-900">{getLabels(diets, ensureArray(patient.diet))}</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Вес (кг):</label>
                        <p className="text-gray-900">{ensureText(patient.weight)}</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Аллергены:</label>
                        <p className="text-gray-900">{getLabels(allergens, ensureArray(patient.allergens))}</p>
                    </div>
                </div>
            </div>
        </div>
    )
}
