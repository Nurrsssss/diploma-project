'use client'
import React, { createContext, useContext, useState, ReactNode } from 'react';
import { TDoctor } from '@/types/doctors';

export type TAppointmentFormat = {
    format: string;
    date: string;
    time: string;
    platform?: string;
    slotId?: string;
    patient_notes?: string;
    duration_minutes?: number;
    slotTitle?: string;
    anketa_id?: string; // ID анкеты пациента
}

export type TAppointmentPayment = {
    payment: string;
    phoneNumber: string;
}

export interface IAppointmentPayment extends TAppointmentPayment {}

export type TAppointmentResult = {
    result: string;
    appointmentId: string;
    link?: string;
}

export interface AppointmentData {
    doctor: TDoctor | null;
    format: TAppointmentFormat;
    payment: TAppointmentPayment;
    result: TAppointmentResult;
}

interface IAppointmentContext extends AppointmentData {
    setDoctor: (doctor: TDoctor | null) => void;
    setFormat: (format: TAppointmentFormat | ((prev: TAppointmentFormat) => TAppointmentFormat)) => void;
    setPayment: (payment: TAppointmentPayment) => void;
    setResult: (result: TAppointmentResult) => void;
    reset: () => void;
}

const defaultFormat: TAppointmentFormat = {
    format: '',
    date: '',
    time: '',
    platform: '',
    slotId: '',
    patient_notes: '',
    duration_minutes: undefined,
    slotTitle: '',
};

const defaultPayment: TAppointmentPayment = {
    payment: 'Каспи',
    phoneNumber: '',
};

const defaultResult: TAppointmentResult = {
    result: '',
    appointmentId: '',
    link: '',
};

const AppointmentContext = createContext<IAppointmentContext | undefined>(undefined);

export function AppointmentProvider({ children }: { children: ReactNode }) {
    // ✅ Загружаем врача из sessionStorage при инициализации (безопаснее)
    const [doctor, setDoctorState] = useState<TDoctor | null>(() => {
        if (typeof window !== 'undefined') {
            const saved = sessionStorage.getItem('selectedDoctor');
            return saved ? JSON.parse(saved) : null;
        }
        return null;
    });
    const [format, setFormat] = useState<TAppointmentFormat>(defaultFormat);
    const [payment, setPayment] = useState<TAppointmentPayment>(defaultPayment);
    const [result, setResult] = useState<TAppointmentResult>(defaultResult);

    // ✅ Обертка для setDoctor с сохранением в sessionStorage (безопаснее)
    const setDoctor = (doctor: TDoctor | null) => {
        setDoctorState(doctor);
        if (typeof window !== 'undefined') {
            if (doctor) {
                sessionStorage.setItem('selectedDoctor', JSON.stringify(doctor));
            } else {
                sessionStorage.removeItem('selectedDoctor');
            }
        }
    };

    const reset = () => {
        setDoctor(null);
        setFormat(defaultFormat);
        setPayment(defaultPayment);
        setResult(defaultResult);
    };

    return (
        <AppointmentContext.Provider value={{
            doctor, setDoctor,
            format, setFormat,
            payment, setPayment,
            result, setResult,
            reset
        }}>
            {children}
        </AppointmentContext.Provider>
    );
}

export function useAppointment() {
    const ctx = useContext(AppointmentContext);
    if (!ctx) throw new Error('useAppointment must be used within AppointmentProvider');
    return ctx;
}