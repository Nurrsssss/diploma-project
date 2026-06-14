import { FaCalendar, FaEyeSlash, FaFilePdf, FaUser, FaUserMd } from "react-icons/fa";

export const DAppointmentsTabs: { label: string, value: string, icon: React.ReactNode }[] = [
    {
        label: 'Данные пациента',
        value: 'patientData',
        icon: <FaUser />
    },
    // {
    //     label: 'Данные врача',
    //     value: 'doctorData',
    //     icon: <FaUserMd />
    // },
    {
        label: 'Анкета пациента',
        value: 'anketa',
        icon: <FaFilePdf />
    },
    {
        label: 'Данные приёма',
        value: 'appointmentData',
        icon: <FaCalendar />
    },
    {
        label: 'Файлы приёма',
        value: 'appointmentFiles',
        icon: <FaFilePdf />
    },
]