import { useForm, Controller } from "react-hook-form";
import MyInput from "@/components/ui/MyInput";
import MySelect from "@/components/ui/MySelect";
import MyButton from "@/components/ui/MyButton";
import { TScheduleFormValues } from "@/types/calendar";
import { useAuth } from "@/context/AuthContext";
import Loader from "@/components/ui/Loader";
import { useDoctorSchedules } from "@/hooks/schedule/useDoctorSchedules";
import { todayYmdLocal, addDaysYmdLocal } from '@/utils/date';
export default function ScheduleForm({ onSuccess }: { onSuccess?: () => void }) {
    const { hydrated } = useAuth()
    const { createSchedule, creating, error } = useDoctorSchedules()
    const defaultValues: TScheduleFormValues = {
        name: 'Основное расписание',
        work_days: [],
        start_time: '09:00',
        end_time: '17:00',
        break_start: '12:00',
        break_end: '13:00',
        slot_duration: 30,
        slot_title: 'Прием врача',
        appointment_format: 'offline',
        slots_start_date: todayYmdLocal(),
slots_end_date: addDaysYmdLocal(30), // Через 30 дней
    };
    const { register, handleSubmit, control, formState: { errors }, reset } = useForm<TScheduleFormValues>({
        defaultValues: defaultValues
    });

    if (!hydrated) {
        return <Loader />
    }

    const onSubmit = async (data: TScheduleFormValues) => {
        const scheduleData = {
            name: data.name,
            work_days: Array.isArray(data.work_days) ? data.work_days.map(day => Number(day)) : [Number(data.work_days)].filter(Boolean),
            start_time: data.start_time,
            end_time: data.end_time,
            break_start: data.break_start || '',
            break_end: data.break_end || '',
            slot_duration: Number(data.slot_duration),
            slot_title: data.slot_title || '',
            appointment_format: data.appointment_format,
            slots_start_date: data.slots_start_date,
            slots_end_date: data.slots_end_date
        };
        const success = await createSchedule(scheduleData);
        if (success) {
            reset();
            onSuccess?.();
        }
    }

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 my-2 border rounded-lg p-4">
            <h1 className="text-2xl font-bold">Создание расписания</h1>

            {/* Отображение ошибок */}
            {error && (
                <div className="w-full max-w-md mx-auto mb-4 p-3 flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg justify-center text-center">
                    {error}
                </div>
            )}



            <div className="grid sm:grid-cols-2 gap-4">
                <MyInput
                    label="Время начала"
                    type="time"
                    {...register('start_time', { required: 'Время начала обязательно' })}
                    errors={errors.start_time}
                />

                <MyInput
                    label="Время окончания"
                    type="time"
                    {...register('end_time', { required: 'Время окончания обязательно' })}
                    errors={errors.end_time}
                />
            </div>

            {/* Поля перерыва */}
            <div className="space-y-3">
                <h3 className="text-lg font-semibold text-gray-900">Укажите начало и конец перерыва</h3>
                <div className="grid sm:grid-cols-2 gap-4">
                    <MyInput
                        label="Начало перерыва"
                        type="time"
                        {...register('break_start')}
                        errors={errors.break_start}
                    />

                    <MyInput
                        label="Конец перерыва"
                        type="time"
                        {...register('break_end')}
                        errors={errors.break_end}
                    />
                </div>
            </div>

            <Controller
                name="appointment_format"
                control={control}
                rules={{ required: 'Выберите тип приёма' }}
                render={({ field }) => (
                    <MySelect
                        label="Тип приёма"
                        options={[
                            { label: "Любой", value: "both" },
                            { label: "Офлайн", value: "offline" },
                            { label: "Онлайн", value: "online" }
                        ]}
                        onChange={field.onChange}
                        value={field.value}
                        errors={errors.appointment_format}
                    />
                )}
            />

            <Controller
                name="work_days"
                control={control}
                rules={{ required: 'Выберите рабочие дни' }}
                render={({ field }) => (
                    <MySelect
                        label="Рабочие дни"
                        multiple
                        options={[
                            { label: "Понедельник", value: "1" },
                            { label: "Вторник", value: "2" },
                            { label: "Среда", value: "3" },
                            { label: "Четверг", value: "4" },
                            { label: "Пятница", value: "5" },
                            { label: "Суббота", value: "6" },
                            { label: "Воскресенье", value: "7" }
                        ]}
                        onChange={field.onChange}
                        value={Array.isArray(field.value) ? field.value.map(String) : []}
                        errors={errors.work_days}
                    />
                )}
            />

            <div className="grid sm:grid-cols-1 gap-4">
                <MyInput
                    label="Длительность приема (минуты)"
                    type="number"
                    {...register('slot_duration', {
                        required: 'Длительность обязательна',
                        valueAsNumber: true,
                        min: { value: 10, message: 'Минимум 10 минут' }
                    })}
                    errors={errors.slot_duration}
                />

                {/* <MyInput
                    label="Название приема"
                    placeholder="Например, Консультация"
                    {...register('slot_title', { required: 'Название приема обязательно' })}
                    errors={errors.slot_title}
                /> */}
            </div>

            {/* Обязательные поля для дат */}
            <div className="border-t pt-4">
                <h3 className="text-lg font-semibold">Период создания приемов</h3>
                <p className="text-sm text-gray-600 mb-2">
                    Укажите период, на который будут созданы приемы
                </p>
                
                <div className="grid sm:grid-cols-2 gap-4">
                    <MyInput
                        label="Дата начала"
                        type="date"
                        {...register('slots_start_date', { 
                            required: 'Дата начала обязательна' 
                        })}
                        errors={errors.slots_start_date}
                    />

                    <MyInput
                        label="Дата окончания"
                        type="date"
                        {...register('slots_end_date', { 
                            required: 'Дата окончания обязательна' 
                        })}
                        errors={errors.slots_end_date}
                    />
                </div>
            </div>

            <MyButton
                type="submit"
                className="text-xl py-2 w-full bg-primary hover:bg-primary/90 text-white"
                disabled={creating}
            >
                {creating ? 'Создание расписания...' : 'Создать расписание'}
            </MyButton>
        </form>
    );
}