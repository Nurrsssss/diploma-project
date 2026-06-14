'use client'
import { useForm } from 'react-hook-form'
import { TPatient } from '@/types/patient'
import MyButton from '@/components/ui/MyButton'
import Modal from '@/components/ui/Modal'
import ErrorMessage from '@/components/ui/ErrorMessage'
import { useEffect, useCallback, useState } from 'react'
import { toEmptyIfEmpty, toNullIfEmpty, toArray } from '@/utils/formUtils'
import { useFormError } from '@/hooks/form/useFormError'
import PProfileFormGeneral from './PProfileFormGeneral'
import PProfileFormMed from './PProfileFormMed'

interface PatientProfileFormProps {
    patient: TPatient;
    isOpen: boolean;
    onClose: () => void;
    updatePatient: (data: TPatient) => Promise<boolean>;
    updating: boolean;
    refetch: () => void;
}

export default function PatientProfileForm({
    patient, isOpen, onClose, updatePatient, refetch, updating
}: PatientProfileFormProps) {

    const { formError, handleError, clearError } = useFormError();
    const [saving, setSaving] = useState(false);

    const { register, handleSubmit, formState: { errors }, control, reset} = useForm<TPatient>({
        defaultValues: {
            ...patient,
            date_of_birth: patient?.date_of_birth ? new Date(patient.date_of_birth).toISOString().split('T')[0] : ''
        }
    });

    const onSubmit = useCallback(async (data: TPatient) => {
        clearError();
        setSaving(true);
        try {
            const dataToSend = {
                ...data,
                avatar_url: data.avatar_url,
                first_name: data.first_name,
                last_name: data.last_name,
                email: data.email,
                date_of_birth: data.date_of_birth,
                height: data.height,
                weight: data.weight,
                gender: data.gender,
                middle_name: data.middle_name,
                iin: toNullIfEmpty(data.iin),
                phone: toNullIfEmpty(data.phone),
                address: toEmptyIfEmpty(data.address),
                phys_activity: toEmptyIfEmpty(data.phys_activity),
                diagnoses: toArray(data.diagnoses),
                allergens: toArray(data.allergens),
                diet: toArray(data.diet),
            };
            const success = await updatePatient(dataToSend);
            if (success) {
                onClose();
                refetch();
            }
        } catch (error: any) {
            handleError(error, {
                400: 'Некорректные данные. Проверьте заполнение формы.',
                401: 'Ошибка авторизации. Пожалуйста, войдите заново.',
                500: 'Техническая ошибка сервера. Попробуйте позже.'
            });
        } finally {
            setSaving(false);
        }
    }, [updatePatient, onClose, refetch, handleError, clearError]);

    // Обновляем форму когда приходят новые данные пациента
    useEffect(() => {
        const formData = {
            ...patient,
            date_of_birth: patient?.date_of_birth ? new Date(patient.date_of_birth).toISOString().split('T')[0] : ''
        };
        reset(formData);
    }, [patient, reset]);

    // Сброс формы при закрытии
    const handleClose = () => {
        reset();
        clearError();
        onClose();
    };


    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            title="Редактировать профиль"
            size="xl"
        >
            <div className="p-6">
                {formError && (
                    <ErrorMessage
                        message={formError}
                        variant="error"
                        className="mb-6"
                        onClose={clearError}
                    />
                )}

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">

                    {/* Персональная информация */}
                    <PProfileFormGeneral
                        register={register}
                        errors={errors}
                        control={control}
                    />

                    {/* Медицинская информация */}
                    <PProfileFormMed
                        register={register}
                        errors={errors}
                        control={control}
                    />

                    {/* Кнопки действий */}
                    <div className="md:px-6 flex gap-4">
                        <MyButton
                            type="submit"
                            disabled={saving || updating}
                            className="text-lg bg-primary text-white shadow-md hover:bg-primary/90"
                        >
                            {saving ? 'Сохранение...' : 'Сохранить'}
                        </MyButton>

                        <MyButton
                            type="button"
                            onClick={handleClose}
                            className="bg-gray-500 text-white text-lg shadow-md hover:bg-gray-600"
                        >
                            Отменить
                        </MyButton>
                    </div>
                </form>
            </div>
        </Modal>
    );
} 