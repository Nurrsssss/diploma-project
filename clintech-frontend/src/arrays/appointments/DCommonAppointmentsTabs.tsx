import { FaCalendar, FaEyeSlash, FaHistory, FaClock } from "react-icons/fa"

export const DCommonAppointmentsTabs = [
    {
        label: 'Мои приемы',
        icon: <FaCalendar />,
        value: 'appointment'
    },
    {
        label: 'История приемов',
        icon: <FaHistory />,
        value: 'past-appointments'
    },
    {
        label: 'Создать расписание',
        icon: <FaCalendar />,
        value: 'schedule'
    },
    {
        label: 'Управление расписанием',
        icon: <FaClock />,
        value: 'schedule-management'
    },
    // Временно скрыто - Активные расписания
    // {
    //     label: 'Активные расписания',
    //     icon: <FaCalendar />,
    //     value: 'active-schedule'
    // },
]