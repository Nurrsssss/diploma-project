'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthenticatedFetch } from '@/hooks/auth/useAuthenticatedFetch';

type DoctorProfileManagementProps = {
  doctorId: string;
  onDeleted?: () => void;
  onSaved?: () => void;
};

type DoctorManagementResponse = {
  id: string;
  user_id: string;
  first_name: string;
  middle_name: string;
  last_name: string;
  phone: string;
  email: string;
  description: string;
  avatar_url: string;
  roles: string[];
  price: number;
  education: string[];
  certificates: string[];
};

export default function DoctorProfileManagement({
  doctorId,
  onDeleted,
  onSaved,
}: DoctorProfileManagementProps) {
  const authenticatedFetch = useAuthenticatedFetch();
  const router = useRouter();

  const [form, setForm] = useState<DoctorManagementResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rolesInput, setRolesInput] = useState('');
  const [educationInput, setEducationInput] = useState('');
  const [certificatesInput, setCertificatesInput] = useState('');

  useEffect(() => {
    const fetchDoctor = async () => {
      if (!doctorId || doctorId === 'undefined') {
        setError('Некорректный doctorId');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const res = await authenticatedFetch(`/api/doctors/${doctorId}/management`, {
          method: 'GET',
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || 'Не удалось загрузить профиль врача');
        }

        const data = await res.json();

        setForm({
          id: data.id,
          user_id: data.user_id,
          first_name: data.first_name || '',
          middle_name: data.middle_name || '',
          last_name: data.last_name || '',
          phone: data.phone || '',
          email: data.email || '',
          description: data.description || '',
          avatar_url: data.avatar_url || '',
          roles: Array.isArray(data.roles) ? data.roles : [],
          price: Number(data.price || 0),
          education: Array.isArray(data.education) ? data.education : [],
          certificates: Array.isArray(data.certificates) ? data.certificates : [],
        });

        setRolesInput(Array.isArray(data.roles) ? data.roles.join(', ') : '');
        setEducationInput(Array.isArray(data.education) ? data.education.join(', ') : '');
        setCertificatesInput(Array.isArray(data.certificates) ? data.certificates.join(', ') : '');
      } catch (e: any) {
        setError(e.message || 'Ошибка загрузки профиля');
      } finally {
        setLoading(false);
      }
    };

    fetchDoctor();
  }, [doctorId, authenticatedFetch]);

  const handleChange = (field: keyof DoctorManagementResponse, value: string | number) => {
    if (!form) return;
    setForm({ ...form, [field]: value });
  };

  const parseList = (value: string) =>
    value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

  const handleSave = async () => {
    if (!form || !doctorId || doctorId === 'undefined') return;

    try {
      setSaving(true);
      setError(null);

      const payload = {
        first_name: form.first_name,
        middle_name: form.middle_name,
        last_name: form.last_name,
        phone: form.phone,
        email: form.email,
        description: form.description,
        avatar_url: form.avatar_url,
        roles: parseList(rolesInput),
        price: Number(form.price || 0),
        education: parseList(educationInput),
        certificates: parseList(certificatesInput),
      };

      const res = await authenticatedFetch(`/api/doctors/${doctorId}/reception`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Не удалось сохранить врача');
      }

      onSaved?.();
      alert('Данные врача сохранены');
    } catch (e: any) {
      setError(e.message || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!doctorId || doctorId === 'undefined') return;

    const confirmed = window.confirm('Удалить врача? Это действие необратимо.');
    if (!confirmed) return;

    try {
      setDeleting(true);
      setError(null);

      const res = await authenticatedFetch(`/api/doctors/${doctorId}/reception`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Не удалось удалить врача');
      }

      alert('Врач удален');
      onDeleted?.();
      router.refresh();
    } catch (e: any) {
      setError(e.message || 'Ошибка удаления');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return <div className="bg-white rounded-xl shadow-sm p-6">Загрузка профиля...</div>;
  }

  if (error && !form) {
    return <div className="bg-white rounded-xl shadow-sm p-6 text-red-600">{error}</div>;
  }

  if (!form) {
    return <div className="bg-white rounded-xl shadow-sm p-6">Врач не найден</div>;
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
      <h2 className="text-xl font-semibold">Профиль врача</h2>

      {error && <div className="text-red-600">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <input
          value={form.last_name}
          onChange={(e) => handleChange('last_name', e.target.value)}
          placeholder="Фамилия"
          className="w-full border rounded-xl px-4 py-3"
        />
        <input
          value={form.first_name}
          onChange={(e) => handleChange('first_name', e.target.value)}
          placeholder="Имя"
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
          placeholder="Телефон"
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
          value={rolesInput}
          onChange={(e) => setRolesInput(e.target.value)}
          placeholder="Специализации через запятую"
          className="w-full border rounded-xl px-4 py-3"
        />
      </div>

      <textarea
        value={form.description}
        onChange={(e) => handleChange('description', e.target.value)}
        placeholder="Описание"
        className="w-full border rounded-xl px-4 py-3 min-h-[120px]"
      />

      <textarea
        value={educationInput}
        onChange={(e) => setEducationInput(e.target.value)}
        placeholder="Образование через запятую"
        className="w-full border rounded-xl px-4 py-3 min-h-[100px]"
      />

      <textarea
        value={certificatesInput}
        onChange={(e) => setCertificatesInput(e.target.value)}
        placeholder="Сертификаты через запятую"
        className="w-full border rounded-xl px-4 py-3 min-h-[100px]"
      />

      <div className="flex flex-wrap gap-3 pt-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-3 rounded-xl bg-primary text-white disabled:opacity-50"
        >
          {saving ? 'Сохранение...' : 'Сохранить'}
        </button>

        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="px-5 py-3 rounded-xl bg-red-600 text-white disabled:opacity-50"
        >
          {deleting ? 'Удаление...' : 'Удалить врача'}
        </button>
      </div>
    </div>
  );
}