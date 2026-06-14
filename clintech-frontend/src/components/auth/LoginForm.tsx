'use client'
import React from 'react'
import { useForm } from 'react-hook-form'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import MyButton from '@/components/ui/MyButton'
import MyInput from '@/components/ui/MyInput'
import PhoneInput from '@/components/ui/PhoneInput'
import { AuthError } from '@/components/auth/AuthError'
import { useLogin, ILoginCredentials } from '@/hooks/auth/useLogin'
import { useAuth } from '@/context/AuthContext'

export default function LoginForm() {
    const { login, loading, error, clearError } = useLogin();
    const { validateSession } = useAuth();
    const router = useRouter();
    const { register, handleSubmit, formState: { errors } } = useForm<ILoginCredentials>();

    const normalizePhone = (raw: string) => {
        const digits = (raw || "").replace(/\D/g, "");

        // identity_service хранит и ищет телефон в формате только цифр
        if (digits.length === 11 && digits.startsWith("7")) return digits;

        if (digits.length === 11 && digits.startsWith("8")) return `7${digits.slice(1)}`;

        return digits || raw.trim();
      };
      
      const onSubmit = async (data: ILoginCredentials) => {
        clearError();
      
        try {
          const cleanData = {
            ...data,
            phone: normalizePhone(data.phone),
          };
      
          const result = await login(cleanData);
      
          if (result.success && result.role) {
  const sessionValid = await validateSession();
  if (sessionValid) {
    const roleHome: Record<string, string> = {
      patient: '/',
      doctor: '/',
      reception: '/', // ✅ важно
      admin: '/',
    };

    router.replace(roleHome[result.role] ?? '/');
  }
}
        } catch (error) {}
      };
      

    return (
        <form
            onSubmit={handleSubmit(onSubmit)}
            className="max-h-[95vh] md:max-h-[90vh] h-[100%] xs:w-3/4 md:w-full flex flex-col justify-center gap-4 mx-auto p-2 xs:p-3 sm:p-4 lg:p-8 2xl:p-10 rounded-lg overflow-y-auto"
        >
            {/* Header */}
            <div className='flex flex-col items-center gap-2'>
                <Link href='/'>
                    <Image
                        src='/image/logo.svg'
                        alt='ClintechAI Logo'
                        width={70}
                        height={70}
                        className='mx-auto'
                    />
                    <p className='font-sans mt-2 text-xl font-bold'>Clintech</p>
                </Link>
                <p className='font-sans lg:w-3/4 text-center text-md font-normal text-gray-500'>
                    Безопасная медицинская платформа
                </p>
            </div>

            {/* Error Display */}
            <AuthError error={error} />

            {/* Phone Input */}
            <PhoneInput
                label="Номер телефона"
                id="phone"
                placeholder="+7-(777)-777-77-77"
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

            {/* Password Input */}
            <MyInput
                label="Пароль"
                id="password"
                type="password"
                placeholder="123456a!"
                errors={errors.password}
                {...register('password', {
                    required: 'Введите пароль',
                    minLength: {
                        value: 8,
                        message: 'Пароль должен содержать минимум 8 символов'
                    }
                })}
            />

            {/* Submit Button */}
            <MyButton
                type="submit"
                disabled={loading}
                className="text-xl text-white font-normal font-sans bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {loading ? 'Вход...' : 'Войти'}
            </MyButton>

            {/* Registration Link */}
            <p className='text-center'>
                Нет аккаунта? {' '}
                <Link className='text-violet-600 hover:underline' href="/register">
                    Зарегистрироваться
                </Link>
            </p>
        </form>
    )
} 