'use client';

export default function DoctorMyAppointmentsView({ doctorId }: { doctorId: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="text-lg font-semibold text-gray-900">Редактирование расписания</div>
      <div className="text-gray-600 mt-2">
        Компонент создан. Дальше подключим существующий UI доктора для doctorId:
        <span className="font-mono"> {doctorId}</span>
      </div>
    </div>
  );
}
