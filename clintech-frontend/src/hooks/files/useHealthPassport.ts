// import { useState, useCallback } from 'react';
// import { useAuthenticatedFetch } from '../auth/useAuthenticatedFetch';
// import { HealthPassport, GenerateHealthPassportData } from '@/types/healthPassport';
// import { normalizeHealthPassportDownloadUrl } from '@/utils/healthPassport';

// interface PassportResult {
//     id: string;
//     patient_id: string;
//     doctor_id: string;
//     appointment_id: string;
//     analysis_id: string;
//     file_id: string;
//     download_url?: string; // URL для скачивания файла (например, /health-passport/:id/download)
//     created_at: string;
//     updated_at: string;
// }

// interface UseHealthPassportReturn {
//     isGenerating: boolean;
//     error: string | null;
//     passport: PassportResult | null;
//     generatePassport: (data: GenerateHealthPassportData) => Promise<boolean>;
//     savePassportAsAppointmentFile: (appointmentId: string, passportResult: PassportResult) => Promise<boolean>;
//     getSavedPassports: () => any[];
//     getPassportByAppointmentId: (appointmentId: string) => any | null;
//     clearError: () => void;
//     reset: () => void;
// }

// export const useHealthPassport = (): UseHealthPassportReturn => {
//     const [isGenerating, setIsGenerating] = useState(false);
//     const [error, setError] = useState<string | null>(null);
//     const [passport, setPassport] = useState<PassportResult | null>(null);
//     const authenticatedFetch = useAuthenticatedFetch();

//     const clearError = useCallback(() => {
//         setError(null);
//     }, []);

//     const reset = useCallback(() => {
//         setIsGenerating(false);
//         setError(null);
//         setPassport(null);
//     }, []);

//     const savePassportAsAppointmentFile = useCallback(async (appointmentId: string, passportResult: PassportResult): Promise<boolean> => {
//         try {
            
//             // Используем download_url из ответа API вместо построения прямого URL
//             const downloadUrl = normalizeHealthPassportDownloadUrl(passportResult.download_url, passportResult.file_id);
            
//             // Получаем файл паспорта по download_url
//             const fileResponse = await authenticatedFetch(downloadUrl, {
//                 method: 'GET',
//             });

//             if (!fileResponse.ok) {
//                 console.error('useHealthPassport: Не удалось получить файл паспорта');
//                 return false;
//             }

//             const fileBlob = await fileResponse.blob();
            
//             // Получаем имя файла из заголовка Content-Disposition или используем дефолтное
//             const contentDisposition = fileResponse.headers.get('Content-Disposition');
//             let fileName = `Health_Passport_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.docx`;
//             if (contentDisposition) {
//                 const fileNameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
//                 if (fileNameMatch && fileNameMatch[1]) {
//                     fileName = decodeURIComponent(fileNameMatch[1]);
//                 }
//             }
            
//             // Определяем MIME тип из ответа или используем дефолтный для DOCX
//             const contentType = fileResponse.headers.get('Content-Type') || 
//                 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
            
//             // Создаем File объект из blob
//             const file = new File([fileBlob], fileName, { type: contentType });
            
//             // Загружаем файл как файл приёма
//             const formData = new FormData();
//             formData.append('file', file);
//             formData.append('type', 'health_passport'); // Добавляем специальный тип

//             const uploadResponse = await authenticatedFetch(`/api/appointments/${appointmentId}/files`, {
//                 method: 'POST',
//                 body: formData,
//             });

//             if (!uploadResponse.ok) {
//                 console.error('useHealthPassport: Не удалось сохранить паспорт как файл приёма');
//                 return false;
//             }

//             // Автоматически скачиваем файл
//             try {
//                 const downloadUrl = URL.createObjectURL(fileBlob);
//                 const link = document.createElement('a');
//                 link.href = downloadUrl;
//                 link.download = fileName;
//                 document.body.appendChild(link);
//                 link.click();
                
//                 // Используем setTimeout для очистки ресурсов, чтобы дать браузеру время начать скачивание
//                 setTimeout(() => {
//                     try {
//                         document.body.removeChild(link);
//                         URL.revokeObjectURL(downloadUrl);
//                     } catch (cleanupError) {
//                         console.warn('Ошибка при очистке ресурсов скачивания:', cleanupError);
//                     }
//                 }, 100);

