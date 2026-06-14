'use client'
import { useDoctor } from '@/hooks/doctor';
import React from 'react'

export default function DoctorInfo({ isDoctor, doctorId }: { isDoctor: boolean, doctorId: string }) {

    const { doctor, loading, error } = useDoctor(doctorId);
    if (loading) return <div className="text-gray-500">Загрузка данных врача...</div>;
    if (error) return <div className="text-red-500">Ошибка: {error}</div>;
    if (!doctor) return <div className="text-gray-500">Данные врача недоступны</div>;
    return (
        <div className="mt-6 p-4 bg-gray-50 rounded-xl">
            <h3 className="text-lg font-bold mb-2">Данные врача</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-base">
                <div><b>Фамилия:</b> {doctor.last_name}</div>
                <div><b>Имя:</b> {doctor.first_name}</div>
                <div><b>Отчество:</b> {doctor.middle_name || ''}</div>
                <div><b>Специализация:</b> {doctor.roles?.join(', ')}</div>
                {isDoctor && (
                    <>
                        <div><b>Email:</b> {doctor.email}</div>
                        <div><b>Телефон:</b> {doctor.phone}</div>
                    </>
                )}
                <div className="md:col-span-2"><b>Описание:</b> {doctor.description}</div>
            </div>
        </div>
    );
}