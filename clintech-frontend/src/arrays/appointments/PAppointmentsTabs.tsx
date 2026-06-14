import { FaCalendar, FaFilePdf, FaUser } from "react-icons/fa";

export const PAppointmentsTabs: { label: string, value: string, icon: React.ReactNode }[] = [
    { label: 'Мои данные', value: 'patient', icon: <FaUser /> },
    { label: 'Данные приёма', value: 'appointment', icon: <FaCalendar /> },
    // { label: 'Данные врача', value: 'doctor', icon: <FaUser /> },
    { label: 'Данные анкеты', value: 'anketa', icon: <FaFilePdf /> },
    { label: 'Файлы приёма', value: 'files', icon: <FaFilePdf /> },
];