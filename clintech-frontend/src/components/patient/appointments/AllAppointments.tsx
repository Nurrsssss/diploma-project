'use client';

import AppointmentCard from './AppointmentCard';
import PageStateWrapper from '@/components/ui/PageStateWrapper';
import { useState } from 'react';
import { usePatientAppointments } from '@/hooks/patient/usePatientAppointments';

export default function AllAppointments() {
  const { appointments, loading, error, refetch } = usePatientAppointments();
  const [refreshKey, setRefreshKey] = useState(0);

  const handleAppointmentCancel = () => {
    refetch();
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <PageStateWrapper
      loading={loading}
      error={error || undefined}
      onRetry={refetch}
      isEmpty={!loading && appointments.length === 0}
      emptyTitle="У вас пока нет запланированных приёмов"
      emptyDescription="Когда вы запишетесь к врачу, ваши приёмы появятся в этом разделе."
      button="Записаться"
      buttonHref="/patient/my-appointments/make"
      loadingText="Загрузка приёмов"
      centerContent={true}
    >
      <h2 className="bg-white rounded-xl px-4 py-2 mb-2 text-2xl font-bold">
        Список моих приёмов
      </h2>
      <div className="space-y-6" key={refreshKey}>
        {appointments
          .slice()
          .sort(
            (a, b) =>
              new Date(b.start_time).getTime() -
              new Date(a.start_time).getTime(),
          )
          .map((appointment) => (
            <AppointmentCard
              key={appointment.id}
              appointment={appointment as any}
              onCancel={handleAppointmentCancel}
            />
          ))}
      </div>
    </PageStateWrapper>
  );
}