//                 return true;
//             } catch (downloadError) {
//                 console.warn('Ошибка при инициации скачивания:', downloadError);
//                 // Даже если произошла ошибка в UI, считаем операцию успешной,
//                 // так как файл был сохранен на сервере
//                 return true;
//             }
//         } catch (err) {
//             console.error('useHealthPassport: Ошибка при сохранении паспорта:', err);
//             return false;
//         }
//     }, [authenticatedFetch]);

//     const generatePassport = useCallback(async (data: GenerateHealthPassportData): Promise<boolean> => {
//         try {
//             setIsGenerating(true);
//             setError(null);

// 	console.log('useHealthPassport: generatePassport payload =>', data);
//             const response = await authenticatedFetch('/api/health-passport/generate', {
//                 method: 'POST',
//                 headers: {
//                     'Content-Type': 'application/json',
//                 },
//                 body: JSON.stringify(data),
//             });

//             if (!response.ok) {
//                 const errorText = await response.text();
//                 console.error('useHealthPassport: Error response:', errorText);
                
//                 let errorMessage = `Ошибка генерации паспорта: ${response.status}`;
                
//                 try {
//                     const errorData = JSON.parse(errorText);
//                     if (errorData.error) {
//                         errorMessage = errorData.error;
//                     }
//                     if (errorData.details) {
//                         errorMessage += ` - ${errorData.details}`;
//                     }
//                 } catch {
//                     errorMessage += ` - ${errorText}`;
//                 }
                
//                 throw new Error(errorMessage);
//             }

//             const result: PassportResult = await response.json();
//             setPassport(result);

//             // Сохраняем response.data в localStorage (временно)
//             const passportData = {
//                 ...result,
//                 saved_at: new Date().toISOString(),
//                 appointment_id: data.appointment_id
//             };
            
//             const existingPassports = JSON.parse(localStorage.getItem('healthPassports') || '[]');
//             const updatedPassports = existingPassports.filter((p: any) => p.appointment_id !== data.appointment_id);
//             updatedPassports.push(passportData);
//             localStorage.setItem('healthPassports', JSON.stringify(updatedPassports));
            
//             // Response data сохранена в localStorage

//             // Автоматически сохраняем паспорт как файл приёма
//             // ВАЖНО: Делаем это только если есть download_url и file_id
//             if (result.download_url || result.file_id) {
//                 console.log('useHealthPassport: Сохраняем паспорт как файл приёма...', { 
//                     download_url: result.download_url, 
//                     file_id: result.file_id,
//                     id: result.id 
//                 });
//                 const saveSuccess = await savePassportAsAppointmentFile(data.appointment_id, result);
//                 if (!saveSuccess) {
//                     console.warn('useHealthPassport: Не удалось сохранить паспорт как файл приёма, но генерация успешна');
//                 }
//             } else {
//                 console.warn('useHealthPassport: download_url и file_id отсутствуют, пропускаем сохранение файла');
//             }

//             return true;
//         } catch (err) {
//             const errorMessage = err instanceof Error ? err.message : 'Ошибка при генерации паспорта здоровья';
//             console.error('useHealthPassport: Generation error:', err);
//             setError(errorMessage);
//             return false;
//         } finally {
//             setIsGenerating(false);
//         }
//     }, [authenticatedFetch, savePassportAsAppointmentFile]);

//     const getSavedPassports = useCallback(() => {
//         try {
//             return JSON.parse(localStorage.getItem('healthPassports') || '[]');
//         } catch (err) {
//             console.error('useHealthPassport: Ошибка при получении сохраненных паспортов:', err);
//             return [];
//         }
//     }, []);

//     const getPassportByAppointmentId = useCallback((appointmentId: string) => {
//         try {
//             const passports = JSON.parse(localStorage.getItem('healthPassports') || '[]');
//             return passports.find((p: any) => p.appointment_id === appointmentId) || null;
//         } catch (err) {
//             console.error('useHealthPassport: Ошибка при получении паспорта по ID приёма:', err);
//             return null;
//         }
//     }, []);

//     return {
//         isGenerating,
//         error,
//         passport,
//         generatePassport,
//         savePassportAsAppointmentFile,
//         getSavedPassports,
//         getPassportByAppointmentId,
//         clearError,
//         reset
//     };
// }; 
import { useState, useCallback } from 'react';
import { useAuthenticatedFetch } from '../auth/useAuthenticatedFetch';
import { GenerateHealthPassportData } from '@/types/healthPassport';
import { normalizeHealthPassportDownloadUrl } from '@/utils/healthPassport';

