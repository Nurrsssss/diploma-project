import React, { useState, useEffect } from 'react';
import { FaSearch, FaFilter, FaTimes } from 'react-icons/fa';
import MyInput from '@/components/ui/MyInput';
import MySelect from '@/components/ui/MySelect';
import MyButton from '@/components/ui/MyButton';
import { TDoctor } from '@/types/doctors';
import { defaultFiltersState } from './DoctorSearchStats';

export interface DoctorFiltersState {
    searchText: string;
    specialty: string;
    priceMin: string;
    priceMax: string;
    sortBy: string;
    sortOrder: 'asc' | 'desc';
}

interface DoctorFiltersProps {
    doctors: TDoctor[];
    filters: DoctorFiltersState;
    onFiltersChange: (filteredDoctors: TDoctor[]) => void;
    onFiltersStateChange: (filters: DoctorFiltersState) => void;
}

const DoctorFilters: React.FC<DoctorFiltersProps> = ({
    doctors,
    filters,
    onFiltersChange,
    onFiltersStateChange
}) => {
    const [isExpanded, setIsExpanded] = useState(false);

    // Получаем уникальные специальности из всех врачей
    const uniqueSpecialties = React.useMemo(() => {
        const specialties = new Set<string>();
        doctors.forEach(doctor => {
            doctor.roles?.forEach(role => specialties.add(role));
        });
        return Array.from(specialties).sort();
    }, [doctors]);

    // Получаем диапазон цен
    const priceRange = React.useMemo(() => {
        const prices = doctors
            .map(doctor => doctor.price)
            .filter(price => price !== undefined && price > 0) as number[];

        if (prices.length === 0) return { min: 0, max: 100000 };

        return {
            min: Math.min(...prices),
            max: Math.max(...prices)
        };
    }, [doctors]);

    // Применяем фильтры
    useEffect(() => {
        let filteredDoctors = [...doctors];

        // Поиск по тексту
        if (filters.searchText.trim()) {
            const searchLower = filters.searchText.toLowerCase();
            filteredDoctors = filteredDoctors.filter(doctor => {
                const fullName = `${doctor.first_name || ''} ${doctor.middle_name || ''} ${doctor.last_name || ''}`.toLowerCase();
                const description = (doctor.description || '').toLowerCase();
                const roles = doctor.roles?.join(' ').toLowerCase() || '';

                return fullName.includes(searchLower) ||
                    description.includes(searchLower) ||
                    roles.includes(searchLower);
            });
        }

        // Фильтр по специальности
        if (filters.specialty) {
            filteredDoctors = filteredDoctors.filter(doctor =>
                doctor.roles?.includes(filters.specialty)
            );
        }

        // Фильтр по цене
        if (filters.priceMin) {
            const minPrice = parseInt(filters.priceMin);
            filteredDoctors = filteredDoctors.filter(doctor =>
                doctor.price && doctor.price >= minPrice
            );
        }

        if (filters.priceMax) {
            const maxPrice = parseInt(filters.priceMax);
            filteredDoctors = filteredDoctors.filter(doctor =>
                doctor.price && doctor.price <= maxPrice
            );
        }

        // Сортировка
        filteredDoctors.sort((a, b) => {
            let valueA: any, valueB: any;

            switch (filters.sortBy) {
                case 'name':
                    valueA = `${a.last_name || ''} ${a.first_name || ''}`.trim();
                    valueB = `${b.last_name || ''} ${b.first_name || ''}`.trim();
                    break;
                case 'price':
                    valueA = a.price || 0;
                    valueB = b.price || 0;
                    break;
                case 'specialty':
                    valueA = a.roles?.[0] || '';
                    valueB = b.roles?.[0] || '';
                    break;
                default:
                    valueA = a.id;
                    valueB = b.id;
            }

            if (typeof valueA === 'string') {
                valueA = valueA.toLowerCase();
                valueB = valueB.toLowerCase();
            }

            if (filters.sortOrder === 'asc') {
                return valueA > valueB ? 1 : -1;
            } else {
                return valueA < valueB ? 1 : -1;
            }
        });

        onFiltersChange(filteredDoctors);
        onFiltersStateChange(filters);
    }, [filters, doctors, onFiltersChange, onFiltersStateChange]);

    const updateFilter = (key: keyof DoctorFiltersState, value: string | 'asc' | 'desc') => {
        onFiltersStateChange({ ...filters, [key]: value });
    };

    const clearFilters = () => {
        onFiltersStateChange(defaultFiltersState);
    };

    const hasActiveFilters = filters.searchText || filters.specialty || filters.priceMin || filters.priceMax;

    return (
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
            {/* Заголовок и кнопка разворачивания */}
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-1">
                <div className="flex items-center gap-2">
                    <FaSearch className="text-primary" />
                    <h3 className="text-lg font-semibold">Поиск и фильтры</h3>
                </div>
                <div className="flex items-center gap-2">
                    <MyButton
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="flex items-center gap-1 text-sm px-3 py-1 bg-primary/10 text-primary hover:bg-primary/20"
                    >
                        <FaFilter className="mr-1" />
                        {isExpanded ? 'Скрыть' : 'Показать'} фильтры
                    </MyButton>

                    {hasActiveFilters && (
                        <MyButton
                            onClick={clearFilters}
                            className="flex items-center gap-1text-sm px-3 py-1 bg-gray-100 text-gray-600 hover:bg-gray-200"
                        >
                            <FaTimes className="mr-1" />
                            Очистить
                        </MyButton>
                    )}
                </div>
            </div>

            {/* Поиск (всегда видимый) */}
            <div className="mb-4">
                <MyInput
                    placeholder="Поиск по имени, специальности или описанию..."
                    value={filters.searchText}
                    onChange={(e) => updateFilter('searchText', e.target.value)}
                    className="w-full"
                />
            </div>

            {/* Расширенные фильтры */}
            {isExpanded && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                        {/* Специальность */}
                        <MySelect
                            label="Специальность"
                            options={[
                                { label: 'Все специальности', value: '' },
                                ...uniqueSpecialties.map(specialty => ({
                                    label: specialty,
                                    value: specialty
                                }))
                            ]}
                            value={filters.specialty}
                            onChange={(value) => updateFilter('specialty', Array.isArray(value) ? value[0] : value)}
                        />

                        {/* Цена от */}
                        <MyInput
                            label={`Цена от (мин: ${priceRange.min} тг)`}
                            type="number"
                            placeholder={`от ${priceRange.min}`}
                            value={filters.priceMin}
                            onChange={(e) => updateFilter('priceMin', e.target.value)}
                            min={priceRange.min}
                            max={priceRange.max}
                        />

                        {/* Цена до */}
                        <MyInput
                            label={`Цена до (макс: ${priceRange.max} тг)`}
                            type="number"
                            placeholder={`до ${priceRange.max}`}
                            value={filters.priceMax}
                            onChange={(e) => updateFilter('priceMax', e.target.value)}
                            min={priceRange.min}
                            max={priceRange.max}
                        />

                        {/* Сортировка */}

                    </div>

                    <div className="mt-2 w-fit flex items-center gap-2">
                        <MySelect
                            label="Сортировать по"
                            options={[
                                { label: 'По имени', value: 'name' },
                                { label: 'По цене', value: 'price' },
                                { label: 'По специальности', value: 'specialty' }
                            ]}
                            value={filters.sortBy}
                            className=""
                            onChange={(value) => updateFilter('sortBy', Array.isArray(value) ? value[0] : value)}
                        />
                        <MySelect
                            label="Порядок"
                            options={[
                                { label: 'По возрастанию', value: 'asc' },
                                { label: 'По убыванию', value: 'desc' }
                            ]}
                            value={filters.sortOrder}
                            onChange={(value) => updateFilter('sortOrder', Array.isArray(value) ? value[0] : value as 'asc' | 'desc')}
                        />
                    </div>
                </>
            )}
        </div>
    );
};

export default DoctorFilters; 