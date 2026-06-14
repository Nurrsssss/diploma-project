// import { QuestionDisplay } from "@/components/doctor/appointments/appointmentsId/QuestionDisplay";
// import MyButton from '@/components/ui/MyButton'
// import React, { useState } from 'react'
// import { useCompleteAppointment } from '@/hooks/appointment/useCompleteAppointment'
// import { useAuth } from '@/context/AuthContext'
// import { PatientQuestionnaire } from '@/hooks/files/useQuestionnaires'
// import { useHealthPassportById } from '@/hooks/files/useHealthPassportById'
// import { useHealthPassport } from '@/hooks/files/useHealthPassport'
// import HealthQuestionnaireModal from './HealthQuestionnaireModal'

// import TranscriptionDisplay from './TranscriptionDisplay'
// import { useAppointmentTranscription } from '@/hooks/appointment/useAppointmentTranscription'

// interface IAppointmentToggleProps {
//     isStarted: boolean
//     startStopAppointment: () => void
//     appointmentId: string
//     dialogue: string
//     setDialogue: (value: string) => void
//     analysisId?: string | null
//     analysisData?: PatientQuestionnaire | null
//     onAppointmentUpdated?: () => void
//     appointmentStatus?: string
//     healthPassportId?: string
// }

// export default function AppointmentToggle({
//     isStarted,
//     startStopAppointment,
//     appointmentId,
//     dialogue,
//     setDialogue,
//     analysisId,
//     analysisData,
//     onAppointmentUpdated,
//     appointmentStatus,
//     healthPassportId
// }: IAppointmentToggleProps) {
//     const { session } = useAuth();
//     const { completeAppointment, loading: isCompleting, error } = useCompleteAppointment();
//     const { generatePassport, isGenerating: isGeneratingPassport, error: passportError, passport: generatedPassport } = useHealthPassport();
    
//     // Проверяем завершен ли прием
//     const isAppointmentCompleted = appointmentStatus && 
//         ['completed', 'finished', 'завершено', 'завершён', 'завершен'].includes(appointmentStatus.toLowerCase());
    

    
//     // Получаем данные паспорта здоровья для завершенных приемов
//     const { passport, loading: passportLoading } = useHealthPassportById(
//         healthPassportId && isAppointmentCompleted ? healthPassportId : null
//     );

//     // Состояние для модалки завершения приема
//     const [showHealthQuestionnaireModal, setShowHealthQuestionnaireModal] = useState(false);
//     const [isUpdatingAppointment, setIsUpdatingAppointment] = useState(false);

//     // Транскрипция приема: загрузка и автосохранение
//     const { text: persistedText, setText: setPersistedText, fetchTranscription } = useAppointmentTranscription(appointmentId)

//     React.useEffect(() => {
//         fetchTranscription()
//     }, [fetchTranscription])

//     React.useEffect(() => {
//         if (typeof persistedText === 'string' && persistedText !== dialogue) {
//             setDialogue(persistedText)
//         }
//         // eslint-disable-next-line react-hooks/exhaustive-deps
//     }, [persistedText])

//     // const handleFinishAppointment = async () => {
//     //     if (!dialogue.trim()) {
//     //         alert('Диалог отсутствует. Сначала введите или продиктуйте текст.');
//     //         return;
//     //     }

//     //     if (!session?.user_id) {
//     //         alert('Ошибка авторизации. Пожалуйста, перезайдите в систему.');
//     //         return;
//     //     }

//     //     // Если есть анкета, показываем модалку с категоризацией
//     //     if (analysisId) {
//     //         setShowHealthQuestionnaireModal(true);
//     //     } else {
//     //         // Если анкеты нет, генерируем паспорт без анкеты, затем завершаем прием
//     //         try {
//     //             setIsUpdatingAppointment(true);
                
//     //             // Генерируем паспорт без анкеты
//     //             const passportData = {
//     //                 appointment_id: appointmentId,
//     //                 // analysis_id не передаем (или передаем undefined) для генерации без анкеты
//     //                 doctor_id: session.user_id,
//     //                 lang: 'ru' as const,
//     //                 answers: {}, // Пустые ответы, так как анкеты нет
//     //                 transcription_text: dialogue.trim(),
//     //             };

//     //             const passportSuccess = await generatePassport(passportData);
                
