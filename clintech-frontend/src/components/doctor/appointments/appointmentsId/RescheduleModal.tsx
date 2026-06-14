// 'use client';

// import React, { useState, useEffect } from 'react';
// import { X, Calendar, Clock, RefreshCw } from 'lucide-react';
// import { useForm } from 'react-hook-form';
// import { useAppointmentReschedule, AvailableSlot } from '@/hooks/appointment/useAppointmentReschedule';
// import MyButton from '@/components/ui/MyButton';
// import MyInput from '@/components/ui/MyInput';
// import ErrorMessage from '@/components/ui/ErrorMessage';

// interface RescheduleModalProps {
//   isOpen: boolean;
//   onClose: () => void;
//   onSuccess: () => void;
//   appointmentId: string;
//   /** users.id врача */
//   doctorUserId: string;
//   currentStartTime: string;
//   currentEndTime: string;
// }

// interface FormData {
//   date: string;
//   target_slot_id: string;
//   reason: string;
// }

// const RescheduleModal: React.FC<RescheduleModalProps> = ({
//   isOpen,
//   onClose,
//   onSuccess,
//   appointmentId,
//   doctorUserId,
//   currentStartTime,
//   currentEndTime
// }) => {
//   const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);

//   const {
//     availableSlots,
//     loading,
//     rescheduleLoading,
//     error,
//     fetchAvailableSlots,
//     rescheduleAppointment,
//     clearError
//   } = useAppointmentReschedule();

//   const {
//     register,
//     handleSubmit,
//     watch,
//     reset,
//     setValue,
//     formState: { errors }
//   } = useForm<FormData>({
//     defaultValues: {
//       date: new Date().toISOString().split('T')[0],
//       target_slot_id: '',
//       reason: ''
//     }
//   });

//   const watchDate = watch('date');

//   // Грузим слоты при изменении даты/открытии
//   useEffect(() => {
//     if (watchDate && doctorUserId && isOpen) {
//       setSelectedSlot(null);
//       setValue('target_slot_id', '');
//       fetchAvailableSlots(doctorUserId, watchDate);
//     }
//   }, [watchDate, doctorUserId, isOpen, fetchAvailableSlots, setValue]);

//   // Инициализация даты при открытии
//   // useEffect(() => {
//   //   if (isOpen) {
//   //     const d = new Date().toISOString().split('T')[0];
//   //     setValue('date', d);
//   //   }
//   // }, [isOpen, setValue]);
// useEffect(() => {
//   if (isOpen) {
//     const d = new Date().toLocaleDateString('en-CA', {
//       timeZone: 'Asia/Almaty',
//     });
//     setValue('date', d);
//   }
// }, [isOpen, setValue]);


//   const onSubmit = async (data: FormData) => {
//     if (!selectedSlot) return;

//     clearError();
//     const ok = await rescheduleAppointment(appointmentId, {
//       target_slot_id: data.target_slot_id,
//       reason: data.reason
//     });
//     if (ok) {
//       reset();
//       setSelectedSlot(null);
//       onSuccess();
//     }
//   };

//   const handleClose = () => {
//     reset();
//     setSelectedSlot(null);
//     clearError();
//     onClose();
//   };

//   const handleSlotSelect = (slot: AvailableSlot) => {
//     setSelectedSlot(slot);
//     setValue('target_slot_id', slot.id);
//   };

//   const formatTime = (iso: string) => iso.split('T')[1]?.substring(0, 5) || '';
//   const formatDateLong = (yyyyMMdd: string) =>
//     new Date(yyyyMMdd).toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });

//   if (!isOpen) return null;

//   return (
//     <div className="fixed inset-0 z-50 flex items-center justify-center">
//       <div className="absolute inset-0 bg-black bg-opacity-50" onClick={handleClose} />
//       <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
//         <div className="p-6">
//           {/* Header */}
//           <div className="flex items-center justify-between mb-6">
//             <div>
//               <h2 className="text-xl font-bold text-gray-900 flex items-center">
//                 <RefreshCw className="w-5 h-5 mr-2" />
//                 Перенос приема
//               </h2>
//               <p className="text-sm text-gray-600 mt-1">
//                 Текущее время: {formatTime(currentStartTime)} — {formatTime(currentEndTime)}
//               </p>
//             </div>
//             <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
//               <X className="h-6 w-6" />
//             </button>
//           </div>

//           {/* Error */}
//           {error && (
//             <ErrorMessage message={error} variant="error" onClose={clearError} className="mb-4" />
//           )}

//           <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
//             {/* Дата */}
//             <div>
//               <MyInput
//                 label="Выберите дату для переноса"
//                 type="date"
//                 min={new Date().toISOString().split('T')[0]}
//                 errors={errors.date}
//                 {...register('date', { required: 'Выберите дату' })}
//               />
//             </div>

