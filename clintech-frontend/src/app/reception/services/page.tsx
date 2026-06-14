'use client';

import { useEffect, useMemo, useState } from 'react';
import { FaPlus, FaTrash, FaTimes } from 'react-icons/fa';
import PagesLayout from '@/components/layout/general/PagesLayout';
import {
  createService,
  deleteService,
  getServiceCategories,
  getServices,
  updateService,
} from '@/lib/api/services';
import { TService, TServiceCategory } from '@/types/services';

const emptyItem: Omit<TService, 'id' | 'category_name'> = {
  legacy_id: undefined,
  category_id: '',
  external_code: '',
  name: '',
  service_name: '',
  price: 0,
  duration_minutes: 0,
  is_active: true,
};

export default function ReceptionServicesPage() {
  const [services, setServices] = useState<TService[]>([]);
  const [categories, setCategories] = useState<TServiceCategory[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('');
  const [priceFrom, setPriceFrom] = useState('');
  const [priceTo, setPriceTo] = useState('');
  const [durationFrom, setDurationFrom] = useState('');
  const [durationTo, setDurationTo] = useState('');

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TService | null>(null);

  const [categoryId, setCategoryId] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [item, setItem] = useState<Omit<TService, 'id' | 'category_name'>>(emptyItem);

  async function loadAll(currentSearch?: string) {
    try {
      setLoading(true);
      const [servicesData, categoriesData] = await Promise.all([
        getServices(currentSearch),
        getServiceCategories(),
      ]);
      setServices(servicesData);
      setCategories(categoriesData);
    } catch (e) {
      console.error(e);
      alert('Не удалось загрузить услуги');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  const categoryOptions = useMemo(() => categories, [categories]);

  const filteredServices = useMemo(() => {
    return services.filter((service) => {
      const normalizedSearch = search.trim().toLowerCase();

      const matchesSearch =
        !normalizedSearch ||
        service.name.toLowerCase().includes(normalizedSearch) ||
        service.service_name.toLowerCase().includes(normalizedSearch) ||
        service.category_name.toLowerCase().includes(normalizedSearch) ||
        (service.external_code || '').toLowerCase().includes(normalizedSearch);

      const matchesCategory =
        !selectedCategoryFilter || service.category_id === selectedCategoryFilter;

      const matchesPriceFrom = !priceFrom || service.price >= Number(priceFrom);
      const matchesPriceTo = !priceTo || service.price <= Number(priceTo);

      const matchesDurationFrom =
        !durationFrom || service.duration_minutes >= Number(durationFrom);
      const matchesDurationTo =
        !durationTo || service.duration_minutes <= Number(durationTo);

      return (
        matchesSearch &&
        matchesCategory &&
        matchesPriceFrom &&
        matchesPriceTo &&
        matchesDurationFrom &&
        matchesDurationTo
      );
    });
  }, [
    services,
    search,
    selectedCategoryFilter,
    priceFrom,
    priceTo,
    durationFrom,
    durationTo,
  ]);

  function openCreateModal() {
    setEditing(null);
    setCategoryId(categories[0]?.id || '');
    setNewCategory('');
    setItem(emptyItem);
    setOpen(true);
  }

  function openEditModal(service: TService) {
    setEditing(service);
    setCategoryId(service.category_id);
    setNewCategory('');
    setItem({
      legacy_id: service.legacy_id,
      category_id: service.category_id,
      external_code: service.external_code || '',
      name: service.name,
      service_name: service.service_name,
      price: service.price,
      duration_minutes: service.duration_minutes,
      is_active: service.is_active,
    });
    setOpen(true);
  }

  function closeModal() {
    setOpen(false);
    setEditing(null);
    setCategoryId('');
    setNewCategory('');
    setItem(emptyItem);
  }

  function resetFilters() {
    setSearch('');
    setSelectedCategoryFilter('');
    setPriceFrom('');
    setPriceTo('');
    setDurationFrom('');
    setDurationTo('');
  }

  async function handleDelete(id: number) {
    const ok = window.confirm('Удалить услугу?');
    if (!ok) return;

    try {
      await deleteService(id);
      await loadAll();
    } catch (e) {
      console.error(e);
      alert('Не удалось удалить услугу');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!categoryId && !newCategory.trim()) {
      alert('Укажите категорию');
      return;
    }

    if (!item.name.trim()) {
      alert('Укажите название услуги');
      return;
    }

    if (!item.service_name.trim()) {
      alert('Укажите service_name');
      return;
    }

    try {
      const payload = {
        category_id: newCategory.trim() ? undefined : categoryId || undefined,
        category_name: newCategory.trim() || undefined,
        legacy_id: item.legacy_id || undefined,
        external_code: item.external_code?.trim() || undefined,
        name: item.name,
        service_name: item.service_name,
        price: Number(item.price),
        duration_minutes: Number(item.duration_minutes),
        is_active: item.is_active,
      };

      if (editing) {
        await updateService(editing.id, payload);
      } else {
        await createService(payload);
      }

      closeModal();
      await loadAll();
    } catch (e) {
      console.error(e);
      alert('Не удалось сохранить услугу');
    }
  }

  return (
    <PagesLayout>
      <div className="container rounded-2xl bg-white p-4 shadow-xl">
        <div className="mb-4 flex flex-col gap-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex w-full gap-3">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск по названию, категории или коду..."
                className="w-full rounded-xl border px-4 py-3 outline-none"
              />
            </div>

            <button
              onClick={openCreateModal}
              className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 py-3 text-white"
            >
              <FaPlus />
              Добавить
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
            <select
              value={selectedCategoryFilter}
              onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              className="w-full rounded-xl border px-4 py-3"
            >
              <option value="">Все категории</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>

            <input
              type="number"
              value={priceFrom}
              onChange={(e) => setPriceFrom(e.target.value)}
              placeholder="Цена от"
              className="w-full rounded-xl border px-4 py-3"
            />

            <input
              type="number"
              value={priceTo}
              onChange={(e) => setPriceTo(e.target.value)}
              placeholder="Цена до"
              className="w-full rounded-xl border px-4 py-3"
            />

            <input
              type="number"
              value={durationFrom}
              onChange={(e) => setDurationFrom(e.target.value)}
              placeholder="Минуты от"
              className="w-full rounded-xl border px-4 py-3"
            />

            <input
              type="number"
              value={durationTo}
              onChange={(e) => setDurationTo(e.target.value)}
              placeholder="Минуты до"
              className="w-full rounded-xl border px-4 py-3"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Найдено: {filteredServices.length}
            </div>

            <button
              type="button"
              onClick={resetFilters}
              className="rounded-xl border px-4 py-2"
            >
              Сбросить фильтры
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border">
          <div className="grid grid-cols-[1.3fr_1fr_120px_120px_60px] gap-3 border-b bg-gray-50 px-4 py-3 text-sm font-semibold">
            <div>Услуга</div>
            <div>Категория</div>
            <div>Цена</div>
            <div>Минуты</div>
            <div></div>
          </div>

          {loading ? (
            <div className="p-6 text-center">Загрузка...</div>
          ) : filteredServices.length === 0 ? (
            <div className="p-6 text-center">Услуги не найдены</div>
          ) : (
            filteredServices.map((service) => (
              <div
                key={service.id}
                className="grid grid-cols-[1.3fr_1fr_120px_120px_60px] items-center gap-3 border-b px-4 py-4"
              >
                <button
                  onClick={() => openEditModal(service)}
                  className="text-left text-blue-600 hover:underline"
                >
                  {service.name}
                </button>

                <div>{service.category_name}</div>
                <div>{service.price} ₸</div>
                <div>{service.duration_minutes}</div>

                <div className="flex justify-end">
                  <button
                    onClick={() => handleDelete(service.id)}
                    className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                    title="Удалить"
                  >
                    <FaTrash />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">
                {editing ? 'Редактировать услугу' : 'Добавить услугу'}
              </h2>

              <button onClick={closeModal} className="rounded-lg p-2 hover:bg-gray-100">
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
              <div className="col-span-1">
                <label className="mb-1 block text-sm font-medium">Категория</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full rounded-xl border px-4 py-3"
                >
                  <option value="">Выберите категорию</option>
                  {categoryOptions.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-span-1">
                <label className="mb-1 block text-sm font-medium">Новая категория</label>
                <input
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="Если нужно создать новую"
                  className="w-full rounded-xl border px-4 py-3"
                />
              </div>

              <div className="col-span-2">
                <label className="mb-1 block text-sm font-medium">Название</label>
                <input
                  value={item.name}
                  onChange={(e) =>
                    setItem((prev) => ({
                      ...prev,
                      name: e.target.value,
                    }))
                  }
                  className="w-full rounded-xl border px-4 py-3"
                />
              </div>

              <div className="col-span-2">
                <label className="mb-1 block text-sm font-medium">service_name</label>
                <input
                  value={item.service_name}
                  onChange={(e) =>
                    setItem((prev) => ({
                      ...prev,
                      service_name: e.target.value,
                    }))
                  }
                  className="w-full rounded-xl border px-4 py-3"
                />
              </div>

              <div className="col-span-2">
                <label className="mb-1 block text-sm font-medium">external_code</label>
                <input
                  value={item.external_code || ''}
                  onChange={(e) =>
                    setItem((prev) => ({
                      ...prev,
                      external_code: e.target.value,
                    }))
                  }
                  className="w-full rounded-xl border px-4 py-3"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Цена</label>
                <input
                  type="number"
                  value={item.price}
                  onChange={(e) =>
                    setItem((prev) => ({
                      ...prev,
                      price: Number(e.target.value),
                    }))
                  }
                  className="w-full rounded-xl border px-4 py-3"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Минуты</label>
                <input
                  type="number"
                  value={item.duration_minutes}
                  onChange={(e) =>
                    setItem((prev) => ({
                      ...prev,
                      duration_minutes: Number(e.target.value),
                    }))
                  }
                  className="w-full rounded-xl border px-4 py-3"
                />
              </div>

              <div className="col-span-2">
                <label className="mb-1 flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={item.is_active}
                    onChange={(e) =>
                      setItem((prev) => ({
                        ...prev,
                        is_active: e.target.checked,
                      }))
                    }
                  />
                  Активна
                </label>
              </div>

              <div className="col-span-2 flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-xl border px-4 py-3"
                >
                  Отмена
                </button>

                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 px-4 py-3 text-white"
                >
                  {editing ? 'Сохранить' : 'Создать'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PagesLayout>
  );
}