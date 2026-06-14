'use client';

import { useForm, Controller } from 'react-hook-form';
import { useEffect } from 'react';

import MyInput from '@/components/ui/MyInput';
import MySelect from '@/components/ui/MySelect';
import MyButton from '@/components/ui/MyButton';
import Loader from '@/components/ui/Loader';

import { TScheduleFormValues, TScheduleDay } from '@/types/calendar';
import { TDoctorSchedule } from '@/types/doctorShedules';
import { todayYmdLocal, addDaysYmdLocal } from '@/utils/date';
import { useAuth } from '@/context/AuthContext';
import { useDoctorSchedules } from '@/hooks/schedule/useDoctorSchedules';

import { FaCalendar, FaClock, FaTimes, FaEdit, FaPlus } from 'react-icons/fa';

const DAYS_OF_WEEK = [
  { value: 1, label: 'Понедельник' },
  { value: 2, label: 'Вторник' },
  { value: 3, label: 'Среда' },
  { value: 4, label: 'Четверг' },
  { value: 5, label: 'Пятница' },
  { value: 6, label: 'Суббота' },
  { value: 7, label: 'Воскресенье' },
];

interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingSchedule?: TDoctorSchedule | null;

  // для reception
  doctorUserId?: string | null;
}

export default function ScheduleModal({
  isOpen,
  onClose,
  onSuccess,
  editingSchedule,
  doctorUserId,
}: ScheduleModalProps) {
  const { hydrated } = useAuth();
  const { createSchedule, updateSchedule, creating, updating, error } = useDoctorSchedules();

  const isEditing = !!editingSchedule;

  const defaultValues: TScheduleFormValues = {
    name: 'Основное расписание',
    slot_duration: 30,
    slot_title: 'Прием врача',
    appointment_format: 'offline',
    slots_start_date: todayYmdLocal(),
    slots_end_date: addDaysYmdLocal(30),
    days: DAYS_OF_WEEK.map((day) => ({
      day_of_week: day.value,
      start_time: '09:00',
      end_time: '17:00',
      break_start: '12:00',
      break_end: '13:00',
      is_working_day: day.value >= 1 && day.value <= 5,
    })),
  };

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
    reset,
  } = useForm<TScheduleFormValues>({
    defaultValues,
  });

  const watchedDays = watch('days');

  useEffect(() => {
    if (!isOpen) return;

    if (isEditing && editingSchedule) {
      const fullDays = DAYS_OF_WEEK.map((day) => {
        const existingDay = editingSchedule.days?.find((d) => d.day_of_week === day.value);

        if (existingDay) {
          return {
            ...existingDay,
            break_start: existingDay.break_start ?? '',
            break_end: existingDay.break_end ?? '',
          };
        }

        return {
          day_of_week: day.value,
          start_time: '09:00',
          end_time: '17:00',
          break_start: '',
          break_end: '',
          is_working_day: false,
        };
      });

      const scheduleData: TScheduleFormValues = {
        name: editingSchedule.name || 'Основное расписание',
        slot_duration: Number(editingSchedule.slot_duration) || 30,
        slot_title: editingSchedule.slot_title || 'Прием врача',
        appointment_format: (editingSchedule.appointment_format as 'offline' | 'online' | 'both') || 'offline',
        slots_start_date: editingSchedule.slots_start_date || todayYmdLocal(),
        slots_end_date: editingSchedule.slots_end_date || addDaysYmdLocal(30),
        days: fullDays,
      };

      reset(scheduleData);
    } else {
      reset(defaultValues);
    }
  }, [isOpen, isEditing, editingSchedule, reset]);

  if (!hydrated) {
    return <Loader />;
  }

  const updateDay = (dayIndex: number, field: keyof TScheduleDay, value: any) => {
    const currentDays = watchedDays || [];
    if (!currentDays[dayIndex]) return;

    const newDays = [...currentDays];
    newDays[dayIndex] = {
      ...newDays[dayIndex],
      [field]: value,
    };

    setValue('days', newDays, { shouldDirty: true });
  };

  const toggleWorkingDay = (dayIndex: number) => {
    const currentDays = watchedDays || [];
    if (!currentDays[dayIndex]) return;

    const newDays = [...currentDays];
    newDays[dayIndex] = {
      ...newDays[dayIndex],
      is_working_day: !newDays[dayIndex].is_working_day,
    };

    setValue('days', newDays, { shouldDirty: true });
  };

  const toggleBreak = (dayIndex: number) => {
    const currentDays = watchedDays || [];
    if (!currentDays[dayIndex]) return;

    const newDays = [...currentDays];
    const currentDay = newDays[dayIndex];
    const hasBreak = Boolean(currentDay.break_start && currentDay.break_end);

    newDays[dayIndex] = {
      ...currentDay,
      break_start: hasBreak ? '' : '12:00',
      break_end: hasBreak ? '' : '13:00',
    };

    setValue('days', newDays, { shouldDirty: true });
  };

  const onSubmit = async (data: TScheduleFormValues) => {
    const allDays = (data.days || [])
      .map((d) => {
        const hasBreak = Boolean(d.break_start && d.break_end);

        return {
          ...d,
          day_of_week: Number(d.day_of_week),
          break_start: hasBreak ? d.break_start : null,
          break_end: hasBreak ? d.break_end : null,
        };
      })
      .sort((a, b) => a.day_of_week - b.day_of_week);

    const workDays = allDays
      .filter((d) => d.is_working_day)
      .map((d) => d.day_of_week);

    const scheduleData: any = {
      name: data.name,
      slot_duration: Number(data.slot_duration),
      slot_title: data.slot_title || '',
      appointment_format: data.appointment_format,
      slots_start_date: data.slots_start_date,
      slots_end_date: data.slots_end_date,
      work_days: workDays,
      days: allDays,
    };

    const targetDoctor = doctorUserId ?? undefined;

    if (isEditing && editingSchedule?.id) {
      scheduleData.id = editingSchedule.id;

      const success = await updateSchedule(editingSchedule.id, scheduleData, targetDoctor);
      if (success) {
        onSuccess();
        onClose();
      }
      return;
    }

    const success = await createSchedule(scheduleData, targetDoctor);
    if (success) {
      onSuccess();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-primary/10 to-blue-100 rounded-xl flex items-center justify-center">
              {isEditing ? (
                <FaEdit className="text-primary" size={18} />
              ) : (
                <FaPlus className="text-primary" size={18} />
              )}
            </div>
            <h2 className="text-2xl font-bold text-gray-900">
              {isEditing ? 'Редактирование расписания' : 'Создание расписания'}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors"
          >
            <FaTimes className="text-gray-500" size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
          {error && (
            <div className="w-full p-3 flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg justify-center text-center">
              {error}
            </div>
          )}

          <div>
            <h3 className="w-fit mx-auto mb-6 text-lg font-semibold flex items-center gap-2">
              <FaCalendar className="text-primary" />
              Выбор рабочих дней
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {DAYS_OF_WEEK.map((day) => {
                const dayIndex = watchedDays?.findIndex((d) => d.day_of_week === day.value) ?? -1;
                const dayData = dayIndex >= 0 ? watchedDays?.[dayIndex] : undefined;
                const isWorking = dayData?.is_working_day || false;

                return (
                  <div key={day.value} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={isWorking}
                      onChange={() => dayIndex >= 0 && toggleWorkingDay(dayIndex)}
                      className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                    />
                    <span className="text-sm font-medium">{day.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="text-lg font-semibold mb-3">Основные настройки</h3>

            <div className="grid sm:grid-cols-2 gap-4">
              <Controller
                name="appointment_format"
                control={control}
                rules={{ required: 'Выберите тип приёма' }}
                render={({ field }) => (
                  <MySelect
                    label="Тип приёма"
                    options={[
                      { label: 'Любой', value: 'both' },
                      { label: 'Офлайн', value: 'offline' },
                      { label: 'Онлайн', value: 'online' },
                    ]}
                    onChange={field.onChange}
                    value={field.value}
                    errors={errors.appointment_format}
                  />
                )}
              />

              <MyInput
                label="Длительность приема (минуты)"
                type="number"
                {...register('slot_duration', {
                  required: 'Длительность обязательна',
                  valueAsNumber: true,
                  min: { value: 10, message: 'Минимум 10 минут' },
                })}
                errors={errors.slot_duration}
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <MyInput
                label="Дата начала"
                type="date"
                {...register('slots_start_date', { required: 'Дата начала обязательна' })}
                errors={errors.slots_start_date}
              />

              <MyInput
                label="Дата окончания"
                type="date"
                {...register('slots_end_date', { required: 'Дата окончания обязательна' })}
                errors={errors.slots_end_date}
              />
            </div>
          </div>
<div className="border-t pt-4">
  <h3 className="w-fit mx-auto text-lg font-semibold mb-1 flex items-center gap-2">
    <FaClock className="text-primary" />
    Настройка времени
  </h3>
  <p className="text-sm text-center text-gray-600 mb-4">
    Настройте рабочие часы для выбранных дней
  </p>

  <div className="space-y-4">
    {watchedDays
      ?.filter((day) => day.is_working_day)
      .map((day) => {
        const originalIndex = watchedDays.findIndex(
          (d) => d.day_of_week === day.day_of_week
        );

        const hasBreak = Boolean(day.break_start || day.break_end);

        return (
          <div
            key={day.day_of_week}
            className="border shadow-md border-gray-200 rounded-lg p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="font-medium text-lg">
                {DAYS_OF_WEEK.find((d) => d.value === day.day_of_week)?.label}
              </span>
              <span className="text-sm text-green-600 bg-green-50 px-2 py-1 rounded">
                Рабочий день
              </span>
            </div>

            <div className="space-y-3">
              <div className="grid sm:grid-cols-2 gap-4">
                <MyInput
                  label="Время начала"
                  type="time"
                  value={day.start_time}
                  onChange={(e) =>
                    updateDay(originalIndex, 'start_time', e.target.value)
                  }
                />

                <MyInput
                  label="Время окончания"
                  type="time"
                  value={day.end_time}
                  onChange={(e) =>
                    updateDay(originalIndex, 'end_time', e.target.value)
                  }
                />
              </div>

              {!hasBreak ? (
                <MyButton
                  type="button"
                  onClick={() => {
                    updateDay(originalIndex, 'break_start', '12:00');
                    updateDay(originalIndex, 'break_end', '13:00');
                  }}
                  className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200"
                >
                  Добавить время обеда
                </MyButton>
              ) : (
                <>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <MyInput
                      label="Начало обеда"
                      type="time"
                      value={day.break_start || ''}
                      onChange={(e) =>
                        updateDay(originalIndex, 'break_start', e.target.value)
                      }
                    />

                    <MyInput
                      label="Конец обеда"
                      type="time"
                      value={day.break_end || ''}
                      onChange={(e) =>
                        updateDay(originalIndex, 'break_end', e.target.value)
                      }
                    />
                  </div>

                  <MyButton
                    type="button"
                    onClick={() => {
                      updateDay(originalIndex, 'break_start', '');
                      updateDay(originalIndex, 'break_end', '');
                    }}
                    className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200"
                  >
                    Удалить
                  </MyButton>
                </>
              )}
            </div>
          </div>
        );
      })}
  </div>
</div>

<div className="flex gap-3 pt-4 border-t">
  <MyButton
    type="submit"
    className="flex-1 bg-primary hover:bg-primary/90 text-white py-3"
    disabled={creating || updating}
  >
    {creating || updating
      ? isEditing
        ? 'Сохранение...'
        : 'Создание...'
      : isEditing
      ? 'Сохранить изменения'
      : 'Создать расписание'}
  </MyButton>

  <MyButton
    type="button"
    onClick={onClose}
    className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700"
  >
    Отмена
  </MyButton>
</div>
        </form>
      </div>
    </div>
  );
}