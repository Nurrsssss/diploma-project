'use client';

import React from 'react';
import PagesLayout from '@/components/layout/general/PagesLayout';
import CreatePatientForm from '@/components/doctor/create-patient/CreatePatientForm';

export default function CreatePatientPage() {
    return (
        <PagesLayout title="Создать пациента" isBackButton={true}>
            <div className="container">
                <CreatePatientForm />
            </div>
        </PagesLayout>
    );
}

