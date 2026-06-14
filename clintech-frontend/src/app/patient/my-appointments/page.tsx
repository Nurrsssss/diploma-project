'use client'

import PagesLayout from "@/components/layout/general/PagesLayout";
import React, { useState } from 'react'
import AllAppointments from '@/components/patient/appointments/AllAppointments'
import PQuestionnaires from '@/components/patient/appointments/PQuestionnaires'
import DropdownTabs from "@/components/ui/DropdownTabs";
import { PCommonAppointmentsTabs } from "@/arrays/appointments/PCommonAppointmentsTabs";
import EmptyState from "@/components/ui/HideTabContent";
import NoContent from "@/components/ui/NoContent";
import { FaEyeSlash } from "react-icons/fa";

export default function MyAppointmentsPage() {
    const [activeTab, setActiveTab] = useState<string>('appointment')
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

    return (
        <PagesLayout title="Мои приёмы" isBackButton={true}>

            <div className='container'>
                <DropdownTabs tabs={PCommonAppointmentsTabs} activeTab={activeTab} setActiveTab={setActiveTab} isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} />

                {activeTab === 'appointment' && <AllAppointments />}

                {activeTab === 'my-analyses' && <PQuestionnaires />}

                {activeTab === 'make-appointment' && (
                    <div className="mt-4">
                        <NoContent
                            title="Записаться на приём"
                            description="Перейдите к выбору врача и удобного времени."
                            button="Перейти к записи"
                            href="/patient/my-appointments/make"
                        />
                    </div>
                )}

                {activeTab === 'hide' && (
                    <EmptyState
                        title="Вкладки скрыты"
                        description="Вы скрыли все вкладки. Пожалуйста, выберите вкладку выше для просмотра контента."
                        icon={<FaEyeSlash />}
                        actionText="Показать приёмы"
                        onAction={() => setActiveTab('appointment')}
                    />
                )}

            </div >
        </PagesLayout>
    )
}