//     //             if (passportSuccess) {
//     //                 // Получаем ID паспорта из состояния хука или из localStorage
//     //                 let passportId: string | undefined = undefined;
//     //                 if (generatedPassport?.id) {
//     //                     passportId = generatedPassport.id;
//     //                 } else {
//     //                     // Пытаемся получить из localStorage
//     //                     try {
//     //                         const savedPassports = JSON.parse(localStorage.getItem('healthPassports') || '[]');
//     //                         const savedPassport = savedPassports.find((p: any) => p.appointment_id === appointmentId);
//     //                         if (savedPassport?.id) {
//     //                             passportId = savedPassport.id;
//     //                         }
//     //                     } catch (e) {
//     //                         console.warn('Не удалось получить ID паспорта из localStorage:', e);
//     //                     }
//     //                 }
//     //                 // Завершаем прием с ID паспорта
//     //                 await handleCompleteAppointment(passportId);
//     //             } else {
//     //                 // Если генерация паспорта не удалась, но это не критично, все равно завершаем прием
//     //                 if (passportError && (
//     //                     passportError.includes('health passport already exists') ||
//     //                     passportError.includes('уже существует') ||
//     //                     passportError.includes('already generated')
//     //                 )) {
//     //                     // Паспорт уже существует, завершаем прием
//     //                     await handleCompleteAppointment(undefined);
//     //                 } else {
//     //                     // Ошибка генерации, но продолжаем завершение приема
//     //                     const shouldContinue = confirm('Не удалось сгенерировать паспорт здоровья. Завершить прием без паспорта?');
//     //                     if (shouldContinue) {
//     //                         await handleCompleteAppointment(undefined);
//     //                     }
//     //                 }
//     //             }
//     //         } catch (err) {
//     //             console.error('AppointmentToggle: Ошибка при генерации паспорта без анкеты:', err);
//     //             const shouldContinue = confirm('Произошла ошибка при генерации паспорта здоровья. Завершить прием без паспорта?');
//     //             if (shouldContinue) {
//     //                 await handleCompleteAppointment(undefined);
//     //             }
//     //         } finally {
//     //             setIsUpdatingAppointment(false);
//     //         }
//     //     }
//     // };
// const handleFinishAppointment = async () => {
//   if (!dialogue.trim()) {
//     alert('Диалог отсутствует. Сначала введите или продиктуйте текст.');
//     return;
//   }

//   if (!session?.user_id) {
//     alert('Ошибка авторизации. Пожалуйста, перезайдите в систему.');
//     return;
//   }

//   // Если есть анкета, показываем модалку (в ней теперь только генерация, без автозавершения)
//   if (analysisId) {
//     setShowHealthQuestionnaireModal(true);
//     return;
//   }

//   // Если анкеты нет — просто завершаем прием, без генерации
//   await handleCompleteAppointment(undefined);
// };



//     const handleCompleteAppointment = async (healthPassportId?: string) => {
//         if (!dialogue.trim()) return;

//         try {
//             setIsUpdatingAppointment(true);

//             // Ограничиваем длину doctor_notes (предполагаем лимит в 1000 символов)
//             const truncatedNotes = dialogue.trim().substring(0, 1000);
//             if (dialogue.trim().length > 1000) {
//                 console.warn('AppointmentToggle: Doctor notes обрезаны до 1000 символов');
//             }

//             // Используем новый API для завершения приема
//             const completeSuccess = await completeAppointment(appointmentId, {
//                 doctor_notes: truncatedNotes,
//                 completed_reason: healthPassportId 
//                     ? 'Прием завершен после генерации паспорта здоровья' 
//                     : 'Прием завершен без анкеты',
//                 health_passport_id: healthPassportId
//             });

//             if (completeSuccess) {
//                 setShowHealthQuestionnaireModal(false);
//                 console.log('AppointmentToggle: Прием успешно завершен, обновляем данные');
                
//                 // Обновляем данные приема после успешного завершения
//                 if (onAppointmentUpdated) {
//                     onAppointmentUpdated();
//                 }
                
//                 // Принудительно обновляем страницу через 1 секунду для гарантированного обновления статуса
//                 setTimeout(() => {
//                     console.log('AppointmentToggle: Принудительное обновление страницы');
//                     window.location.reload();
//                 }, 1000);
//             } else {
//                 alert(`Ошибка при завершении приёма: ${error}`);
//             }
//         } catch (err) {
//             console.error('AppointmentToggle: Ошибка при завершении приёма:', err);
//             alert('Произошла ошибка при завершении приёма. Попробуйте снова.');
//         } finally {
//             setIsUpdatingAppointment(false);
//         }
//     };

//     const isProcessing = isCompleting || isUpdatingAppointment || isGeneratingPassport;

