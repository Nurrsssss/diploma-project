'use client';

import { useState } from 'react';
import { useAuthenticatedFetch } from '@/hooks/auth/useAuthenticatedFetch';

type CreateDoctorModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
};

export default function CreateDoctorModal({
  open,
  onClose,
  onCreated,
}: CreateDoctorModalProps) {
  const authenticatedFetch = useAuthenticatedFetch();

  const [form, setForm] = useState({
    first_name: '',
    middle_name: '',
    last_name: '',
    phone: '',
    email: '',
    description: '',
    avatar_url: '',
    roles: '',
    price: 0,
    education: '',
    certificates: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parseList = (value: string) =>
    value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

  const handleChange = (field: string, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!form.last_name.trim()) {
        throw new Error('Введите фамилию');
      }

      if (!form.first_name.trim()) {
        throw new Error('Введите имя');
      }

      if (!form.phone.trim()) {
        throw new Error('Введите телефон');
      }

      if (!form.roles.trim()) {
        throw new Error('Введите специализацию');
      }

      const payload = {
        first_name: form.first_name.trim(),
        middle_name: form.middle_name.trim(),
        last_name: form.last_name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        description: form.description.trim(),
        avatar_url: form.avatar_url.trim(),
        roles: parseList(form.roles),
        price: Number(form.price || 0),
        education: parseList(form.education),
        certificates: parseList(form.certificates),
      };

      console.log('CREATE DOCTOR payload:', payload);

      const res = await authenticatedFetch('/api/doctors/reception', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const text = await res.text();
      console.log('CREATE DOCTOR status:', res.status);
      console.log('CREATE DOCTOR response:', text);

      if (!res.ok) {
        throw new Error(text || 'Не удалось создать врача');
      }

      alert('Врач создан. Пароль по умолчанию: Clintech1234');
      onCreated?.();
      onClose();
    } catch (e: any) {
      setError(e.message || 'Ошибка создания');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 space-y-4">
        <h2 className="text-xl font-semibold">Добавить врача</h2>

        {error && <div className="text-red-600">{error}</div>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            value={form.last_name}
            onChange={(e) => handleChange('last_name', e.target.value)}
            placeholder="Фамилия *"
            className="w-full border rounded-xl px-4 py-3"
          />
          <input
            value={form.first_name}
            onChange={(e) => handleChange('first_name', e.target.value)}
            placeholder="Имя *"
            className="w-full border rounded-xl px-4 py-3"
          />
          <input
            value={form.middle_name}
            onChange={(e) => handleChange('middle_name', e.target.value)}
            placeholder="Отчество"
            className="w-full border rounded-xl px-4 py-3"
          />
          <input
            value={form.phone}
            onChange={(e) => handleChange('phone', e.target.value)}
            placeholder="Начните с +7… *"
            className="w-full border rounded-xl px-4 py-3"
          />
          <input
            value={form.email}
            onChange={(e) => handleChange('email', e.target.value)}
            placeholder="Email"
            className="w-full border rounded-xl px-4 py-3"
          />
          <input
            value={form.avatar_url}
            onChange={(e) => handleChange('avatar_url', e.target.value)}
            placeholder="Avatar URL"
            className="w-full border rounded-xl px-4 py-3"
          />
          <input
            type="number"
            value={form.price}
            onChange={(e) => handleChange('price', Number(e.target.value))}
            placeholder="Цена"
            className="w-full border rounded-xl px-4 py-3"
          />
          <input
            value={form.roles}
            onChange={(e) => handleChange('roles', e.target.value)}
            placeholder="Специализации через запятую *"
            className="w-full border rounded-xl px-4 py-3"
          />
        </div>

        <textarea
          value={form.description}
          onChange={(e) => handleChange('description', e.target.value)}
          placeholder="Описание"
          className="w-full border rounded-xl px-4 py-3 min-h-[100px]"
        />

        <textarea
          value={form.education}
          onChange={(e) => handleChange('education', e.target.value)}
          placeholder="Образование через запятую"
          className="w-full border rounded-xl px-4 py-3 min-h-[80px]"
        />

        <textarea
          value={form.certificates}
          onChange={(e) => handleChange('certificates', e.target.value)}
          placeholder="Сертификаты через запятую"
          className="w-full border rounded-xl px-4 py-3 min-h-[80px]"
        />

        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-3 rounded-xl border"
          >
            Отмена
          </button>
          <button
          type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="px-5 py-3 rounded-xl bg-primary text-white disabled:opacity-50"
          >
            {loading ? 'Создание...' : 'Создать'}
          </button>
        </div>
      </div>
    </div>
  );
}