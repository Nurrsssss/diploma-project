import { FaCalendar, FaCalendarPlus, FaEyeSlash, FaFile } from "react-icons/fa"

export const PCommonAppointmentsTabs = [
    {
        label: 'Мои приемы',
        icon: <FaCalendar />,
        value: 'appointment'
    },

    {
        label: 'Мои анкеты',
        icon: <FaFile />,
        value: 'my-analyses'
    },
    {
        label: 'Записаться на прием',
        icon: <FaCalendarPlus />,
        value: 'make-appointment',
        link: '/patient/my-appointments/make'
    },
]