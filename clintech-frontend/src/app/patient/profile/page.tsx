"use client";

import React, { useState } from "react";
import PProfileHeader from "@/components/patient/profile/PProfileHeader";
import PProfileForm from "@/components/patient/profile/PProfileForm";
import PProfileView from "@/components/patient/profile/PProfileView";
import { useAuth } from "@/context/AuthContext";
import { usePatient } from "@/hooks/patient/usePatient";
import PageStateWrapper from "@/components/ui/PageStateWrapper";
import { usePatientByUserId } from "@/hooks/patient/usePatientByUserId";

const PatientProfile = () => {
  const { session } = useAuth();
const { patient, loading, error, updatePatient, updating, refetch } =
  usePatientByUserId(session?.user_id || null)  ;
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [hasTriedLoading, setHasTriedLoading] = useState(false);

  // Отслеживаем, когда хотя бы раз началась загрузка
  React.useEffect(() => {
    if (loading) {
      setHasTriedLoading(true);
    }
  }, [loading]);

  // Функция для повторной попытки загрузки
  const handleRetry = () => {
    refetch();
  };

  const handleEditClick = () => {
    setIsEditModalOpen(true);
  };

  // Показываем загрузку пока не загрузились данные или еще не пытались загрузить
  const isActuallyLoading = loading || !hasTriedLoading;

  // Показываем пустое состояние только если загрузка завершена, нет ошибки и нет пациента
  const isReallyEmpty = hasTriedLoading && !loading && !error && (!patient || !patient.id);

  return (
    <PageStateWrapper
      loading={isActuallyLoading}
      error={error}
      isEmpty={isReallyEmpty}
      emptyTitle="Профиль пациента не найден"
      emptyDescription="Данные профиля не были загружены"
      onRetry={handleRetry}
      loadingText="Загрузка профиля пациента"
      centerContent={false}
      className="bg-pageBg text-gray-900"
    >
      <div className="min-h-screen bg-pageBg text-gray-900">
        <div className="container px-4 py-8 space-y-6">
          {/* Заголовок профиля с кнопкой редактирования */}
          <PProfileHeader
            patient={patient!}
            onEditClick={handleEditClick}
            updating={updating}
          />

          {/* Отображение профиля */}
          <PProfileView patient={patient!} />

          {/* Модальное окно редактирования */}
          {patient && (
            <PProfileForm
              patient={patient}
              isOpen={isEditModalOpen}
              onClose={() => setIsEditModalOpen(false)}
              updatePatient={updatePatient}
              updating={updating}
              refetch={refetch}
            />
          )}


        </div>
      </div>
    </PageStateWrapper>
  );
};

export default PatientProfile;