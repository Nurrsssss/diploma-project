'use client'
import { useState } from "react"
import PagesLayout from "@/components/layout/general/PagesLayout"
import Schedules from "@/components/doctor/appointments/schedule/common/Schedules"
import DrAppointments from "@/components/doctor/appointments/common/DrAppointments"
import PastAppointments from "@/components/doctor/appointments/pastAppointments/PastAppointments"
import DropdownTabs from "@/components/ui/DropdownTabs"
import { DCommonAppointmentsTabs } from "@/arrays/appointments/DCommonAppointmentsTabs"
import DoctorScheduleManager from "@/components/doctor/schedule/DoctorScheduleManager"

export default function MyAppointments() {
    const [activeTab, setActiveTab] = useState<string>('appointment')
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)



    return (
        <PagesLayout title="Мои приемы" isBackButton={true}>
            <div className="container">
                {/* Desktop Navigation */}
                <DropdownTabs tabs={DCommonAppointmentsTabs} activeTab={activeTab} setActiveTab={setActiveTab} isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} />

                {activeTab === 'appointment' && <DrAppointments />}
                {activeTab === 'past-appointments' && <PastAppointments />}
                {activeTab === 'schedule' && <Schedules />}
                {activeTab === 'schedule-management' && <DoctorScheduleManager />}

            </div>

        </PagesLayout >
    )
}
