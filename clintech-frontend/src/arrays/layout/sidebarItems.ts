import { FaUserMd, FaHome, FaUser, FaCalendar, FaBrain, FaFileSignature, FaUserPlus } from "react-icons/fa";

type TSidebarItem = {
    label: string;
    href: string;
    icon?: React.ComponentType;
}

export const sidebarItemsByRole: Record<string, TSidebarItem[]> = {
    patient: [
        { label: 'Главная', href: '/', icon: FaHome },
        { label: 'Анкета', href: '/patient/chat', icon: FaBrain },
        { label: 'Мои приёмы', href: '/patient/my-appointments', icon: FaCalendar },
        { label: 'Профиль', href: '/patient/profile', icon: FaUser },
    ],

    doctor: [
        { label: 'Главная', href: '/', icon: FaHome },
        { label: 'Профиль', href: '/doctor/profile', icon: FaUserMd },
        { label: 'График', href: '/doctor/schedule-management', icon: FaCalendar },
        { label: 'Приемы', href: '/doctor/appointments', icon: FaFileSignature },
        { label: 'Создать пациента', href: '/doctor/create-patient', icon: FaUserPlus },
    ],

    reception: [
  { label: 'Главная', href: '/', icon: FaHome },  
  { label: 'График', href: '/reception/schedule-management', icon: FaCalendar },
  { label: 'Расписание врачей', href: '/reception/appointments', icon: FaFileSignature },
  { label: 'Создать пациента', href: '/reception/create-patient', icon: FaUserPlus },
  { label: "Услуги", href: "/reception/services", icon: FaBrain },
],


    default: []
};
