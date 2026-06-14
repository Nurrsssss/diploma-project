'use client'
import { useDoctor } from "@/hooks/doctor/useDoctor";
import { useAuth } from "@/context/AuthContext";
import { useState } from "react";
import { TDoctor } from "@/types/doctors";
import { DProfileHeader } from "@/components/doctor/profile/DProfileHeader";
import { DProfileEducation } from "@/components/doctor/profile/DProfileEducation";
import { DProfileСertificates } from "@/components/doctor/profile/DProfileCertificates";
import { DProfileContact } from "@/components/doctor/profile/DProfileContact";
import { DoctorProfileEditForm } from "@/components/doctor/profile/DoctorProfileEditForm";
import MyButton from "@/components/ui/MyButton";
import { DProfileSchedule } from "@/components/doctor/profile/DProfileSchedule";
import PageStateWrapper from "@/components/ui/PageStateWrapper";

export default function DoctorProfilePage() {
    const { session, hydrated } = useAuth();

    // ✅ Дождемся гидратации сессии перед запросом врача
    const { doctor, loading, error, refetch } = useDoctor(hydrated ? session?.user_id : null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    const handleSave = (updatedDoctor: TDoctor) => {
        setIsEditModalOpen(false);
        refetch(); // Обновляем данные с сервера
    };

    const handleEditClick = () => {
        setIsEditModalOpen(true);
    };

    return (
        <PageStateWrapper
            loading={loading || !hydrated}
            error={error}
            isEmpty={!doctor && hydrated && !loading}
            emptyTitle="Профиль не найден"
            emptyDescription="Данные профиля не найдены"
            onRetry={refetch}
            loadingText="Загрузка профиля"
        >
            <div className="min-h-screen bg-gray-50">
                <div className="container mx-auto px-4 py-8 space-y-6">
                    {doctor && <DProfileHeader personalInfo={doctor} />}

                    <div className="md:hidden w-full bg-white rounded-xl p-6 flex justify-center">
                        <MyButton
                            onClick={handleEditClick}
                            className="w-full mx-auto bg-primary hover:bg-primary/90 text-white px-6 py-2"
                        >
                            Редактировать профиль
                        </MyButton>
                    </div>

                    {doctor && (
                        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
                            <div className="md:col-span-3 space-y-4 order-1 xl:order-1">
                                <DProfileEducation doctor={doctor} />
                                <DProfileСertificates doctor={doctor} />
                            </div>
                            <div className="xl:col-span-1 space-y-4 order-2 md:order-2">
                                <div className="hidden md:flex w-full bg-white rounded-xl p-6 justify-center">
                                    <MyButton
                                        onClick={handleEditClick}
                                        className="w-full mx-auto bg-primary hover:bg-primary/90 text-white px-6 py-2"
                                    >
                                        Редактировать профиль
                                    </MyButton>
                                </div>
                                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-1 gap-4">
                                    <DProfileSchedule doctor={doctor} />
                                    <DProfileContact contactInfo={doctor} />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Модальное окно редактирования */}
                    {doctor && (
                        <DoctorProfileEditForm
                            doctor={doctor}
                            isOpen={isEditModalOpen}
                            onClose={() => setIsEditModalOpen(false)}
                            onSave={handleSave}
                            refetch={refetch}
                        />
                    )}
                </div>
            </div>
        </PageStateWrapper>
    );
}
