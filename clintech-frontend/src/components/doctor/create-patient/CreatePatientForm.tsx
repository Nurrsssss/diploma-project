'use client'
import { useForm, Controller } from "react-hook-form";
import MyInput from "@/components/ui/MyInput";
import { useCreatePatientByDoctor, CreatePatientByDoctorRequest } from "@/hooks/doctor/useCreatePatientByDoctor";
import { useRouter } from "next/navigation";
import MySelect from "@/components/ui/MySelect";
import MultiselectDropdown from "@/components/ui/MultiselectDropdown";
import MyButton from "@/components/ui/MyButton";
import ErrorMessage from "@/components/ui/ErrorMessage";
import { useState } from "react";
import { toNullIfEmpty, toEmptyIfEmpty, toArray } from "@/utils/formUtils";
import { diagnoses, allergens, diets, physActivity, gender } from "@/arrays/patient/register";
import PhoneInput from "@/components/ui/PhoneInput";

export default function CreatePatientForm() {
    const { createPatient, loading, error, clearError } = useCreatePatientByDoctor();
    const router = useRouter();
    const { register, handleSubmit, control, formState: { errors }, reset } = useForm<CreatePatientByDoctorRequest>();
    const [formError, setFormError] = useState<string>('');
    const [success, setSuccess] = useState(false);
    const [createdPatient, setCreatedPatient] = useState<CreatePatientByDoctorRequest | null>(null);

    const onSubmit = async (data: CreatePatientByDoctorRequest) => {
        setFormError('');
        setSuccess(false);
        clearError();

        // Форматируем телефон - оставляем только цифры
        const phoneDigits = data.phone.replace(/\D/g, '');
        if (phoneDigits.length !== 11 || !phoneDigits.startsWith('7')) {
            setFormError('Неверный формат телефона. Номер должен начинаться с 7 и содержать 11 цифр');
            return;
        }

        const dataToSend: CreatePatientByDoctorRequest = {
            phone: phoneDigits,
            password: data.password,
            first_name: data.first_name,
            last_name: data.last_name,
            middle_name: toEmptyIfEmpty(data.middle_name),
            iin: toNullIfEmpty(data.iin),
            date_of_birth: data.date_of_birth || undefined,
            email: toEmptyIfEmpty(data.email),
            address: toEmptyIfEmpty(data.address),
            gender: toEmptyIfEmpty(data.gender),
            phys_activity: toEmptyIfEmpty(data.phys_activity),
            height: data.height ? Number(data.height) : undefined,
            weight: data.weight ? Number(data.weight) : undefined,
            diagnoses: toArray(data.diagnoses),
            allergens: toArray(data.allergens),
            diet: toArray(data.diet),
        };

        try {
            const result = await createPatient(dataToSend);

            if (result.success) {
                setSuccess(true);
                setCreatedPatient(dataToSend);
                // Очищаем форму и ошибки
                reset();
                setFormError('');
                clearError();
                // Можно редиректнуть или показать сообщение
                setTimeout(() => {
                    setSuccess(false);
                }, 5000);
            } else {
                // Ошибка уже установлена в хуке через error, очищаем formError
                setFormError('');
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Неизвестная ошибка';
            // Ошибка уже будет в error из хука, не дублируем
            setFormError('');
        }
    };

    return (
        <>
            {(error || formError) && (
                <ErrorMessage
                    message={error || formError}
                    variant="error"
                    className="w-full max-w-4xl mx-auto mb-4"
                    onClose={() => {
                        clearError();
                        setFormError('');
                    }}
                />
            )}

            {success && (
                <div className="w-full max-w-4xl mx-auto mb-4 p-4 bg-green-50 border border-green-200 text-green-800 rounded-lg">
                    <div className="flex items-start gap-3">
                        <div className="flex-shrink-0">
                            <svg className="w-5 h-5 text-green-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <div className="flex-1">
                            <div className="text-sm">
                                Пациент <strong>{createdPatient?.first_name} {createdPatient?.last_name}</strong> успешно создан! Телефон: <strong>{createdPatient?.phone}</strong>
                            </div>
                        </div>
                        <button
                            onClick={() => setSuccess(false)}
                            className="flex-shrink-0 text-green-500 hover:text-green-700"
                        >
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                        </button>
                    </div>
                </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <PhoneInput
                        label="Номер телефона*"
                        id="phone"
                        placeholder="+7-(747)-747-77-77"
                        errors={errors.phone}
                        {...register('phone', {
                            required: 'Введите номер телефона',
                            validate: (value) => {
                                if (!value) return 'Введите номер телефона';
                                const digits = value.replace(/\D/g, '');
                                if (digits.length !== 11) {
                                    return 'Неверный формат телефона (11 цифр)';
                                }
                                if (!digits.startsWith('7')) {
                                    return 'Номер должен начинаться с 7';
                                }
                                return true;
                            }
                        })}
                    />

                    <MyInput
                        label="Пароль*"
                        id="password"
                        type="password"
                        errors={errors.password}
                        placeholder="Минимум 8 символов"
                        {...register('password', {
                            required: 'Введите пароль',
                            minLength: {
                                value: 8,
                                message: 'Пароль должен содержать минимум 8 символов'
                            }
                        })}
                    />

                    <MyInput
                        label="Имя*"
                        id="first_name"
                        type="text"
                        errors={errors.first_name}
                        placeholder="Иван"
                        {...register('first_name', {
                            required: 'Введите имя',
                            minLength: {
                                value: 2,
                                message: 'Имя должно содержать минимум 2 символа'
                            },
                            pattern: {
                                value: /^[A-Za-zА-Яа-яёЁ\s]{2,}$/i,
                                message: 'Неверный формат имени'
                            }
                        })}
                    />

                    <MyInput
                        label="Фамилия*"
                        id="last_name"
                        type="text"
                        errors={errors.last_name}
                        placeholder="Иванов"
                        {...register('last_name', {
                            required: 'Введите фамилию',
                            minLength: {
                                value: 2,
                                message: 'Фамилия должна содержать минимум 2 символа'
                            },
                            pattern: {
                                value: /^[A-Za-zА-Яа-яёЁ\s]{2,}$/i,
                                message: 'Неверный формат фамилии'
                            }
                        })}
                    />

                    <MyInput
                        label="Отчество"
                        id="middle_name"
                        type="text"
                        errors={errors.middle_name}
                        placeholder="Иванович"
                        {...register('middle_name', {
                            pattern: {
                                value: /^[A-Za-zА-Яа-яёЁ\s]*$/i,
                                message: 'Неверный формат отчества'
                            }
                        })}
                    />

                    <MyInput
                        label="ИИН"
                        id="iin"
                        type="text"
                        errors={errors.iin}
                        placeholder="123456789012"
                        {...register('iin', {
                            pattern: {
                                value: /^[0-9]{12}$|^$/,
                                message: 'ИИН должен содержать 12 цифр'
                            }
                        })}
                    />

                    <MyInput
                        label="Дата рождения"
                        id="date_of_birth"
                        type="date"
                        errors={errors.date_of_birth}
                        {...register('date_of_birth')}
                    />

                    <Controller
                        name="gender"
                        control={control}
                        render={({ field }) => (
                            <MySelect
                                label="Пол"
                                id="gender"
                                options={gender}
                                onChange={field.onChange}
                                value={field.value || ''}
                                errors={errors.gender}
                            />
                        )}
                    />

                    <MyInput
                        label="Email"
                        id="email"
                        type="email"
                        errors={errors.email}
                        placeholder="patient@example.com"
                        {...register('email', {
                            pattern: {
                                value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                                message: 'Неверный формат email'
                            }
                        })}
                    />

                    <MyInput
                        label="Адрес"
                        id="address"
                        type="text"
                        errors={errors.address}
                        placeholder="г. Алматы, ул. Ленина, 123"
                        {...register('address')}
                    />

                    <Controller
                        name="phys_activity"
                        control={control}
                        render={({ field }) => (
                            <MySelect
                                label="Уровень физ. активности"
                                id="phys_activity"
                                options={physActivity}
                                onChange={field.onChange}
                                value={field.value || ''}
                                errors={errors.phys_activity}
                            />
                        )}
                    />

                    <MyInput
                        label="Рост (см)"
                        id="height"
                        type="number"
                        errors={errors.height}
                        placeholder="170"
                        {...register('height', {
                            min: {
                                value: 50,
                                message: 'Рост должен быть от 50 до 250 см'
                            },
                            max: {
                                value: 250,
                                message: 'Рост должен быть от 50 до 250 см'
                            }
                        })}
                    />

                    <MyInput
                        label="Вес (кг)"
                        id="weight"
                        type="number"
                        errors={errors.weight}
                        placeholder="70"
                        {...register('weight', {
                            min: {
                                value: 20,
                                message: 'Вес должен быть от 20 до 300 кг'
                            },
                            max: {
                                value: 300,
                                message: 'Вес должен быть от 20 до 300 кг'
                            }
                        })}
                    />

                    <Controller
                        name="diagnoses"
                        control={control}
                        render={({ field }) => (
                            <MultiselectDropdown
                                label="Диагнозы"
                                id="diagnoses"
                                options={diagnoses}
                                onChange={field.onChange}
                                value={field.value || []}
                                errors={errors.diagnoses}
                                placeholder="Выберите диагнозы"
                            />
                        )}
                    />

                    <Controller
                        name="allergens"
                        control={control}
                        render={({ field }) => (
                            <MultiselectDropdown
                                label="Аллергены"
                                id="allergens"
                                options={allergens}
                                onChange={field.onChange}
                                value={field.value || []}
                                errors={errors.allergens}
                                placeholder="Выберите аллергены"
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
                                onChange={field.onChange}
                                value={field.value || []}
                                errors={errors.diet}
                                placeholder="Выберите диету"
                            />
                        )}
                    />

                    <div className="md:col-span-2">
                        <MyButton
                            type="submit"
                            disabled={loading}
                            className="mt-3 py-2 text-xl mb-2 w-full text-white bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Создание...' : 'Создать пациента'}
                        </MyButton>
                    </div>
                </div>
            </form>
        </>
    );
}

