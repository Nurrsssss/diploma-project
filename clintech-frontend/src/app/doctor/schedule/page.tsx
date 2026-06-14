'use client';

import React from 'react';
import PagesLayout from '@/components/layout/general/PagesLayout';
import DoctorScheduleManager from '@/components/doctor/schedule/DoctorScheduleManager';

export default function DoctorSchedulePage() {
    return (
        <PagesLayout title="Управление расписанием" isBackButton={true}>
            <div className="container">
                <DoctorScheduleManager />
            </div>
        </PagesLayout>
    );
}
