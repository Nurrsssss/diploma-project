'use client';

import CreatePatientForm from '@/components/doctor/create-patient/CreatePatientForm';

export default function ReceptionCreatePatientPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h1 className="text-2xl font-bold text-gray-900">Создать пациента</h1>
          <div className="mt-6">
            <CreatePatientForm />
          </div>
        </div>
      </div>
    </div>
  );
}
