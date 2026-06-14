'use client'
import { useForm, useFieldArray, Controller } from "react-hook-form";
import MyInput from "@/components/ui/MyInput";
import MyButton from "@/components/ui/MyButton";
import MultiselectDropdown from "@/components/ui/MultiselectDropdown";
import Modal from "@/components/ui/Modal";
import ErrorMessage from "@/components/ui/ErrorMessage";
import { TDoctor } from "@/types/doctors";
import { useState, useCallback, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useDoctor } from "@/hooks/doctor/useDoctor";
import { FaPlus, FaTrash } from "react-icons/fa";
import { roleOptions } from "@/arrays/doctor/roleOptions";
import { ensureText, toArray, toEmptyIfEmpty } from "@/utils/formUtils";
import { processError } from '@/utils/errorUtils';

interface IDoctorProfileEditFormProps {
    doctor: TDoctor;
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: TDoctor) => void;
    refetch: () => void;
}

type TProfileFormData = {
    first_name: string;
    middle_name: string;
    last_name: string;
    description: string;
    phone: string;
    email: string;
    price: string;
    roles: string[];
    education: { value: string }[];
    certificates: { value: string }[];
}

export const DoctorProfileEditForm = ({ doctor, isOpen, onClose, onSave, refetch }: IDoctorProfileEditFormProps) => {
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { session } = useAuth();
    const { updateProfile } = useDoctor();

    const { register, control, handleSubmit, formState: { errors }, reset } = useForm<TProfileFormData>({
        defaultValues: {
            first_name: doctor.first_name || '',
            middle_name: doctor.middle_name || '',
            last_name: doctor.last_name || '',
            description: doctor.description || '',
            phone: doctor.phone || '',
            email: doctor.email || '',
            price: doctor.price?.toString() || '',
            roles: doctor.roles || [],
            education: doctor.education?.map(edu => ({ value: edu })) || [{ value: '' }],
            certificates: doctor.certificates?.map(cert => ({ value: cert })) || [{ value: '' }],
        }
    });

    const { fields: educationFields, append: appendEducation, remove: removeEducation } = useFieldArray({
        control,
        name: "education"
    });

    const { fields: certificateFields, append: appendCertificate, remove: removeCertificate } = useFieldArray({
        control,
        name: "certificates"
    });

    // Обновляем форму когда приходят новые данные врача
    useEffect(() => {
        const formData = {
            first_name: doctor.first_name || '',
            middle_name: doctor.middle_name || '',
            last_name: doctor.last_name || '',
            description: doctor.description || '',
            phone: doctor.phone || '',
            email: doctor.email || '',
            price: doctor.price?.toString() || '',
            roles: doctor.roles || [],
            education: doctor.education?.map(edu => ({ value: edu })) || [{ value: '' }],
            certificates: doctor.certificates?.map(cert => ({ value: cert })) || [{ value: '' }],
        };
        reset(formData);
    }, [doctor, reset]);

    const clearError = () => setError(null);

    const onSubmit = useCallback(async (data: TProfileFormData) => {
        if (!session?.user_id) {
            setError('Нет данных пользователя');
            return;
        }

        setSaving(true);
        setError(null);

        try {
            const dataToSend = {
                first_name: data.first_name,
                middle_name: toEmptyIfEmpty(data.middle_name),
                last_name: data.last_name,
                description: ensureText(data.description),
                email: '',
                avatar_url: '',
                roles: toArray(data.roles),
                price: data.price ? Number(data.price) : 0,
                education: data.education.map(item => item.value.trim()).filter(value => value.length > 0),
                certificates: data.certificates.map(item => item.value.trim()).filter(value => value.length > 0),
                // phone НЕ отправляем - он не входит в DoctorUpdateRequest
            };

            const result = await updateProfile(session.user_id!, dataToSend);

            if (!result.success) {
                const errorMessage = result.message || 'Ошибка при обновлении профиля';
                console.error('Ошибка обновления профиля:');
                setError(errorMessage);
                return;
            }

            const updatedDoctor: TDoctor = {
                ...doctor,
                first_name: data.first_name,
                middle_name: data.middle_name,
                last_name: data.last_name,
                description: data.description,
                phone: data.phone,
                email: data.email,
                price: data.price ? Number(data.price) : undefined,
                roles: toArray(data.roles),
                education: data.education.map(item => item.value.trim()).filter(value => value.length > 0),
                certificates: data.certificates.map(item => item.value.trim()).filter(value => value.length > 0),
            };

            onSave(updatedDoctor);
            onClose();
            refetch();
        } catch (err: any) {
            const errorMessage = processError(err, {
                default: 'Ошибка при сохранении профиля'
            });
            setError(errorMessage);
        } finally {
            setSaving(false);
        }
    }, [session?.user_id, updateProfile, doctor, onSave, onClose, refetch]);

    // Сброс формы при закрытии
    const handleClose = () => {
        reset();
        clearError();
        onClose();
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            title="Редактировать профиль"
            size="xl"
        >
            <div className="p-6">
                {error && (
                    <ErrorMessage
                        message={error}
                        variant="error"
                        className="mb-6"
                        onClose={clearError}
                    />
                )}

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
                    {/* Основная информация */}
                    <div className="md:border md:border-gray-200 md:shadow-md md:rounded-xl md:p-6">
                        <h3 className="text-xl font-bold mb-4 text-gray-700">Основная информация</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <MyInput
                                label="Имя"
                                placeholder="Иван"
                                {...register('first_name', {
                                    required: 'Введите имя',
                                    minLength: {
                                        value: 2,
                                        message: 'Имя должно содержать минимум 2 символа'
                                    },
                                    pattern: {
                                        value: /^[A-Za-zА-Яа-яёЁ]{2,}$/i,
                                        message: 'Неверный формат имени'
                                    }
                                })}
                                errors={errors.first_name}
                            />

                            <MyInput
                                label="Фамилия"
                                placeholder="Иванов"
                                {...register('last_name', {
                                    required: 'Введите фамилию',
                                    minLength: {
                                        value: 2,
                                        message: 'Фамилия должна содержать минимум 2 символа'
                                    },
                                    pattern: {
                                        value: /^[A-Za-zА-Яа-яёЁ]{2,}$/i,
                                        message: 'Неверный формат фамилии'
                                    }
                                })}
                                errors={errors.last_name}
                            />
                        </div>

                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                            <MyInput
                                label="Отчество*"
                                placeholder="Иванович"
                                {...register('middle_name', {
                                    required: 'Отчество обязательно для заполнения',
                                    pattern: {
                                        value: /^[A-Za-zА-Яа-яёЁ]{2,}$/i,
                                        message: 'Неверный формат отчества'
                                    }
                                })}
                                errors={errors.middle_name}
                            />
                            <MyInput
                                label="Описание"
                                placeholder="Опишите ваш опыт и квалификацию"
                                {...register('description')}
                                errors={errors.description}
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                            <MyInput
                                label="Стоимость приема (тенге)"
                                type="number"
                                placeholder="5000"
                                {...register('price', {
                                    pattern: {
                                        value: /^\d+$/,
                                        message: 'Цена должна содержать только числа'
                                    },
                                    min: {
                                        value: 0,
                                        message: 'Цена не может быть отрицательной'
                                    },
                                    max: {
                                        value: 1000000,
                                        message: 'Цена не может превышать 1,000,000 тенге'
                                    }
                                })}
                                errors={errors.price}
                            />

                            <Controller
                                name="roles"
                                control={control}
                                rules={{ required: 'Выберите хотя бы одну специализацию' }}
                                render={({ field }) => (
                                    <MultiselectDropdown
                                        label="Специализации"
                                        id="roles"
                                        options={roleOptions}
                                        value={field.value || []}
                                        onChange={field.onChange}
                                        errors={errors.roles}
                                        placeholder="Выберите специализацию"
                                    />
                                )}
                            />
                        </div>
                    </div>

                    {/* Контактная информация 
                    <div className="md:border md:border-gray-200 md:shadow-md md:rounded-xl md:p-6">
                        <h3 className="text-xl font-bold mb-4 text-gray-700">Контактная информация</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <MyInput
                                label="Телефон"
                                placeholder="87777777777"
                                {...register('phone')}
                                errors={errors.phone}
                            />

                            {/* <MyInput
                                label="Email"
                                type="email"
                                placeholder="doctor@example.com"
                                {...register('email')}
                                errors={errors.email}
                            /> 
            </div>
        </div>
        */}

                    {/* Образование */}
                    <div className="md:border md:border-gray-200 md:shadow-md md:rounded-xl md:p-6">
                        <h3 className="text-xl font-bold mb-4 text-gray-700">Образование</h3>
                        {educationFields.map((field, index) => (
                            <div key={field.id} className="flex gap-2 items-start mb-4">
                                <div className="flex-1">
                                    <MyInput
                                        label={`Образование ${index + 1}`}
                                        placeholder="Например: Медицинский Университет, Лечебное дело (2008)"
                                        {...register(`education.${index}.value`)}
                                        errors={errors.education?.[index]?.value}
                                    />
                                </div>

                                {educationFields.length > 1 && (
                                    <MyButton
                                        type="button"
                                        onClick={() => removeEducation(index)}
                                        className="bg-red-500 text-white mt-6 px-3 shadow"
                                    >
                                        <FaTrash />
                                    </MyButton>
                                )}
                            </div>
                        ))}

                        <MyButton
                            type="button"
                            onClick={() => appendEducation({ value: '' })}
                            className="flex items-center gap-2 bg-primary text-white shadow hover:bg-primary/90 mt-2"
                        >
                            <FaPlus className="mr-2" />
                            Добавить образование
                        </MyButton>
                    </div>

                    {/* Сертификаты */}
                    <div className="md:border md:border-gray-200 md:shadow-md md:rounded-xl md:p-6">
                        <h3 className="text-xl font-bold mb-4 text-gray-700">Описание</h3>
                        {certificateFields.map((field, index) => (
                            <div key={field.id} className="flex gap-2 items-start mb-4">
                                <div className="flex-1">
                                    <MyInput
                                        label={`Описание ${index + 1}`}
                                        placeholder=""
                                        {...register(`certificates.${index}.value`)}
                                        errors={errors.certificates?.[index]?.value}
                                    />
                                </div>

                                {certificateFields.length > 1 && (
                                    <MyButton
                                        type="button"
                                        onClick={() => removeCertificate(index)}
                                        className="bg-red-500 text-white mt-6 px-3 shadow"
                                    >
                                        <FaTrash />
                                    </MyButton>
                                )}
                            </div>
                        ))}

                        <MyButton
                            type="button"
                            onClick={() => appendCertificate({ value: '' })}
                            className="flex items-center gap-2 bg-primary text-white shadow hover:bg-primary/90 mt-2"
                        >
                            <FaPlus className="mr-2" />
                            Добавить описание
                        </MyButton>
                    </div>

                    {/* Кнопки действий */}
                    <div className="md:px-6 flex gap-4">
                        <MyButton
                            type="submit"
                            disabled={saving}
                            className="text-lg bg-primary text-white shadow-md hover:bg-primary/90"
                        >
                            {saving ? 'Сохранение...' : 'Сохранить'}
                        </MyButton>

                        <MyButton
                            type="button"
                            onClick={handleClose}
                            className="bg-gray-500 text-white text-lg shadow-md hover:bg-gray-600"
                        >
                            Отменить
                        </MyButton>
                    </div>
                </form >
            </div >
        </Modal >
    );
}; 