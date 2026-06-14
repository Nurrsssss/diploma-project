'use client';

import { useForm } from 'react-hook-form';
import { useAuth } from '@/context/AuthContext';
import { useRegister } from '@/hooks/auth/useRegister';
import MyInput from '../ui/MyInput';
import MyButton from '../ui/MyButton';
import PhoneInput from '../ui/PhoneInput';
import Link from 'next/link';
import Image from 'next/image';
import React, { useState } from 'react';
import RegisterPatient from './RegisterPatient';
import type { IRegisterCredentials } from '@/hooks/auth/useRegister';

interface IRegisterFirstStepProps {
  password: string;
  confirmPassword: string;
  phone: string;
}

export default function RegisterForm() {
  const { login, session } = useAuth();
  const { register: registerUser } = useRegister();

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<IRegisterFirstStepProps>({
    defaultValues: {
      phone: '',
      password: '',
      confirmPassword: '',
    },
    mode: 'onBlur',
  });

  const [step, setStep] = useState<number>(1);
  const [formError, setFormError] = useState<string>('');
  const [registrationData, setRegistrationData] = useState<IRegisterCredentials | null>(null);

  const onSubmit = async (data: IRegisterFirstStepProps) => {
    setFormError('');

    const { confirmPassword, ...dataToSend } = data;

    const cleanPhone = dataToSend.phone.replace(/\D/g, '');
    const cleanDataToSend: IRegisterCredentials = {
      ...dataToSend,
      role: 'patient',
      phone: cleanPhone,
    };

    setRegistrationData(cleanDataToSend);

    try {
      const registerResult = await registerUser(cleanDataToSend);

      if (!registerResult.success) {
        setFormError(registerResult.message || 'Ошибка при регистрации');
        return;
      }

      const loginResult = await login({
        phone: cleanDataToSend.phone,
        password: cleanDataToSend.password,
      });

      if (!loginResult.success) {
        setFormError(
          loginResult.message || 'Ошибка входа после регистрации. Попробуйте войти вручную.'
        );
        return;
      }

      setStep(2);
    } catch (error: any) {
      setFormError('Неожиданная ошибка. Попробуйте еще раз.');
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="max-h-[95vh] md:max-h-[90vh] h-full xs:w-3/4 md:w-full flex flex-col justify-center gap-4 mx-auto p-2 xs:p-3 sm:p-4 lg:p-8 2xl:p-10 overflow-y-auto hide-scrollbar"
    >
      <div className="overflow-y-auto hide-scrollbar">
        <div className="flex flex-col items-center gap-2">
          <Link href="/">
            <Image src="/image/logo.svg" alt="register" width={70} height={70} className="mx-auto" />
            <p className="font-sans mt-2 text-xl font-bold">Clintech</p>
          </Link>
          <p className="text-center font-sans text-[27px] font-semibold text-gray-500">Регистрация</p>
        </div>

        <div className="flex items-center gap-4 justify-center my-4 font-semibold text-white text-2xl">
          <div
            className={`w-[60px] h-[60px] flex items-center justify-center rounded-full gap-2 ${
              step === 1 ? 'bg-step-circle' : 'bg-gray-300'
            }`}
          >
            1
          </div>
          <div
            className={`w-[60px] h-[60px] flex items-center justify-center rounded-full gap-2 ${
              step === 2 ? 'bg-step-circle' : 'bg-gray-300'
            }`}
          >
            2
          </div>
        </div>

        {step === 1 && (
          <>
            <div className="w-full my-6 rounded-xl border border-purple-200 bg-purple-50 px-4 py-5 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white">
                <Image
                  src="/image/register/register-man.svg"
                  alt="patient"
                  width={32}
                  height={32}
                />
              </div>
              <p className="font-sans text-lg font-semibold text-gray-900">Регистрация пациента</p>
              <p className="mt-1 text-sm text-gray-600">
                Создание аккаунта доступно только для пациента
              </p>
            </div>

            <PhoneInput
              className="mb-2"
              label="Номер телефона"
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
                },
              })}
            />

            <MyInput
              className="mb-2"
              label="Пароль"
              id="password"
              type="password"
              errors={errors.password}
              placeholder="Введите пароль"
              {...register('password', {
                required: 'Введите пароль',
                minLength: {
                  value: 8,
                  message: 'Пароль должен содержать минимум 8 символов',
                },
              })}
            />

            <MyInput
              className="mb-2"
              label="Подтвердите пароль"
              id="confirmPassword"
              type="password"
              errors={errors.confirmPassword}
              placeholder="Введите пароль ещё раз"
              {...register('confirmPassword', {
                required: 'Введите пароль',
                validate: (value) => {
                  if (value !== getValues('password')) {
                    return 'Пароли не совпадают';
                  }
                  return true;
                },
              })}
            />

            {formError && (
              <div className="w-full max-w-md mx-auto mb-4 p-3 flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg justify-center text-center">
                {formError}
              </div>
            )}

            <MyButton
              type="submit"
              className="mt-3 text-xl mb-2 w-full text-white bg-primary hover:bg-primary/90"
            >
              Зарегистрироваться
            </MyButton>
          </>
        )}

        {step === 2 && registrationData && !session?.user_id && (
          <div className="w-full max-w-md mx-auto mt-6 text-center text-gray-500">
            Выполняется вход...
          </div>
        )}

        {step === 2 && registrationData && session?.user_id && (
          <RegisterPatient
            passwordData={registrationData.password}
            phoneData={registrationData.phone}
          />
        )}

        <p className="text-center">
          Уже есть аккаунт?{' '}
          <Link className="text-violet-600 hover:underline" href="/login">
            Войти
          </Link>
        </p>
      </div>
    </form>
  );
}