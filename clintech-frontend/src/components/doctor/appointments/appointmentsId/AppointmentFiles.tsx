import React, { useCallback, useRef, useState, useEffect } from 'react';
import { useAppointmentFiles } from '@/hooks/files/useAppointmentFiles';
import { useHealthPassportById } from '@/hooks/files/useHealthPassportById';
import { useFileById } from '@/hooks/files/useFileById';
import { UploadCloud, Download, Edit, Eye, FileText } from 'lucide-react';
import PageStateWrapper from '@/components/ui/PageStateWrapper';
import AppointmentFileCard from './AppointmentFileCard';
import { useAuth } from '@/context/AuthContext';
import { useFilePreview } from '@/hooks/files/useFilePreview';
import FilePreviewModal from '@/components/files/FilePreviewModal';
import HealthPassportEditModal from './HealthPassportEditModal';
import { normalizeHealthPassportDownloadUrl } from '@/utils/healthPassport';
import { formatDateWithTime } from '@/utils/date';

interface AppointmentFilesProps {
  id: string;
  status?: string;
  healthPassportId?: string; // Добавляем health_passport_id
}

const forbiddenStatuses = ['завершено', 'прошедший', 'completed', 'passed', 'finished'];

const AppointmentFiles: React.FC<AppointmentFilesProps> = ({ id, status, healthPassportId }) => {
  const { files, loading, error, uploadFile, deleteFile, getDownloadUrl, refetch: refetchFiles } = useAppointmentFiles(id);
  const { passport: healthPassport, loading: passportLoading, error: passportError, refetch: refetchPassport } = useHealthPassportById(healthPassportId || null);
  const { file: healthPassportFile, loading: healthPassportFileLoading, error: healthPassportFileError, refetch: refetchHealthPassportFile } = useFileById(healthPassport?.file_id || null);
  const { session } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showHealthPassportEditModal, setShowHealthPassportEditModal] = useState(false);
  const canEdit = !forbiddenStatuses.includes((status || '').toLowerCase());

  // Удаляем хук для предпросмотра файлов и состояния - больше не нужны



  // Функция для обновления всех данных
  const refreshAllData = useCallback(async () => {
    await Promise.all([
      refetchFiles(),
      refetchPassport()
    ]);
  }, [refetchFiles, refetchPassport]);

  // Автоматическое обновление данных через 2 секунды после изменения healthPassportId
  useEffect(() => {
    if (healthPassportId) {
      const timer = setTimeout(() => {
        refreshAllData();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [healthPassportId, refreshAllData]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      uploadFile(e.dataTransfer.files[0]);
    }
  };

  const { previewUrl, loading: previewLoading, error: previewError, openPreview, closePreview, clearError } = useFilePreview();
  const [previewMeta, setPreviewMeta] = useState<{ id: string, name: string } | null>(null);
  const handlePreview = (fileId: string, fileName: string) => {
    setPreviewMeta({ id: fileId, name: fileName });
    openPreview(fileId);
  };



  // Обработчик редактирования паспорта здоровья
  const handleEditHealthPassport = useCallback((fileId: string) => {
    setShowHealthPassportEditModal(true);
  }, []);

  // Фильтруем файлы: паспорт здоровья по healthPassportId или имени, остальные по uploaded_by
  // const healthPassportFiles = files.filter(file => 
  //   file?.original_name?.startsWith('Health_Passport_') || 
  //   (healthPassportId && file.id === healthPassportId)
  // );
  // Функция для проверки, является ли файл паспортом здоровья
  const isHealthPassportFile = (fileName: string, fileType?: string) => {
    // Проверяем по типу файла (если есть)
    if (fileType === 'health_passport') {
      return true;
    }

    // Проверяем по имени файла
    const lowerFileName = fileName.toLowerCase();
    return lowerFileName.includes('health_passport') ||
      lowerFileName.includes('healthpassport') ||
      lowerFileName.startsWith('health_p') ||
      lowerFileName.includes('паспорт_здоровья') ||
      lowerFileName.includes('паспорт здоровья');
  };

  console.log('healthPassport', healthPassport);

  const patientFiles = files.filter(file => {
    const isPatientFile = file.uploaded_by === 'patient';
    const isNotHealthPassport = healthPassport?.file_id ? file.id !== healthPassport.file_id : true;
    const isNotHealthPassportByName = !isHealthPassportFile(file.file_name, file.type);
    return isPatientFile && isNotHealthPassport && isNotHealthPassportByName;
  });

  const doctorFiles = files.filter(file => {
    const isDoctorFile = file.uploaded_by === 'doctor';
    const isNotHealthPassport = healthPassport?.file_id ? file.id !== healthPassport.file_id : true;
    const isNotHealthPassportByName = !isHealthPassportFile(file.file_name, file.type);
    return isDoctorFile && isNotHealthPassport && isNotHealthPassportByName;
  });

  console.log('patientFiles', patientFiles);
  console.log('doctorFiles', doctorFiles);
  console.log('files', files);

  return (
    <PageStateWrapper
      loading={loading || healthPassportFileLoading || passportLoading}
      loadingText="Загрузка файлов приема"
      error={error}
    >
      <div className="bg-white rounded-xl p-3 sm:p-6 shadow space-y-4 max-w-full w-full">
        <h2 className="text-xl font-bold mb-2">Документы приёма</h2>
        {canEdit && (
          <div
            className={`mb-4 border-2 border-dashed rounded-lg p-3 sm:p-4 flex flex-col items-center justify-center transition w-full max-w-full` + (dragActive ? ' border-blue-500 bg-blue-50' : ' border-blue-300')}
            onDragOver={e => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={e => { e.preventDefault(); setDragActive(false); }}
            onDrop={handleDrop}
          >
            <UploadCloud className="w-8 h-8 text-blue-400 mb-2" />
            <span className="text-blue-600 font-semibold text-center text-sm sm:text-base">Перетащите файл или <span className="underline cursor-pointer" onClick={() => fileInputRef.current?.click()}>выберите</span></span>
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
          </div>
        )}
        <ul className="space-y-2 w-full max-w-full overflow-x-auto">
          {files.length === 0 && (
            <div className="text-gray-400 mt-4 text-sm">Еще не было добавлено ни одного файла</div>
          )}

          <div className="text-sm text-amber-600 mt-1 border border-amber-600 rounded-md p-2 bg-amber-50">
            Внимание: После генерации паспорта здоровья, вы не сможете добавлять файлы в прием
          </div>

          {/* Паспорт здоровья */}
          {(healthPassportFile || healthPassport) && (session?.role === 'doctor' || session?.role === 'patient') && (
            <>
              <div className="font-bold mt-4 text-md text-blue-500">Заключительный паспорт здоровья</div>

              {healthPassportFile && (
                <li className="flex items-center justify-between border border-primary/50 bg-blue-50 p-2 sm:p-3 rounded-lg hover:shadow transition w-full max-w-full overflow-x-auto">
                  <AppointmentFileCard
                    file={{
                      ...healthPassportFile,
                      file_id: healthPassport?.file_id // Добавляем file_id из healthPassport
                    }}
                    canEdit={canEdit}
                    deleteConfirmId={deleteConfirmId}
                    deleteFile={deleteFile}
                    setDeleteConfirmId={setDeleteConfirmId}
                    getDownloadUrl={getDownloadUrl}
                    onEdit={handleEditHealthPassport}
                    isHealthPassport={true}
                  />
                </li>
              )}
              {healthPassport && !healthPassportFile && (
                <li className="flex items-center justify-between border border-primary/50 bg-blue-50 p-2 sm:p-3 rounded-lg hover:shadow transition w-full max-w-full overflow-x-auto">
                  <div className="flex flex-col md:flex-row md:items-center gap-2 sm:gap-3 min-w-0 w-0 flex-1">
                    <div className='flex items-center gap-2'>
                      <div className="w-5 h-5 bg-primary/10 rounded flex items-center justify-center shrink-0">
                        <span className="text-primary text-xs font-bold">HP</span>
                      </div>
                      <span className="font-medium truncate max-w-[180px] md:max-w-xs">Паспорт здоровья</span>
                    </div>
                    <div className='flex items-center gap-2'>
                      <span className="text-xs text-gray-500 shrink-0">Создан {formatDateWithTime(healthPassport.created_at)}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 items-center shrink-0">
                    {/* Кнопка предпросмотра */}
                    <button
                      onClick={() => handlePreview(healthPassport.file_id, 'Паспорт здоровья.pdf')}
                      className="p-2 rounded hover:bg-green-100"
                      title="Предпросмотр"
                    >
                      <Eye className="w-5 h-5 text-green-600" />
                    </button>
                    {/* Кнопка скачивания */}
                    <a
                      href={normalizeHealthPassportDownloadUrl(healthPassport.download_url, healthPassport.file_id)}
                      className="p-2 rounded hover:bg-blue-100"
                      title="Скачать"
                      download
                    >
                      <Download className="w-5 h-5 text-blue-600" />
                    </a>
                    {/* Кнопка редактирования паспорта здоровья - ВСЕГДА показываем для врача */}
                    <button
                      onClick={() => setShowHealthPassportEditModal(true)}
                      className="p-2 rounded hover:bg-orange-100"
                      title="Редактировать паспорт здоровья"
                    >
                      <Edit className="w-5 h-5 text-orange-600" />
                    </button>
                  </div>
                </li>
              )}
            </>
          )}


          {/* Файлы пациента */}
          {patientFiles.length > 0 && (
            <>
              <div className="font-bold mt-4 text-md">Файлы пациента</div>
              {patientFiles.map((file) => (
                <li key={file.id} className="flex items-center justify-between border p-2 sm:p-3 rounded-lg hover:shadow transition w-full max-w-full overflow-x-auto">
                  <AppointmentFileCard
                    file={file}
                    canEdit={canEdit}
                    deleteConfirmId={deleteConfirmId}
                    deleteFile={deleteFile}
                    setDeleteConfirmId={setDeleteConfirmId}
                    getDownloadUrl={getDownloadUrl}
                    onPreview={handlePreview}
                  />
                </li>
              ))}
            </>
          )}


          {/* Файлы врача */}
          {doctorFiles.length > 0 && (
            <>
              <div className="font-bold mt-4 text-md">Файлы врача</div>
              {doctorFiles.map((file) => (
                <li key={file.id} className="flex items-center justify-between border p-2 sm:p-3 rounded-lg hover:shadow transition w-full max-w-full overflow-x-auto">
                  <AppointmentFileCard
                    file={file}
                    canEdit={canEdit}
                    deleteConfirmId={deleteConfirmId}
                    deleteFile={deleteFile}
                    setDeleteConfirmId={setDeleteConfirmId}
                    getDownloadUrl={getDownloadUrl}
                    onPreview={handlePreview}
                  />
                </li>
              ))}
            </>
          )}

        </ul>
        {!canEdit && (
          <div className="text-gray-400 mt-4 text-sm">Добавление и удаление файлов недоступно для завершённых приёмов</div>
        )}
        {canEdit && (
          <div className="text-gray-500 mt-4 text-sm">
            {session?.role === 'patient' && 'Вы можете удалять только свои файлы'}
            {session?.role === 'doctor' && 'Вы можете удалять только свои файлы'}
          </div>
        )}
      </div>

      {/* Модальное окно для редактирования паспорта здоровья */}
      <HealthPassportEditModal
        isOpen={showHealthPassportEditModal}
        onClose={() => setShowHealthPassportEditModal(false)}
        passportId={healthPassport?.id || null}
        onSuccess={() => {
          setShowHealthPassportEditModal(false);
          refreshAllData();
        }}
      />
      {/* Preview modal */}
      <FilePreviewModal
        isOpen={!!previewUrl}
        onClose={() => { closePreview(); setPreviewMeta(null); clearError(); }}
        previewUrl={previewUrl}
        loading={previewLoading}
        error={previewError}
        fileName={previewMeta?.name}
        fileId={previewMeta?.id || undefined}
      />
    </PageStateWrapper>
  );
};

export default AppointmentFiles; 