'use client';

import React, { useState } from 'react';
import { X, Calendar, Clock } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useAppointmentExceptions, CreateExceptionData } from '@/hooks/appointment/useAppointmentExceptions';
import MyButton from '@/components/ui/MyButton';
import MyInput from '@/components/ui/MyInput';
import ErrorMessage from '@/components/ui/ErrorMessage';

interface CreateExceptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  doctorUserId?: string; // ✅ важно для reception
}

interface FormData {
  type: 'day_off' | 'custom_hours';
  date: string;
  start_date?: string;
  end_date?: string;
  custom_start_time?: string;
  custom_end_time?: string;
  reason: string;
}

const CreateExceptionModal: React.FC<CreateExceptionModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  doctorUserId,
}) => {
  const [isDateRange, setIsDateRange] = useState(false);
  const { createException, loading, error, clearError } = useAppointmentExceptions();

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      type: 'day_off',
      date: new Date().toISOString().split('T')[0],
      reason: '',
    },
  });

  const watchType = watch('type');

  const onSubmit = async (data: FormData) => {
    clearError();

    const createData: CreateExceptionData = {
      type: data.type,
      reason: data.reason,
    };

    if (isDateRange && data.start_date && data.end_date) {
      createData.start = data.start_date;
      createData.end = data.end_date;
    } else {
      createData.date = data.date;
    }

    if (data.type === 'custom_hours') {
      createData.custom_start_time = data.custom_start_time;
      createData.custom_end_time = data.custom_end_time;
    }

    // ✅ передаем doctorUserId в хук
    const success = await createException(createData, doctorUserId);
    if (success) {
      reset();
      setIsDateRange(false);
      onSuccess();
    }
  };

  const handleClose = () => {
    reset();
    setIsDateRange(false);
    clearError();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={handleClose}></div>

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Создать закрытие</h2>
            <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
              <X className="h-6 w-6" />
            </button>
          </div>

          {error && (
            <ErrorMessage message={error} variant="error" onClose={clearError} className="mb-4" />
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Тип закрытия</label>
              <div className="grid grid-cols-2 gap-2">
                <label
                  className={`flex items-center p-3 border rounded-lg cursor-pointer ${
                    watchType === 'day_off' ? 'border-primary bg-primary/5' : 'border-gray-300'
                  }`}
                >
                  <input type="radio" value="day_off" {...register('type')} className="sr-only" />
                  <Calendar className="h-5 w-5 mr-2 text-red-500" />
                  <span className="text-sm">Весь день</span>
                </label>

                <label
                  className={`flex items-center p-3 border rounded-lg cursor-pointer ${
                    watchType === 'custom_hours' ? 'border-primary bg-primary/5' : 'border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    value="custom_hours"
                    {...register('type')}
                    className="sr-only"
                  />
                  <Clock className="h-5 w-5 mr-2 text-orange-500" />
                  <span className="text-sm">Часы</span>
                </label>
              </div>
            </div>

            {watchType === 'day_off' && (
              <div>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={isDateRange}
                    onChange={(e) => setIsDateRange(e.target.checked)}
                    className="rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-gray-700">Диапазон дат</span>
                </label>
              </div>
            )}

            {isDateRange ? (
              <div className="grid grid-cols-2 gap-4">
                <MyInput
                  label="Начальная дата"
                  type="date"
                  errors={errors.start_date}
                  {...register('start_date', { required: 'Выберите начальную дату' })}
                />
                <MyInput
                  label="Конечная дата"
                  type="date"
                  errors={errors.end_date}
                  {...register('end_date', { required: 'Выберите конечную дату' })}
                />
              </div>
            ) : (
              <MyInput
                label="Дата"
                type="date"
                errors={errors.date}
                {...register('date', { required: 'Выберите дату' })}
              />
            )}

            {watchType === 'custom_hours' && (
              <div className="grid grid-cols-2 gap-4">
                <MyInput
                  label="Время начала"
                  type="time"
                  errors={errors.custom_start_time}
                  {...register('custom_start_time', { required: 'Выберите время начала' })}
                />
                <MyInput
                  label="Время окончания"
                  type="time"
                  errors={errors.custom_end_time}
                  {...register('custom_end_time', { required: 'Выберите время окончания' })}
                />
              </div>
            )}

            <MyInput
              label="Причина закрытия"
              placeholder="Например: отпуск, совещание, встреча"
              errors={errors.reason}
              {...register('reason', {
                required: 'Укажите причину закрытия',
                minLength: { value: 3, message: 'Минимум 3 символа' },
              })}
            />

            <div className="flex space-x-3 pt-4">
              <MyButton
                type="button"
                onClick={handleClose}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800"
              >
                Отмена
              </MyButton>
              <MyButton
                type="submit"
                disabled={loading}
                className="flex-1 bg-primary hover:bg-primary/90 text-white"
              >
                {loading ? 'Создание...' : 'Создать'}
              </MyButton>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateExceptionModal;