//             {/* Слоты */}
//             <div>
//               <label className="block text-sm font-medium text-gray-700 mb-3">
//                 Доступные слоты на {formatDateLong(watchDate)}
//               </label>

//               {loading ? (
//                 <div className="flex items-center justify-center py-8">
//                   <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
//                   <span className="ml-2 text-gray-600">Загрузка слотов...</span>
//                 </div>
//               ) : availableSlots.length === 0 ? (
//                 <div className="text-center py-8 text-gray-500">
//                   <Calendar className="mx-auto h-12 w-12 text-gray-400 mb-2" />
//                   <p>На выбранную дату нет свободных слотов</p>
//                   <p className="text-sm">Попробуйте выбрать другую дату</p>
//                 </div>
//               ) : (
//                 <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
//                   {availableSlots.map((slot) => (
//                     <label
//                       key={slot.id}
//                       className={`flex items-center p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${
//                         selectedSlot?.id === slot.id ? 'bg-primary/5 border-primary' : ''
//                       }`}
//                     >
//                       <input
//                         type="radio"
//                         name="slot"
//                         value={slot.id}
//                         checked={selectedSlot?.id === slot.id}
//                         onChange={() => handleSlotSelect(slot)}
//                         className="sr-only"
//                       />
//                       <div className="flex-1">
//                         <div className="flex items-center space-x-3">
//                           <Clock className="w-4 h-4 text-gray-500" />
//                           <span className="font-medium">
//                             {formatTime(slot.start_time)} — {formatTime(slot.end_time)}
//                           </span>
//                           <span className="text-sm text-gray-500">({slot.duration_minutes} мин)</span>
//                         </div>
//                         <div className="mt-1 text-sm text-gray-600">
//                           {slot.title} • {slot.appointment_type === 'online' ? 'Онлайн' : 'Оффлайн'}
//                         </div>
//                       </div>
//                       <div
//                         className={`w-4 h-4 rounded-full border-2 ${
//                           selectedSlot?.id === slot.id ? 'border-primary bg-primary' : 'border-gray-300'
//                         }`}
//                       >
//                         {selectedSlot?.id === slot.id && (
//                           <div className="w-2 h-2 bg-white rounded-full mx-auto mt-0.5" />
//                         )}
//                       </div>
//                     </label>
//                   ))}
//                 </div>
//               )}
//             </div>

//             {/* Причина */}
//             <MyInput
//               label="Причина переноса (необязательно)"
//               placeholder="Например: перенос по рабочим причинам"
//               errors={errors.reason}
//               {...register('reason')}
//             />

//             {/* Кнопки */}
//             <div className="flex space-x-3 pt-4">
//               <MyButton type="button" onClick={handleClose} className="flex-1" disabled={rescheduleLoading}>
//                 Отмена
//               </MyButton>
//               <MyButton
//                 type="submit"
//                 disabled={rescheduleLoading || !selectedSlot}
//                 className="flex-1 bg-primary hover:bg-primary/90 text-white"
//               >
//                 {rescheduleLoading ? 'Перенос...' : 'Перенести'}
//               </MyButton>
//             </div>
//           </form>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default RescheduleModal;
'use client';

import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, RefreshCw } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useAppointmentReschedule, AvailableSlot } from '@/hooks/appointment/useAppointmentReschedule';
import MyButton from '@/components/ui/MyButton';
import MyInput from '@/components/ui/MyInput';
import ErrorMessage from '@/components/ui/ErrorMessage';

interface RescheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  appointmentId: string;
  /** users.id врача */
  doctorUserId: string;
  currentStartTime: string;
  currentEndTime: string;
}

interface FormData {
  date: string;
  target_slot_id: string;
  reason: string;
}

const ALMATY_TIME_ZONE = 'Asia/Almaty';

function formatDateForInputAlmaty(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ALMATY_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function parseToUtcMsStable(s: string): number {
  if (!s) return NaN;

  const hasTz = /([zZ]|[+\-]\d{2}:?\d{2})$/.test(s);
  if (!hasTz) {
    const isoNoTz = s.includes('T') ? s : s.replace(' ', 'T');
    return Date.parse(isoNoTz.endsWith('Z') ? isoNoTz : `${isoNoTz}Z`);
  }

  const normalized = s.includes(' ') && !s.includes('T') ? s.replace(' ', 'T') : s;
  return Date.parse(normalized);
}

function formatTimeAlmaty(iso: string): string {
  const ms = parseToUtcMsStable(iso);
  if (!Number.isFinite(ms)) return '';

  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: ALMATY_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(ms));
}

function formatDateLongAlmaty(yyyyMMdd: string): string {
  if (!yyyyMMdd) return '';

  const [y, m, d] = yyyyMMdd.split('-').map(Number);
  if (!y || !m || !d) return yyyyMMdd;

  const utcDate = new Date(Date.UTC(y, m - 1, d));

  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: ALMATY_TIME_ZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(utcDate);
}

