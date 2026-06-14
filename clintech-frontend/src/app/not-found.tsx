'use client'
import React from 'react';
import MyButton from '@/components/ui/MyButton';
import { useRouter } from 'next/navigation';

const NotFound: React.FC = () => {
    const router = useRouter();

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
            <div className="max-w-4xl mx-auto text-center">
                {/* Анимированное число 404 */}
                <div className="mb-8">
                    <h1 className="text-8xl md:text-9xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent animate-pulse">
                        404
                    </h1>
                    <div className="w-32 h-1 bg-gradient-to-r from-blue-500 to-purple-500 mx-auto mt-4 rounded-full"></div>
                </div>

                {/* Иконка и заголовок */}
                <div className="mb-8">
                    <h2 className="text-2xl md:text-3xl font-bold text-gray-800 mb-4">
                        Страница не найдена
                    </h2>
                    <p className="text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
                        Упс! Похоже, что страница, которую вы ищете, не существует.
                    </p>
                </div>

                {/* Кнопки действий */}
                <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
                    <MyButton
                        onClick={() => router.push('/')}
                        className="bg-primary hover:bg-primary/90 text-white font-semibold px-8 py-3 rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300 flex items-center gap-2"
                    >
                        Вернуться на главную
                    </MyButton>

                    <MyButton
                        onClick={() => router.back()}
                        className="bg-white border-2 border-gray-300 hover:border-gray-400 text-gray-700 font-semibold px-8 py-3 rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300 flex items-center gap-2"
                    >
                        Вернуться назад
                    </MyButton>
                </div>
            </div>
        </div>
    );
};

export default NotFound;