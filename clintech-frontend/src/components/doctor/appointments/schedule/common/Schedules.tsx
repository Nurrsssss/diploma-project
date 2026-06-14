'use client';

import { useAuth } from '@/context/AuthContext';
import { useEffect, useState } from 'react';
import { FaPlus } from 'react-icons/fa';

import NoContent from '@/components/ui/NoContent';
import MyButton from '@/components/ui/MyButton';
import PageStateWrapper from '@/components/ui/PageStateWrapper';
import React from 'react';
import { TDoctorSchedule } from '@/types/doctorShedules';
import { useDoctorSchedules } from '@/hooks/schedule/useDoctorSchedules';
import { useDoctorSlots } from '@/hooks/schedule/useDoctorSlots';

import ScheduleCard from '../scheduleCard/ScheduleCard';
import ScheduleModal from '../forms/ScheduleModal';

type Props = { doctorId?: string };

export default function Schedules({ doctorId }: Props) {
  const { session, hydrated } = useAuth();

  const {
    schedules,
    loading,
    error,
    fetchSchedules,
    deleteSchedule,
    deleting,
    toggleSchedule,
    toggling,
  } = useDoctorSchedules();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<TDoctorSchedule | null>(null);

  const { deleteAllSlots } = useDoctorSlots();

const effectiveDoctorUserId = React.useMemo(() => {
  const r = session?.role;
  if (r === 'reception') {
    return doctorId ? String(doctorId).trim() : undefined;
  }
  // doctor (и любые другие роли где это допустимо)
  const id = doctorId ?? session?.user_id;
  return id ? String(id).trim() : undefined;
}, [doctorId, session?.role, session?.user_id]);

  useEffect(() => {
    if (!hydrated) return;
    if (!effectiveDoctorUserId) return;
    fetchSchedules(effectiveDoctorUserId);
  }, [hydrated, effectiveDoctorUserId, fetchSchedules]);

  const handleOpenCreateModal = () => {
    if (session?.role === 'reception' && !effectiveDoctorUserId) return;

    setEditingSchedule(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (schedule: TDoctorSchedule) => {
    setEditingSchedule(schedule);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingSchedule(null);
  };

  const handleModalSuccess = () => {
    if (effectiveDoctorUserId) fetchSchedules(effectiveDoctorUserId);
  };

  return (
    <PageStateWrapper loading={loading || !hydrated} loadingText="Загрузка расписаний" error={error}>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50/30">
        <div className="space-y-6">
          {schedules.length > 0 ? (
            <div className="space-y-6">
              {schedules.map((schedule, index) => (
                <ScheduleCard
                  key={schedule.id || index}
                  schedule={schedule}
                  index={index}
                  toggleSchedule={(id: string) => toggleSchedule(id, effectiveDoctorUserId)} // ✅
                  toggling={toggling}
                  deleteAllSlots={deleteAllSlots}
                  deleting={deleting}
                  onEdit={() => handleOpenEditModal(schedule)}
                  deleteSchedule={(id: string) => deleteSchedule(id, effectiveDoctorUserId)} // ✅
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <NoContent
                title="Пока нет расписаний"
                description="Создайте первое расписание для автоматического создания приемов"
              />
              <div className="mt-6">
                <MyButton
                  onClick={handleOpenCreateModal}
                  disabled={session?.role === 'reception' && !effectiveDoctorUserId}
  title={session?.role === 'reception' && !effectiveDoctorUserId ? 'Сначала выберите врача' : undefined}
                  className="flex items-center gap-3 py-3 px-6 bg-primary hover:bg-primary/90 text-white rounded-xl mx-auto"
                >
                  <FaPlus size={16} />
                  <span>Создать первое расписание</span>
                </MyButton>
              </div>
            </div>
          )}
        </div>

        <ScheduleModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onSuccess={handleModalSuccess}
          editingSchedule={editingSchedule}
          doctorUserId={effectiveDoctorUserId} // ✅ ВАЖНО для reception
        />
      </div>
    </PageStateWrapper>
  );
}