//     // Если прием завершен, показываем сообщение и транскрипцию
//     if (isAppointmentCompleted) {
//         return (
//             <div className="space-y-4">
//                 {/* Уведомление о завершении */}
//                 <div className="w-full p-4 bg-blue-50 border border-blue-200 rounded-xl">
//                     <div className="text-blue-800 font-semibold text-lg "> Прием завершен</div>
//                     <div className="text-blue-600 text-sm">
//                         Прием был успешно завершен. Паспорт здоровья в вкладке "Файлы приема". Все данные сохранены и доступны только для просмотра.
//                     </div>
//                 </div>

//                 {/* Транскрипция приема */}
//                 {passportLoading && (
//                     <div className="text-center text-gray-500 text-sm p-3 bg-gray-50 rounded-xl">
//                         Загрузка транскрипции...
//                     </div>
//                 )}
                
//                 {/* Показываем транскрипцию если есть */}
//                 {!passportLoading && passport?.transcription_text && (
//                     <TranscriptionDisplay 
//                         transcriptionText={passport.transcription_text}
//                         className="w-full"
//                     />
//                 )}
                
//                 {/* Показываем сообщение если нет транскрипции */}
//                 {!passportLoading && !passport?.transcription_text && healthPassportId && (
//                     <div className="text-center text-gray-500 text-sm p-4 bg-gray-50 border border-gray-200 rounded-xl">
//                         Транскрипция недоступна
//                     </div>
//                 )}
                
//                 {!passportLoading && !healthPassportId && (
//                     <div className="text-center text-gray-500 text-sm p-4 bg-gray-50 border border-gray-200 rounded-xl">
//                         Паспорт здоровья не найден
//                     </div>
//                 )}
                

//             </div>
//         );
//     }

//     return (
//         <>
//             {!isStarted && (
//                 <>
//                     <div className="mb-4 text-sm text-amber-600 border border-amber-600 rounded-md p-3 bg-amber-50">
//                     Важно: Прикрепите все необходимые файлы до завершения приема во вкладке "Файлы приема". После генерации паспорта здоровья новые файлы не будут в него включены.
//                     </div>
//                     <MyButton className='w-full h-fit text-lg bg-primary hover:bg-primary/90 text-white'
//                         onClick={startStopAppointment}
//                     >
//                         Начать приём
//                     </MyButton>
//                 </>
//             )}

//             {isStarted && (
//                 <>
//                     <QuestionDisplay
//                         value={dialogue}
//                         onChange={(value) => { setDialogue(value); setPersistedText(value) }}
//                         onVoiceRecordingChange={() => { }}
//                     />
//                     <MyButton
//                         className='w-full mt-4 text-lg bg-primary hover:bg-primary/90 text-white disabled:opacity-60'
//                         onClick={handleFinishAppointment}
//                         disabled={isProcessing || !session?.user_id}
//                     >
//                         {isProcessing ? 'Обработка...' : 'Завершить приём'}
//                     </MyButton>
                    
//                     {!session?.user_id && (
//                         <div className="mt-2 text-sm text-red-600">
//                              Ошибка авторизации
//                         </div>
//                     )}
                    
//                     {!analysisId && (
//                         <div className="mt-2 text-sm text-amber-600">
//                             Прием будет завершен без анкеты. Паспорт здоровья будет сгенерирован на основе транскрипции приема. Если нужно, вы можете выбрать анкету во вкладке "Анкета пациента".
//                         </div>
//                     )}
//                 </>
//             )}

//             {/* Модалка редактирования анкеты здоровья */}
//             <HealthQuestionnaireModal
//   isOpen={showHealthQuestionnaireModal}
//   onClose={() => setShowHealthQuestionnaireModal(false)}
//   appointmentId={appointmentId}
//   analysisId={analysisId}
//   analysisData={analysisData}
//   dialogue={dialogue}
//   onCompleted={() => {
//     setShowHealthQuestionnaireModal(false);
//     if (onAppointmentUpdated) onAppointmentUpdated();
//   }}
// />



//         </>
//     )
// }
import { QuestionDisplay } from "@/components/doctor/appointments/appointmentsId/QuestionDisplay";
import MyButton from '@/components/ui/MyButton';
import React, { useState } from 'react';
import { useCompleteAppointment } from '@/hooks/appointment/useCompleteAppointment';
import { useAuth } from '@/context/AuthContext';
import { PatientQuestionnaire } from '@/hooks/files/useQuestionnaires';
import { useHealthPassportById } from '@/hooks/files/useHealthPassportById';
import { useHealthPassport } from '@/hooks/files/useHealthPassport';
import { usePatientRecommendations } from '@/hooks/files/usePatientRecommendations';
import HealthQuestionnaireModal from './HealthQuestionnaireModal';

