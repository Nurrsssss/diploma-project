import React from 'react'
import { HeartIcon } from 'lucide-react'
import MyInput from '@/components/ui/MyInput'
import { Controller, UseFormRegister, Control, FieldErrors } from 'react-hook-form'
import { TPatient } from '@/types/patient'
import MySelect from '@/components/ui/MySelect'
import MultiselectDropdown from '@/components/ui/MultiselectDropdown'
import { diagnoses, allergens, diets, physActivity } from '@/arrays/patient/register'

interface PProfileFormMedProps {
    register: UseFormRegister<TPatient>;
    control: Control<TPatient>;
    errors: FieldErrors<TPatient>;
}

export default function PProfileFormMed({
    register,
    control,
    errors
}: PProfileFormMedProps) {
    return (
        <div className="md:rounded-xl md:shadow-md md:border md:border-gray-200 md:p-6">
            <h3 className="flex items-center gap-2 text-xl font-bold mb-6 text-red-700">
                <HeartIcon className="w-6 h-6" />
                Медицинская информация
            </h3>

            <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <MyInput
                        label="Рост (см)*"
                        type="number"
                        {...register("height", {
                            required: 'Рост обязателен для заполнения',
                            valueAsNumber: true,
                            min: {
                                value: 50,
                                message: "Рост должен быть от 50 до 250 см"
                            },
                            max: {
                                value: 250,
                                message: "Рост должен быть от 50 до 250 см"
                            }
                        })}
                        errors={errors.height}
                    />

                    <Controller
                        name="phys_activity"
                        control={control}
                        render={({ field }) => (
                            <MySelect
                                label="Физическая активность*"
                                options={physActivity}
                                value={field.value}
                                onChange={field.onChange}
                                errors={errors.phys_activity}
                            />
                        )}
                    />

                    <Controller
                        name="diagnoses"
                        control={control}
                        rules={{}}
                        render={({ field }) => (
                            <MultiselectDropdown
                                label="Диагнозы"
                                id="diagnoses"
                                options={diagnoses}
                                value={field.value || []}
                                onChange={field.onChange}
                                errors={errors.diagnoses}
                                placeholder="Выберите диагнозы"
                            />
                        )}
                    />

                    <Controller
                        name="diet"
                        control={control}
                        render={({ field }) => (
                            <MultiselectDropdown
                                label="Диета"
                                id="diet"
                                options={diets}
                                value={field.value || []}
                                onChange={field.onChange}
                                errors={errors.diet}
                                placeholder="Выберите диету"
                            />
                        )}
                    />
                </div>

                <div className="space-y-4">
                    <MyInput
                        label="Вес (кг)*"
                        type="number"
                        {...register("weight", {
                            required: 'Вес обязателен для заполнения',
                            valueAsNumber: true,
                            min: {
                                value: 20,
                                message: "Вес должен быть от 20 до 300 кг"
                            },
                            max: {
                                value: 300,
                                message: "Вес должен быть от 20 до 300 кг"
                            }
                        })}
                        errors={errors.weight}
                    />

                    <Controller
                        name="allergens"
                        control={control}
                        rules={{}}
                        render={({ field }) => (
                            <MultiselectDropdown
                                label="Аллергены"
                                id="allergens"
                                options={allergens}
                                value={field.value || []}
                                onChange={field.onChange}
                                errors={errors.allergens}
                                placeholder="Выберите аллергены"
                            />
                        )}
                    />


                </div>
            </div>
        </div>
    )
}
