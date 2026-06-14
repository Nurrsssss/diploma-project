'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, Plus } from 'lucide-react';
import { useAppointmentExceptions } from '@/hooks/appointment/useAppointmentExceptions';
import MyButton from '@/components/ui/MyButton';
import ErrorMessage from '@/components/ui/ErrorMessage';
import CreateExceptionModal from './CreateExceptionModal';
import ExceptionsList from './ExceptionsList';

type Props = { doctorId?: string }; // doctorId = user_id выбранного врача (users.id)

const DoctorScheduleManager: React.FC<Props> = ({ doctorId }) => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const [selectedDateRange, setSelectedDateRange] = useState<{ start: string; end: string }>({
    start: new Date().toISOString().split('T')[0],
    end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // +30 дней
  });

  const { exceptions, loading, error, fetchExceptions, deleteException, clearError } =
    useAppointmentExceptions();

  // doctorId должен быть user_id выбранного врача (users.id)
  const effectiveDoctorUserId = useMemo(
    () => (doctorId ? String(doctorId).trim() : undefined),
    [doctorId]
  );

  useEffect(() => {
    fetchExceptions(selectedDateRange.start, selectedDateRange.end, effectiveDoctorUserId);
  }, [selectedDateRange.start, selectedDateRange.end, effectiveDoctorUserId, fetchExceptions]);

  const handleCreateSuccess = () => {
    setIsCreateModalOpen(false);
    fetchExceptions(selectedDateRange.start, selectedDateRange.end, effectiveDoctorUserId);
  };

  const handleDeleteException = async (id: string) => {
    if (window.confirm('Вы уверены, что хотите удалить это закрытие?')) {
      await deleteException(id, effectiveDoctorUserId);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg p-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <div>
            <h2 className="text-xl font-bold mb-2">Управление расписанием</h2>
            <p className="text-gray-600 text-sm">Закрывайте дни или временные окна для приемов</p>
          </div>

          <MyButton
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center justify-center bg-primary hover:bg-primary/90 text-white"
            disabled={!effectiveDoctorUserId} // чтобы не создавать без выбранного врача
            title={!effectiveDoctorUserId ? 'Сначала выберите врача' : undefined}
          >
            <Plus className="w-4 h-4 mr-2" />
            Создать закрытие
          </MyButton>
        </div>

        <div className="border-t pt-4">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <Calendar className="w-5 h-5 mr-2" />
            Период отображения
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Начальная дата</label>
              <input
                type="date"
                value={selectedDateRange.start}
                onChange={(e) =>
                  setSelectedDateRange((prev) => ({
                    ...prev,
                    start: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Конечная дата</label>
              <input
                type="date"
                value={selectedDateRange.end}
                onChange={(e) =>
                  setSelectedDateRange((prev) => ({
                    ...prev,
                    end: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
              />
            </div>
          </div>
        </div>
      </div>

      {error && <ErrorMessage message={error} variant="error" onClose={clearError} />}

      {exceptions.length > 0 ? (
        <div className="space-y-4">
          <ExceptionsList exceptions={exceptions} loading={loading} onDelete={handleDeleteException} />
        </div>
      ) : (
        <div className="bg-white rounded-lg p-8 text-center">
          <div className="text-gray-400 mb-4">
            <Calendar className="w-16 h-16 mx-auto" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Нет закрытых периодов</h3>
          <p className="text-gray-600 mb-4">Создайте первое закрытие расписания</p>
        </div>
      )}

     <CreateExceptionModal
  isOpen={isCreateModalOpen}
  onClose={() => setIsCreateModalOpen(false)}
  onSuccess={handleCreateSuccess}
  doctorUserId={effectiveDoctorUserId}
/>

    </div>
  );
};

export default DoctorScheduleManager;