const RescheduleModal: React.FC<RescheduleModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  appointmentId,
  doctorUserId,
  currentStartTime,
  currentEndTime,
}) => {
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);

  const {
    availableSlots,
    loading,
    rescheduleLoading,
    error,
    fetchAvailableSlots,
    rescheduleAppointment,
    clearError,
  } = useAppointmentReschedule();

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      date: formatDateForInputAlmaty(),
      target_slot_id: '',
      reason: '',
    },
  });

  const watchDate = watch('date');

  useEffect(() => {
    if (watchDate && doctorUserId && isOpen) {
      setSelectedSlot(null);
      setValue('target_slot_id', '');
      fetchAvailableSlots(doctorUserId, watchDate);
    }
  }, [watchDate, doctorUserId, isOpen, fetchAvailableSlots, setValue]);

  useEffect(() => {
    if (isOpen) {
      setValue('date', formatDateForInputAlmaty());
    }
  }, [isOpen, setValue]);

  const onSubmit = async (data: FormData) => {
    if (!selectedSlot) return;

    clearError();

    const ok = await rescheduleAppointment(appointmentId, {
      target_slot_id: data.target_slot_id,
      reason: data.reason,
    });

    if (ok) {
      reset({
        date: formatDateForInputAlmaty(),
        target_slot_id: '',
        reason: '',
      });
      setSelectedSlot(null);
      onSuccess();
    }
  };

  const handleClose = () => {
    reset({
      date: formatDateForInputAlmaty(),
      target_slot_id: '',
      reason: '',
    });
    setSelectedSlot(null);
    clearError();
    onClose();
  };

  const handleSlotSelect = (slot: AvailableSlot) => {
    setSelectedSlot(slot);
    setValue('target_slot_id', slot.id);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={handleClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900 flex items-center">
                <RefreshCw className="w-5 h-5 mr-2" />
                Перенос приема
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Текущее время: {formatTimeAlmaty(currentStartTime)} — {formatTimeAlmaty(currentEndTime)}
              </p>
            </div>

            <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
              <X className="h-6 w-6" />
            </button>
          </div>

          {error && (
            <ErrorMessage message={error} variant="error" onClose={clearError} className="mb-4" />
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <MyInput
                label="Выберите дату для переноса"
                type="date"
                min={formatDateForInputAlmaty()}
                errors={errors.date}
                {...register('date', { required: 'Выберите дату' })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Доступные слоты на {formatDateLongAlmaty(watchDate)}
              </label>

              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                  <span className="ml-2 text-gray-600">Загрузка слотов...</span>
                </div>
              ) : availableSlots.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Calendar className="mx-auto h-12 w-12 text-gray-400 mb-2" />
                  <p>На выбранную дату нет свободных слотов</p>
                  <p className="text-sm">Попробуйте выбрать другую дату</p>
                </div>
              ) : (
                <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
                  {availableSlots.map((slot) => (
                    <label
                      key={slot.id}
                      className={`flex items-center p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${
                        selectedSlot?.id === slot.id ? 'bg-primary/5 border-primary' : ''
                      }`}
                    >
                      <input
                        type="radio"
                        name="slot"
                        value={slot.id}
                        checked={selectedSlot?.id === slot.id}
                        onChange={() => handleSlotSelect(slot)}
                        className="sr-only"
                      />

                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <Clock className="w-4 h-4 text-gray-500" />
                          <span className="font-medium">
                            {formatTimeAlmaty(slot.start_time)} — {formatTimeAlmaty(slot.end_time)}
                          </span>
                          <span className="text-sm text-gray-500">({slot.duration_minutes} мин)</span>
                        </div>

                        <div className="mt-1 text-sm text-gray-600">
                          {slot.title} • {slot.appointment_type === 'online' ? 'Онлайн' : 'Оффлайн'}
                        </div>
                      </div>

                      <div
                        className={`w-4 h-4 rounded-full border-2 ${
                          selectedSlot?.id === slot.id ? 'border-primary bg-primary' : 'border-gray-300'
                        }`}
                      >
                        {selectedSlot?.id === slot.id && (
                          <div className="w-2 h-2 bg-white rounded-full mx-auto mt-0.5" />
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <MyInput
              label="Причина переноса (необязательно)"
              placeholder="Например: перенос по рабочим причинам"
              errors={errors.reason}
              {...register('reason')}
            />

            <div className="flex space-x-3 pt-4">
              <MyButton type="button" onClick={handleClose} className="flex-1" disabled={rescheduleLoading}>
                Отмена
              </MyButton>

              <MyButton
                type="submit"
                disabled={rescheduleLoading || !selectedSlot}
                className="flex-1 bg-primary hover:bg-primary/90 text-white"
              >
                {rescheduleLoading ? 'Перенос...' : 'Перенести'}
              </MyButton>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default RescheduleModal;