interface PassportResult {
  id: string;
  patient_id: string;
  doctor_id: string;
  appointment_id: string;
  analysis_id: string;
  file_id: string;
  download_url?: string;
  created_at: string;
  updated_at: string;
}

interface UseHealthPassportReturn {
  isGenerating: boolean;
  error: string | null;
  passport: PassportResult | null;
  generatePassport: (data: GenerateHealthPassportData) => Promise<boolean>;
  savePassportAsAppointmentFile: (appointmentId: string, passportResult: PassportResult) => Promise<boolean>;
  getSavedPassports: () => any[];
  getPassportByAppointmentId: (appointmentId: string) => any | null;
  clearError: () => void;
  reset: () => void;
}

const LOCAL_HEALTH_PASSPORTS_STORAGE_KEY = 'healthPassports';

const readLocalHealthPassports = (): PassportResult[] => {
  if (typeof window === 'undefined') return [];

  try {
    const raw = localStorage.getItem(LOCAL_HEALTH_PASSPORTS_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('useHealthPassport: Ошибка чтения локальных паспортов:', error);
    return [];
  }
};

const saveLocalHealthPassport = (passportData: PassportResult) => {
  if (typeof window === 'undefined') return;

  try {
    const existingPassports = readLocalHealthPassports();
    const updatedPassports = existingPassports.filter((p: any) => p?.appointment_id !== passportData.appointment_id);
    updatedPassports.push(passportData);
    localStorage.setItem(LOCAL_HEALTH_PASSPORTS_STORAGE_KEY, JSON.stringify(updatedPassports));
  } catch (error) {
    console.error('useHealthPassport: Ошибка сохранения локального паспорта:', error);
  }
};

export const useHealthPassport = (): UseHealthPassportReturn => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passport, setPassport] = useState<PassportResult | null>(null);
  const authenticatedFetch = useAuthenticatedFetch();

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const reset = useCallback(() => {
    setIsGenerating(false);
    setError(null);
    setPassport(null);
  }, []);

  const savePassportAsAppointmentFile = useCallback(
    async (appointmentId: string, passportResult: PassportResult): Promise<boolean> => {
      try {
        // Используем download_url из ответа API вместо построения прямого URL
        const downloadUrl = normalizeHealthPassportDownloadUrl(passportResult.download_url, passportResult.file_id);

        // Получаем файл паспорта по download_url
        const fileResponse = await authenticatedFetch(downloadUrl, {
          method: 'GET',
        });

        if (!fileResponse.ok) {
          console.error('useHealthPassport: Не удалось получить файл паспорта');
          return false;
        }

        const fileBlob = await fileResponse.blob();

        // Получаем имя файла из заголовка Content-Disposition или используем дефолтное
        const contentDisposition = fileResponse.headers.get('Content-Disposition');
        let fileName = `Health_Passport_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.docx`;
        if (contentDisposition) {
          const fileNameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
          if (fileNameMatch && fileNameMatch[1]) {
            fileName = decodeURIComponent(fileNameMatch[1]);
          }
        }

        // Определяем MIME тип из ответа или используем дефолтный для DOCX
        const contentType =
          fileResponse.headers.get('Content-Type') ||
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

        // Сначала сохраняем в «Загрузки» браузера — это основной ожидаемый результат для врача
        try {
          const objUrl = URL.createObjectURL(fileBlob);
          const link = document.createElement('a');
          link.href = objUrl;
          link.download = fileName;
          document.body.appendChild(link);
          link.click();
          setTimeout(() => {
            try {
              document.body.removeChild(link);
              URL.revokeObjectURL(objUrl);
            } catch (cleanupError) {
              console.warn('Ошибка при очистке ресурсов скачивания:', cleanupError);
            }
          }, 100);
        } catch (downloadError) {
          console.warn('useHealthPassport: не удалось инициировать скачивание DOCX:', downloadError);
        }

        // Затем прикрепляем к приёму (не блокируем успех генерации)
        const file = new File([fileBlob], fileName, { type: contentType });
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', 'health_passport');

        const uploadResponse = await authenticatedFetch(`/api/appointments/${appointmentId}/files`, {
          method: 'POST',
          body: formData,
        });

        if (!uploadResponse.ok) {
          console.warn('useHealthPassport: не удалось сохранить паспорт как файл приёма (DOCX уже скачан)');
        }

        return true;
      } catch (err) {
        console.error('useHealthPassport: Ошибка при сохранении паспорта:', err);
        return false;
      }
    },
    [authenticatedFetch],
  );

  const generatePassport = useCallback(
    async (data: GenerateHealthPassportData): Promise<boolean> => {
      try {
        setIsGenerating(true);
        setError(null);

        /**
         * ВАЖНО: генерация должна работать и без анкеты.
         * Поэтому вычищаем из payload любые questionnaire-поля, если они пустые (null/undefined/""/{})
         * чтобы бэк не воспринимал это как "анкета передана, но невалидна".
         */
        const payload: any = { ...data };

        const questionnaireKeys = [
          'questionnaire_id',
          'questionnaireId',
          'patient_questionnaire_id',
          'patientQuestionnaireId',
          'questionnaire',
          'patient_questionnaire',
          'patientQuestionnaire',
        ];

        for (const k of questionnaireKeys) {
          if (k in payload) {
            const v = payload[k];
            const isEmptyObject =
              v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0;

            if (v === null || v === undefined || v === '' || isEmptyObject) {
              delete payload[k];
            }
          }
        }

        console.log('useHealthPassport: generatePassport payload (sanitized) =>', payload);

        const response = await authenticatedFetch('/api/health-passport/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('useHealthPassport: Error response:', errorText);

          let errorMessage = `Ошибка генерации паспорта: ${response.status}`;

          try {
            const errorData = JSON.parse(errorText);
            if (errorData.error) {
              errorMessage = errorData.error;
            }
            if (errorData.details) {
              errorMessage += ` - ${errorData.details}`;
            }
          } catch {
            errorMessage += ` - ${errorText}`;
          }

          throw new Error(errorMessage);
        }

        const result: PassportResult = await response.json();
        setPassport(result);

        const passportData = {
          ...result,
          saved_at: new Date().toISOString(),
          appointment_id: data.appointment_id,
        };
        saveLocalHealthPassport(passportData);

        // Автоматически сохраняем паспорт как файл приёма (если есть ссылка/файл)
        if (result.download_url || result.file_id) {
          console.log('useHealthPassport: Сохраняем паспорт как файл приёма...', {
            download_url: result.download_url,
            file_id: result.file_id,
            id: result.id,
          });

          const saveSuccess = await savePassportAsAppointmentFile(data.appointment_id, result);
          if (!saveSuccess) {
            console.warn('useHealthPassport: Не удалось сохранить паспорт как файл приёма, но генерация успешна');
          }
        } else {
          console.warn('useHealthPassport: download_url и file_id отсутствуют, пропускаем сохранение файла');
        }

        return true;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Ошибка при генерации паспорта здоровья';
        console.error('useHealthPassport: Generation error:', err);

        const canFallbackLocally =
          errorMessage.includes('Ошибка сети') ||
          errorMessage.includes('fetch failed') ||
          errorMessage.includes('ANKETA_SERVICE') ||
          errorMessage.includes('Failed to fetch');

        if (canFallbackLocally) {
          const now = new Date().toISOString();
          const localPassport: PassportResult = {
            id: crypto.randomUUID(),
            patient_id: '',
            doctor_id: data.doctor_id,
            appointment_id: data.appointment_id,
            analysis_id: data.analysis_id || '',
            file_id: '',
            created_at: now,
            updated_at: now,
          };

          saveLocalHealthPassport({
            ...localPassport,
            transcription_text: data.transcription_text || '',
          } as PassportResult & { transcription_text?: string });
          setPassport(localPassport);
          setError(null);
          return true;
        }

        setError(errorMessage);
        return false;
      } finally {
        setIsGenerating(false);
      }
    },
    [authenticatedFetch, savePassportAsAppointmentFile],
  );

  const getSavedPassports = useCallback(() => {
    return readLocalHealthPassports();
  }, []);

  const getPassportByAppointmentId = useCallback((appointmentId: string) => {
    try {
      const passports = readLocalHealthPassports();
      return passports.find((p: any) => p.appointment_id === appointmentId) || null;
    } catch (err) {
      console.error('useHealthPassport: Ошибка при получении паспорта по ID приёма:', err);
      return null;
    }
  }, []);

  return {
    isGenerating,
    error,
    passport,
    generatePassport,
    savePassportAsAppointmentFile,
    getSavedPassports,
    getPassportByAppointmentId,
    clearError,
    reset,
  };
};
