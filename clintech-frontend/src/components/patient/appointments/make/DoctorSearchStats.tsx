import React from 'react';
import { FaUsers, FaFilter, FaTimes } from 'react-icons/fa';
import MyButton from '@/components/ui/MyButton';
import { DoctorFiltersState } from './DoctorFilters';

interface DoctorSearchStatsProps {
    totalDoctors: number;
    filteredDoctors: number;
    filtersState: DoctorFiltersState;
    onClearFilter: (filterKey: keyof DoctorFiltersState) => void;
    onClearAllFilters: () => void;
}

export const defaultFiltersState: DoctorFiltersState = {
    searchText: '',
    specialty: '',
    priceMin: '',
    priceMax: '',
    sortBy: 'name',
    sortOrder: 'asc'
}

const DoctorSearchStats: React.FC<DoctorSearchStatsProps> = ({
    totalDoctors,
    filteredDoctors,
    filtersState,
    onClearFilter,
    onClearAllFilters
}) => {
    const activeFilters = [
        { key: 'searchText' as const, label: 'Поиск', value: filtersState.searchText },
        { key: 'specialty' as const, label: 'Специальность', value: filtersState.specialty },
        { key: 'priceMin' as const, label: 'Цена от', value: filtersState.priceMin },
        { key: 'priceMax' as const, label: 'Цена до', value: filtersState.priceMax }
    ].filter(filter => filter.value);

    const hasActiveFilters = activeFilters.length > 0;

    return (
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                {/* Статистика */}
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <FaUsers className="text-blue-600" />
                        <span className="text-lg font-semibold text-blue-900">
                            Найдено врачей: {filteredDoctors}
                        </span>
                    </div>
                </div>

                {/* Активные фильтры */}
                {hasActiveFilters && (
                    <div className="flex flex-wrap items-center gap-1">
                        {hasActiveFilters && (
                            <div className="flex items-center gap-1 text-md  text-blue-700">
                                <FaFilter className="text-blue-500" />
                                <span>Активные фильтры:</span>
                            </div>
                        )}
                        {activeFilters.map((filter) => (
                            <div
                                key={filter.key}
                                className="flex items-center gap-1 bg-white px-3 py-1 rounded-full text-sm border border-blue-300"
                            >
                                <span className="text-blue-700">
                                    {filter.label}: <span className="font-medium">{filter.value}</span>
                                </span>
                                <button
                                    onClick={() => onClearFilter(filter.key)}
                                    className="text-blue-500 hover:text-blue-700 ml-1"
                                >
                                    <FaTimes className="w-3 h-3" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default DoctorSearchStats; 