'use client';

import { useForm, Controller } from 'react-hook-form';
import MyInput from '../ui/MyInput';
import { useAuth } from '@/context/AuthContext';
import { usePatientProfile } from '@/hooks/patient/usePatientProfile';
import { useRouter } from 'next/navigation';
import MySelect from '../ui/MySelect';
import MultiselectDropdown from '../ui/MultiselectDropdown';
import MyButton from '../ui/MyButton';
import ErrorMessage from '../ui/ErrorMessage';
import { TPatient } from '@/types/patient';
import { useState } from 'react';
import { toNullIfEmpty, toEmptyIfEmpty, toArray } from '@/utils/formUtils';
import { formatErrorMessage } from '@/utils/errorUtils';
import { diagnoses, allergens, diets, physActivity, gender } from '@/arrays/patient/register';

export default function RegisterPatient({
  passwordData,
  phoneData,
}: {
  passwordData: string;
  phoneData: string;
}) {
  const { login, session } = useAuth();
  const { updateProfile } = usePatientProfile();
  const router = useRouter();
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<TPatient>();
  const [formError, setFormError] = useState<string>('');

  const onSubmit = async (data: TPatient) => {
    setFormError('');

    if (!session?.user_id) {
      setFormError('Сессия еще не загрузилась. Попробуйте снова.');
      return;
    }

    const dataToSend = {
      ...data,
      user_id: session.user_id,
      first_name: data.first_name,
      last_name: data.last_name,
      middle_name: toEmptyIfEmpty(data.middle_name),
      iin: toNullIfEmpty(data.iin),
      date_of_birth: data.date_of_birth,
      address: toEmptyIfEmpty(data.address),
      phys_activity: toEmptyIfEmpty(data.phys_activity),
      gender: toEmptyIfEmpty(data.gender),
      diagnoses: toArray(data.diagnoses),
      allergens: toArray(data.allergens),
      diet: toArray(data.diet),
      height: Number(data.height) || 0,
      weight: Number(data.weight) || 0,
    };

    try {
      const updateResult = await updateProfile(session.user_id, dataToSend);

      if (!updateResult.success) {
        const errorMessage = updateResult.message || 'Ошибка при обновлении профиля';
        setFormError(formatErrorMessage('Ошибка регистрации', errorMessage));
        return;
      }

      // повторный логин здесь уже не нужен, пользователь и так авторизован
      router.push(`/${session.role}/profile`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
      setFormError(formatErrorMessage('Системная ошибка', errorMessage));
    }
  };

  if (!session?.user_id) {
    return (
      <div className="w-full max-w-md mx-auto mt-6 text-center text-gray-500">
        Выполняется вход...
      </div>
    );
  }

  return (
    <>
      {formError && (
        <ErrorMessage
          message={formError}
          variant="error"
          className="w-full max-w-md mx-auto mb-4"
          onClose={() => setFormError('')}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MyInput
          label="Имя"
          id="first_name"
          type="text"
          errors={errors.first_name}
          placeholder="Иван"
          {...register('first_name', {
            required: 'Введите имя',
            minLength: {
              value: 2,
              message: 'Имя должно содержать минимум 2 символа',
            },
            pattern: {
              value: /^[A-Za-zА-Яа-яёЁ]{2,}$/i,
              message: 'Неверный формат имени',
            },
          })}
        />

        <MyInput
          label="Фамилия"
          id="last_name"
          type="text"
          errors={errors.last_name}
          placeholder="Иванов"
          {...register('last_name', {
            required: 'Введите фамилию',
            minLength: {
              value: 2,
              message: 'Фамилия должна содержать минимум 2 символа',
            },
            pattern: {
              value: /^[A-Za-zА-Яа-яёЁ]{2,}$/i,
              message: 'Неверный формат фамилии',
            },
          })}
        />

        <MyInput
          label="Отчество*"
          id="middle_name"
          type="text"
          errors={errors.middle_name}
          placeholder="Иванович"
          {...register('middle_name', {
            required: 'Отчество обязательно для заполнения',
            pattern: {
              value: /^[A-Za-zА-Яа-яёЁ]{2,}$/i,
              message: 'Неверный формат отчества',
            },
          })}
        />

        <MyInput
          label="ИИН"
          id="iin"
          type="number"
          errors={errors.iin}
          placeholder="123456789012"
          {...register('iin', {
            minLength: {
              value: 12,
              message: 'ИИН должен содержать 12 символов',
            },
            maxLength: {
              value: 12,
              message: 'ИИН должен содержать 12 символов',
            },
            pattern: {
              value: /^[0-9]{12}$/,
              message: 'Неверный формат ИИН',
            },
          })}
        />

        <MyInput
          label="Дата рождения"
          id="date_of_birth"
          type="date"
          errors={errors.date_of_birth}
          placeholder="2000-01-01"
          {...register('date_of_birth', {
            required: 'Введите дату рождения',
          })}
        />

        <Controller
          name="gender"
          control={control}
          rules={{}}
          render={({ field }) => (
            <MySelect
              label="Пол"
              id="gender"
              options={gender}
              onChange={field.onChange}
              value={field.value}
              errors={errors.gender}
            />
          )}
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
          rules={{}}
          render={({ field }) => (
            <MySelect
              label="Уровень физ. активности"
              id="phys_activity"
              options={physActivity}
              onChange={field.onChange}
              value={field.value}
              errors={errors.phys_activity}
            />
          )}
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
              message: 'Вес должен быть от 20 до 300 кг',
            },
            max: {
              value: 300,
              message: 'Вес должен быть от 20 до 300 кг',
            },
          })}
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
              message: 'Рост должен быть от 50 до 250 см',
            },
            max: {
              value: 250,
              message: 'Рост должен быть от 50 до 250 см',
            },
          })}
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
          rules={{}}
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
          rules={{}}
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
            type="button"
            onClick={handleSubmit(onSubmit)}
            className="mt-3 py-2 text-xl mb-2 w-full text-white bg-primary hover:bg-primary/90"
          >
            Зарегистрироваться
          </MyButton>
        </div>
      </div>
    </>
  );
}