import TranscriptionDisplay from './TranscriptionDisplay';
import { useAppointmentTranscription } from '@/hooks/appointment/useAppointmentTranscription';

interface IAppointmentToggleProps {
  isStarted: boolean;
  startStopAppointment: () => void;
  appointmentId: string;
  dialogue: string;
  setDialogue: (value: string) => void;
  analysisId?: string | null;
  analysisData?: PatientQuestionnaire | null;
  onAppointmentUpdated?: () => void;
  appointmentStatus?: string;
  healthPassportId?: string;
}

export default function AppointmentToggle({
  isStarted,
  startStopAppointment,
  appointmentId,
  dialogue,
  setDialogue,
  analysisId,
  analysisData,
  onAppointmentUpdated,
  appointmentStatus,
  healthPassportId
}: IAppointmentToggleProps) {
  const { session } = useAuth();
  const { completeAppointment, loading: isCompleting, error } = useCompleteAppointment();

  // Генерация паспорта (кнопка отдельно от завершения)
  const { isGenerating: isGeneratingPassport } = useHealthPassport();

  // Генерация рекомендаций для пациента (вызывается после генерации паспорта)
  const { generateRecommendations, isGenerating: isGeneratingRecommendations } = usePatientRecommendations();

  // Проверяем завершен ли прием
  const isAppointmentCompleted = appointmentStatus &&
    ['completed', 'finished', 'завершено', 'завершён', 'завершен'].includes(appointmentStatus.toLowerCase());

  // Получаем данные паспорта здоровья для завершенных приемов
  const { passport, loading: passportLoading } = useHealthPassportById(
    healthPassportId && isAppointmentCompleted ? healthPassportId : null
  );

  // Состояние для модалки редактирования/генерации по анкете
  const [showHealthQuestionnaireModal, setShowHealthQuestionnaireModal] = useState(false);
  const [isUpdatingAppointment, setIsUpdatingAppointment] = useState(false);

  // Транскрипция приема: загрузка и автосохранение
  const { text: persistedText, setText: setPersistedText, fetchTranscription } = useAppointmentTranscription(appointmentId);

  React.useEffect(() => {
    fetchTranscription();
  }, [fetchTranscription]);

  React.useEffect(() => {
    if (typeof persistedText === 'string' && persistedText !== dialogue) {
      setDialogue(persistedText);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persistedText]);

  // Завершение приема — БЕЗ генерации
  const handleFinishAppointment = async () => {
    if (!dialogue.trim()) {
      alert('Диалог отсутствует. Сначала введите или продиктуйте текст.');
      return;
    }

    if (!session?.user_id) {
      alert('Ошибка авторизации. Пожалуйста, перезайдите в систему.');
      return;
    }

    // ВАЖНО: завершение НЕ связано с генерацией
    await handleCompleteAppointment(undefined);
  };

  // Генерация паспорта — отдельная кнопка
  const handleGeneratePassportClick = async () => {
    if (!dialogue.trim()) {
      alert('Диалог отсутствует. Сначала введите или продиктуйте текст.');
      return;
    }

    if (!session?.user_id) {
      alert('Ошибка авторизации. Пожалуйста, перезайдите в систему.');
      return;
    }

    // Генерируем рекомендации для пациента — запускаем сразу
    void generatePatientRecommendations();

    // Если есть анкета — открываем модалку (редактирование 13 полей + генерация)
    if (analysisId) {
      setShowHealthQuestionnaireModal(true);
    }
  };

  // Генерация рекомендаций для пациента — независимо от паспорта
  const generatePatientRecommendations = async () => {
    if (!dialogue.trim() || !session?.user_id) {
      return;
    }

    const errorMessage = await generateRecommendations({
      appointment_id: appointmentId,
      doctor_id: session.user_id,
      lang: 'ru',
      transcription_text: dialogue.trim(),
    });

    if (errorMessage) {
      alert(`Ошибка при формировании рекомендаций для пациента: ${errorMessage}`);
    }
  };

  const handleCompleteAppointment = async (healthPassportId?: string) => {
    if (!dialogue.trim()) return;

    try {
      setIsUpdatingAppointment(true);

      // Ограничиваем длину doctor_notes (предполагаем лимит в 1000 символов)
      const truncatedNotes = dialogue.trim().substring(0, 1000);
      if (dialogue.trim().length > 1000) {
        console.warn('AppointmentToggle: Doctor notes обрезаны до 1000 символов');
      }

      const completeSuccess = await completeAppointment(appointmentId, {
        doctor_notes: truncatedNotes,
        completed_reason: healthPassportId
          ? 'Прием завершен после генерации паспорта здоровья'
          : 'Прием завершен без анкеты',
        health_passport_id: healthPassportId
      });

      if (completeSuccess) {
        setShowHealthQuestionnaireModal(false);
        console.log('AppointmentToggle: Прием успешно завершен, обновляем данные');

        if (onAppointmentUpdated) {
          onAppointmentUpdated();
        }

        setTimeout(() => {
          console.log('AppointmentToggle: Принудительное обновление страницы');
          window.location.reload();
        }, 1000);
      } else {
        alert(`Ошибка при завершении приёма: ${error}`);
      }
    } catch (err) {
      console.error('AppointmentToggle: Ошибка при завершении приёма:', err);
      alert('Произошла ошибка при завершении приёма. Попробуйте снова.');
    } finally {
      setIsUpdatingAppointment(false);
    }
  };

  const isProcessing = isCompleting || isUpdatingAppointment || isGeneratingPassport || isGeneratingRecommendations;

  // Если прием завершен, показываем сообщение и транскрипцию
  if (isAppointmentCompleted) {
    return (
      <div className="space-y-4">
        <div className="w-full p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <div className="text-blue-800 font-semibold text-lg "> Прием завершен</div>
          <div className="text-blue-600 text-sm">
            Прием был успешно завершен. Паспорт здоровья в вкладке "Файлы приема". Все данные сохранены и доступны только для просмотра.
          </div>
        </div>

        {passportLoading && (
          <div className="text-center text-gray-500 text-sm p-3 bg-gray-50 rounded-xl">
            Загрузка транскрипции...
          </div>
        )}

        {!passportLoading && passport?.transcription_text && (
          <TranscriptionDisplay
            transcriptionText={passport.transcription_text}
            className="w-full"
          />
        )}

        {!passportLoading && !passport?.transcription_text && healthPassportId && (
          <div className="text-center text-gray-500 text-sm p-4 bg-gray-50 border border-gray-200 rounded-xl">
            Транскрипция недоступна
          </div>
        )}

        {!passportLoading && !healthPassportId && (
          <div className="text-center text-gray-500 text-sm p-4 bg-gray-50 border border-gray-200 rounded-xl">
            Паспорт здоровья не найден
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      {!isStarted && (
        <>
          <div className="mb-4 text-sm text-amber-600 border border-amber-600 rounded-md p-3 bg-amber-50">
            Важно: Прикрепите все необходимые файлы до завершения приема во вкладке "Файлы приема". После генерации паспорта здоровья новые файлы не будут в него включены.
          </div>
          <MyButton
            className='w-full h-fit text-lg bg-primary hover:bg-primary/90 text-white'
            onClick={startStopAppointment}
          >
            Начать приём
          </MyButton>
        </>
      )}

      {isStarted && (
        <>
          <QuestionDisplay
            value={dialogue}
            onChange={(value) => { setDialogue(value); setPersistedText(value); }}
            onVoiceRecordingChange={() => { }}
          />

          {/* Отдельная кнопка генерации */}
          <MyButton
            className='w-full mt-4 text-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-60'
            onClick={handleGeneratePassportClick}
            disabled={isProcessing || !session?.user_id}
          >
            {isProcessing ? 'Обработка...' : 'Сгенерировать паспорт'}
          </MyButton>

          {/* Кнопка завершения (без генерации) */}
          <MyButton
            className='w-full mt-4 text-lg bg-primary hover:bg-primary/90 text-white disabled:opacity-60'
            onClick={handleFinishAppointment}
            disabled={isProcessing || !session?.user_id}
          >
            {isProcessing ? 'Обработка...' : 'Завершить приём'}
          </MyButton>

          {!session?.user_id && (
            <div className="mt-2 text-sm text-red-600">
              Ошибка авторизации
            </div>
          )}

          {!analysisId && (
            <div className="mt-2 text-sm text-amber-600">
              Прием будет завершен без анкеты. Если нужно, вы можете выбрать анкету во вкладке "Анкета пациента".
            </div>
          )}
        </>
      )}

      {/* Модалка редактирования анкеты здоровья + генерация паспорта по анкете */}
      <HealthQuestionnaireModal
        isOpen={showHealthQuestionnaireModal}
        onClose={() => setShowHealthQuestionnaireModal(false)}
        appointmentId={appointmentId}
        analysisId={analysisId}
        analysisData={analysisData}
        dialogue={dialogue}
        onCompleted={() => {
          setShowHealthQuestionnaireModal(false);
          if (onAppointmentUpdated) onAppointmentUpdated();
        }}
      />
    </>
  );
}
