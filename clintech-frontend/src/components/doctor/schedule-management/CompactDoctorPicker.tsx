'use client';

import React, { useMemo, useState } from 'react';
import { TDoctor } from '@/types/doctors';

type Props = {
  doctors: TDoctor[];
  selectedDoctorId: string | null;
  onSelectDoctor: (id: string) => void;
  allDoctorsId: string; // '__ALL_DOCTORS__'
};

function doctorLabel(d: TDoctor) {
  const last = d.last_name?.trim() ?? '';
  const first = d.first_name?.trim() ?? '';
  const mid = d.middle_name?.trim() ?? '';
  const fio = [last, first, mid].filter(Boolean).join(' ');
  return fio || d.email || d.phone || `Врач ${d.id}`;
}

export default function CompactDoctorPicker({
  doctors,
  selectedDoctorId,
  onSelectDoctor,
  allDoctorsId,
}: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');

  const selectedLabel = useMemo(() => {
    if (!selectedDoctorId || selectedDoctorId === allDoctorsId) return 'Все врачи';
    const doc = doctors.find((d) => String(d.id) === String(selectedDoctorId));
    return doc ? doctorLabel(doc) : 'Выберите врача';
  }, [selectedDoctorId, doctors, allDoctorsId]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return doctors;
    return doctors.filter((d) => doctorLabel(d).toLowerCase().includes(query));
  }, [doctors, q]);

  return (
    <div className="bg-white rounded-xl shadow-sm p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-gray-600">
          Режим: <span className="font-semibold text-gray-900">{selectedLabel}</span>
        </div>

        <div className="relative">
          <button
            type="button"
            className="px-3 py-2 rounded-lg border text-sm hover:bg-gray-50 flex items-center gap-2"
            onClick={() => setOpen((v) => !v)}
          >
            Выбрать
            <span className="text-gray-400">▾</span>
          </button>

          {open && (
            <div className="absolute right-0 mt-2 w-[320px] bg-white border rounded-xl shadow-lg z-50 p-2">
              <div className="flex gap-2 mb-2">
                <input
                  className="w-full px-3 py-2 text-sm border rounded-lg"
                  placeholder="Поиск врача…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
                <button
                  type="button"
                  className="px-3 py-2 text-sm rounded-lg border hover:bg-gray-50"
                  onClick={() => {
                    onSelectDoctor(allDoctorsId);
                    setOpen(false);
                    setQ('');
                  }}
                >
                  Все
                </button>
              </div>

              <div className="max-h-[320px] overflow-auto">
                {filtered.map((d) => (
                  <button
                    key={String(d.id)}
                    type="button"
                    className={[
                      'w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-gray-50',
                      String(selectedDoctorId) === String(d.id) ? 'bg-gray-100' : '',
                    ].join(' ')}
                    onClick={() => {
                      onSelectDoctor(String(d.id));
                      setOpen(false);
                      setQ('');
                    }}
                  >
                    <div className="font-medium text-gray-900 truncate">{doctorLabel(d)}</div>
                    {Array.isArray((d as any).roles) && (d as any).roles.length > 0 && (
                      <div className="text-xs text-gray-500 truncate">{(d as any).roles.join(', ')}</div>
                    )}
                  </button>
                ))}

                {!filtered.length && (
                  <div className="px-3 py-6 text-sm text-gray-500 text-center">Ничего не найдено</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}