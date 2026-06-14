'use client';

import React, { useEffect, useMemo, useState } from 'react';

import { TDoctor } from '@/types/doctors';
import { TPatient } from '@/types/patient';

import { DoctorSelector } from './DoctorSelector';
import { DoctorScheduleViewer } from './DoctorScheduleViewer';

const ALL_DOCTORS_ID = '__ALL_DOCTORS__';

type Props = {
  doctorUserId: string;
  doctors: TDoctor[];
  patients: TPatient[];
};

export default function DoctorSchedulePage({ doctorUserId, doctors, patients }: Props) {
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>(ALL_DOCTORS_ID);

  useEffect(() => {
    setSelectedDoctorId(ALL_DOCTORS_ID);
  }, []);

  const doctorsUsable = useMemo(
    () => (doctors ?? []).filter((d: any) => String(d?.id ?? '').trim().length > 0),
    [doctors]
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4">
      <DoctorSelector
        doctors={doctorsUsable}
        selectedDoctorId={selectedDoctorId}
        allDoctorsId={ALL_DOCTORS_ID}
        onSelectDoctor={(doctorId) => setSelectedDoctorId(String(doctorId))}
      />

      <DoctorScheduleViewer
        doctorUserId={doctorUserId}
        doctors={doctorsUsable}
        patients={patients}
        selectedDoctorId={selectedDoctorId}
        allDoctorsId={ALL_DOCTORS_ID}
      />
    </div>
  );
}