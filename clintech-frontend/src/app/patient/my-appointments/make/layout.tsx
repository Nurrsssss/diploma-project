import { AppointmentProvider } from '@/context/AppointmentContext'
import React from 'react'

export default function MakeAppointmentLayout({ children }: { children: React.ReactNode }) {
    return (
        <AppointmentProvider>
            {children}
        </AppointmentProvider>
    )
}
