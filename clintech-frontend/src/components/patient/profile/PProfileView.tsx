import React from 'react';
import { TPatient } from '@/types/patient';
import PProfileGeneral from './PProfileGeneral';
import PProfileMed from './PProfileMed';



const PatientProfileView = ({ patient }: { patient: TPatient }) => {


  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Персональная информация */}
      <PProfileGeneral patient={patient} />

      {/* Медицинская информация */}
      <PProfileMed patient={patient} />
    </div>
  );
};

export default PatientProfileView; 