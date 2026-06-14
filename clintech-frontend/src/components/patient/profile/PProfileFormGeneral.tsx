import React from 'react'
import MyInput from '@/components/ui/MyInput'
import { Controller, UseFormRegister, Control, FieldErrors } from 'react-hook-form'
import { TPatient } from '@/types/patient'
import MySelect from '@/components/ui/MySelect'
import { UserIcon } from 'lucide-react'

interface PProfileFormGeneralProps {
    register: UseFormRegister<TPatient>;
    control: Control<TPatient>;
    errors: FieldErrors<TPatient>;
}

export default function PProfileFormGeneral({ 
    register, 
    control, 
    errors 
}: PProfileFormGeneralProps) {
    return (
        <div className="md:rounded-xl md:shadow-md md:border md:border-gray-200 md:p-6">
            <h3 className="flex items-center gap-2 text-xl font-bold mb-6 text-blue-700">
                <UserIcon className="w-6 h-6" />
                Персональная информация
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <MyInput
                    label="Имя*"
                    {...register("first_name", {
                        required: 'Имя обязательно для заполнения',
                        minLength: {
                            value: 2,
                            message: "Имя должно быть не менее 2 символов"
                        },
                        pattern: {
                            value: /^[A-Za-zА-Яа-яёЁ\s]{2,}$/,
                            message: 'Имя может содержать только буквы'
                        }
                    })}
                    errors={errors.first_name}
                />

                <MyInput
                    label="Фамилия*"
                    {...register("last_name", {
                        required: 'Фамилия обязательна для заполнения',
                        minLength: {
                            value: 2,
                            message: "Фамилия должна быть не менее 2 символов"
                        },
                        pattern: {
                            value: /^[A-Za-zА-Яа-яёЁ\s]{2,}$/,
                            message: 'Фамилия может содержать только буквы'
                        }
                    })}
                    errors={errors.last_name}
                />

                <MyInput
                    label="Отчество*"
                    {...register("middle_name", {
                        required: 'Отчество обязательно для заполнения',
                        minLength: {
                            value: 2,
                            message: "Отчество должно быть не менее 2 символов"
                        },
                        pattern: {
                            value: /^[A-Za-zА-Яа-яёЁ\s]{2,}$/,
                            message: 'Отчество может содержать только буквы'
                        }
                    })}
                    errors={errors.middle_name}
                />

                <MyInput
                    label="ИИН"
                    {...register("iin", {
                        pattern: {
                            value: /^[0-9]{12}$/,
                            message: "ИИН должен содержать 12 цифр"
                        }
                    })}
                    errors={errors.iin}
                />

                <MyInput
                    label="Email*"
                    type="email"
                    {...register("email", {
                        required: 'Email обязателен для заполнения',
                        pattern: {
                            value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                            message: "Неверный формат email"
                        }
                    })}
                    errors={errors.email}
                />

                <MyInput
                    label="Номер телефона (не изменяется)"
                    readOnly={true}
                    {...register("phone", {
                        pattern: {
                            value: /^[0-9]{11}$/,
                            message: "Номер должен содержать 11 цифр или оставьте поле пустым"
                        }
                    })}
                    errors={errors.phone}
                />

                <MyInput
                    label="Дата рождения"
                    type="date"
                    {...register("date_of_birth", {
                        required: 'Дата рождения обязательна для заполнения'
                    })}
                    errors={errors.date_of_birth}
                />

                <Controller
                    name="gender"
                    control={control}
                    rules={{ required: 'Пол обязателен для заполнения' }}
                    render={({ field }) => (
                        <MySelect
                            label="Пол*"
                            options={[
                                { label: 'Выберите пол', value: '' },
                                { label: 'Мужской', value: 'male' },
                                { label: 'Женский', value: 'female' }
                            ]}
                            value={field.value}
                            onChange={field.onChange}
                            errors={errors.gender}
                        />
                    )}
                />

                <MyInput
                    label="Место прописки"
                    {...register("address", {
                        minLength: {
                            value: 5,
                            message: "Адрес должен быть не менее 5 символов"
                        }
                    })}
                    errors={errors.address}
                />
            </div>
        </div>
    )
}
