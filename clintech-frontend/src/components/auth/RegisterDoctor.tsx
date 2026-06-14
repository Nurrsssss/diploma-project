'use client'
import { useForm, Controller } from "react-hook-form";
import MyInput from "../ui/MyInput";
import { useAuth } from "@/context/AuthContext";
import { useDoctor } from "@/hooks/doctor/useDoctor";
import { useRouter } from "next/navigation";
import MyButton from "../ui/MyButton";
import MultiselectDropdown from "../ui/MultiselectDropdown";
import { useState } from "react";
import { roleOptions } from "@/arrays/doctor/roleOptions";
import { ensureArray, ensureText, toArray, toEmptyIfEmpty } from "@/utils/formUtils";

interface IRegisterDoctorProps {
    first_name: string;
    middle_name: string;
    last_name: string;
    description: string;
    roles: string[];
}


export default function RegisterDoctor({ passwordData, phoneData }: { passwordData: string, phoneData: string }) {
    const { login, session } = useAuth();
    const { updateProfile } = useDoctor();
    const router = useRouter();
    const { register, handleSubmit, control, formState: { errors } } = useForm<IRegisterDoctorProps>();
    const [formError, setFormError] = useState<string>('');

    const onSubmit = async (data: IRegisterDoctorProps) => {
        setFormError('');
        const dataToSend = {
            // Поля из формы регистрации (точно соответствуют Go модели)
            first_name: data.first_name,
            middle_name: data.middle_name,
            last_name: data.last_name,
            description: data.description || '',
            roles: toArray(data.roles),
            
            // Поля, которые заполняются позже в профиле (пустые значения)
            email: '',
            avatar_url: '',
            price: 0,
            education: [],
            certificates: [],
            // phone НЕ отправляем - он не входит в DoctorUpdateRequest
        };
        
        console.log('Отправляемые данные врача:', dataToSend);
        
        try {
            // ✅ Используем хук для обновления профиля доктора
            const updateResult = await updateProfile(session?.user_id!, dataToSend);

            if (!updateResult.success) {
                setFormError(updateResult.message || 'Ошибка при обновлении профиля');
                return;
            }

            // ✅ Используем новую систему авторизации для повторного входа
            const loginResult = await login({
                phone: phoneData,
                password: passwordData
            });

            if (loginResult.success) {
                router.push(`/${session?.role}/profile`);
            } else {
                setFormError(loginResult.message || 'Ошибка при повторном входе');
            }
        } catch (error) {
            setFormError('Неожиданная ошибка. Попробуйте еще раз.');
        }
    }


    return (
        <>

            {formError && (
                <div className="w-full max-w-md mx-auto mb-4 p-3 flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg justify-center text-center">
                    {formError}
                </div>
            )}

            <MyInput label="Имя" id="first_name" type="text" errors={errors.first_name}
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
            />

            <MyInput label="Фамилия" id="last_name" type="text" errors={errors.last_name}
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
            />

            <MyInput label="Отчество*" id="middle_name" type="text" errors={errors.middle_name}
                placeholder="Иванович"
                {...register('middle_name', {
                    required: 'Отчество обязательно для заполнения',
                    pattern: {
                        value: /^[A-Za-zА-Яа-яёЁ]{2,}$/i,
                        message: 'Неверный формат отчества'
                    }
                })}
            />

            <MyInput label="Описание" id="description" type="text" errors={errors.description}
                placeholder="Описание"
                {...register('description', {
                    minLength: {
                        value: 10,
                        message: 'Описание должно содержать минимум 10 символов'
                    },
                })}
            />


            <Controller
                name="roles"
                control={control}
                rules={{ required: 'Выберите хотя бы одну роль' }}
                render={({ field }) => (
                    <MultiselectDropdown
                        label="Специализация"
                        id="roles"
                        options={roleOptions}
                        value={field.value || []}
                        onChange={field.onChange}
                        errors={errors.roles}
                        placeholder="Выберите специализацию"
                    />
                )}
            />

            <MyButton type="submit" onClick={handleSubmit(onSubmit)} className="mt-3 mb-2 w-full text-white bg-primary hover:bg-primary/90">Зарегистрироваться</MyButton>
        </>
    )
}