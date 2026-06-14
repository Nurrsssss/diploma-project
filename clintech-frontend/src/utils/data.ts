import { TDoctor } from "@/types/doctors";
import { TPatient } from "@/types/patient";

export const getFullName = (person: TPatient | TDoctor): string => {
    const lastName = person?.last_name || '';
    const firstName = person?.first_name || '';
    const middleName = person?.middle_name || '';

    return [lastName, firstName, middleName].filter(Boolean).join(' ');
};


// Получение текста пола
export const getGenderText = (gender: string | undefined | null): string => {
    const genderMap: Record<string, string> = {
        'male': 'Мужской',
        'female': 'Женский'
    };
    return genderMap[gender || ''] || 'Не указано';
};

// Функция для получения текста физической активности
export const getActivityText = (activity: string | undefined | null): string => {
    const activityMap: Record<string, string> = {
        'low': 'Низкий',
        'medium': 'Средний',
        'high': 'Высокий'
    };
    return activityMap[activity || ''] || 'Не указано';
};