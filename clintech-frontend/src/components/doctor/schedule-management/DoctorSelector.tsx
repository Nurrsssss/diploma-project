// 'use client'
// import { TDoctor } from '@/types/doctors';
// import Image from 'next/image';
// import CompactDoctorPicker from '@/components/doctor/schedule-management/CompactDoctorPicker';


// const ALL_DOCTORS_ID = '__ALL_DOCTORS__';

// interface DoctorSelectorProps {
//     doctors: TDoctor[];
//     selectedDoctorId: string | null;
//     onSelectDoctor: (doctorId: string) => void;
// }

// export const DoctorSelector = ({ doctors, selectedDoctorId, onSelectDoctor }: DoctorSelectorProps) => {
//     return (
//         <div className="bg-white rounded-xl shadow-sm overflow-hidden">
//             <div className="p-4 border-b border-gray-200">
//                 <h2 className="text-lg font-semibold text-gray-900">Список врачей</h2>
//                 <p className="text-sm text-gray-600 mt-1">Выберите врача для просмотра графика</p>
//             </div>
            
//             <div className="divide-y divide-gray-200 max-h-[calc(100vh-300px)] overflow-y-auto">
//                 {doctors.map((doctor) => (
//                     <button
//                         key={doctor.id}
//                         onClick={() => onSelectDoctor(doctor.id)}
//                         className={`w-full p-4 text-left transition-colors hover:bg-gray-50 ${
//                             selectedDoctorId === doctor.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
//                         }`}
//                     >
//                         <div className="flex items-center gap-3">
//                             <div className="relative w-12 h-12 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
//                                 {doctor.avatar_url ? (
//                                     <Image
//                                         src={doctor.avatar_url}
//                                         alt={`${doctor.first_name} ${doctor.last_name}`}
//                                         fill
//                                         className="object-cover"
//                                     />
//                                 ) : (
//                                     <div className="w-full h-full flex items-center justify-center bg-blue-500 text-white font-semibold">
//                                         {doctor.first_name?.[0]}{doctor.last_name?.[0]}
//                                     </div>
//                                 )}
//                             </div>
                            
//                             <div className="flex-1 min-w-0">
//                                 <p className="font-medium text-gray-900 truncate">
//                                     {doctor.last_name} {doctor.first_name} {doctor.middle_name}
//                                 </p>
//                                 {doctor.roles && doctor.roles.length > 0 && (
//                                     <p className="text-sm text-gray-600 truncate">
//                                         {doctor.roles.join(', ')}
//                                     </p>
//                                 )}
//                             </div>
                            
//                             {selectedDoctorId === doctor.id && (
//                                 <svg
//                                     className="w-5 h-5 text-blue-500 flex-shrink-0"
//                                     fill="currentColor"
//                                     viewBox="0 0 20 20"
//                                 >
//                                     <path
//                                         fillRule="evenodd"
//                                         d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
//                                         clipRule="evenodd"
//                                     />
//                                 </svg>
//                             )}
//                         </div>
//                     </button>
//                 ))}
//             </div>
            
//             {doctors.length === 0 && (
//                 <div className="p-8 text-center text-gray-500">
//                     <p>Врачи не найдены</p>
//                 </div>
//             )}
//         </div>
//     );
// };

'use client';

import React from 'react';
import Image from 'next/image';

import { TDoctor } from '@/types/doctors';

interface DoctorSelectorProps {
  doctors: TDoctor[];
  selectedDoctorId: string; // '__ALL_DOCTORS__' или конкретный id
  allDoctorsId: string; // '__ALL_DOCTORS__'
  onSelectDoctor: (doctorId: string) => void;
}

export const DoctorSelector = ({ doctors, selectedDoctorId, allDoctorsId, onSelectDoctor }: DoctorSelectorProps) => {
  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Фильтр врачей</h2>
        <p className="text-sm text-gray-600 mt-1">Выберите врача или “Все врачи”</p>
      </div>

      <div className="divide-y divide-gray-200 max-h-[calc(100vh-300px)] overflow-y-auto">
        {/* ✅ Все врачи */}
        <button
          onClick={() => onSelectDoctor(allDoctorsId)}
          className={`w-full p-4 text-left transition-colors hover:bg-gray-50 ${
            selectedDoctorId === allDoctorsId ? 'bg-blue-50 border-l-4 border-blue-500' : ''
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="relative w-12 h-12 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
              <div className="w-full h-full flex items-center justify-center bg-blue-500 text-white font-semibold">
                ALL
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 truncate">Все врачи</p>
              <p className="text-sm text-gray-600 truncate">Показать записи всех врачей</p>
            </div>

            {selectedDoctorId === allDoctorsId && (
              <svg className="w-5 h-5 text-blue-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </div>
        </button>

        {/* ✅ Список врачей */}
        {doctors.map((doctor: any) => {
          const did = String(doctor?.id ?? '');
          const isSelected = String(selectedDoctorId) === did;

          return (
            <button
              key={did}
              onClick={() => onSelectDoctor(did)}
              className={`w-full p-4 text-left transition-colors hover:bg-gray-50 ${
                isSelected ? 'bg-blue-50 border-l-4 border-blue-500' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="relative w-12 h-12 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
                  {doctor.avatar_url ? (
                    <Image
                      src={doctor.avatar_url}
                      alt={`${doctor.first_name ?? ''} ${doctor.last_name ?? ''}`}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-blue-500 text-white font-semibold">
                      {(doctor.first_name?.[0] ?? '') + (doctor.last_name?.[0] ?? '')}
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">
                    {doctor.last_name} {doctor.first_name} {doctor.middle_name}
                  </p>
                  {doctor.roles && doctor.roles.length > 0 && (
                    <p className="text-sm text-gray-600 truncate">{doctor.roles.join(', ')}</p>
                  )}
                </div>

                {isSelected && (
                  <svg className="w-5 h-5 text-blue-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {doctors.length === 0 && (
        <div className="p-8 text-center text-gray-500">
          <p>Врачи не найдены</p>
        </div>
      )}
    </div>
  );
};