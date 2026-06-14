'use client'
import React, { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import { useHealthPassportContent } from '@/hooks/files/useHealthPassportContent';
import { FaFileAlt, FaHistory, FaHeart, FaSave, FaUser, FaFileMedical, FaFileContract } from 'react-icons/fa';
import HealthPassportAnalysisTable from './HealthPassportAnalysisTable';
import Loader from '@/components/ui/Loader';
import MyTextarea from '@/components/ui/MyTextarea';
import { formatDate, calculateAge } from '@/utils/date';

interface HealthPassportEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    passportId: string | null;
    onSuccess?: () => void;
}

interface FormData {
    complaints: string;
    medical_history: string;
    lifestyle: string;
    files_analysis: string;
    general_conclusion: string;
}

export default function HealthPassportEditModal({ isOpen, onClose, passportId, onSuccess }: HealthPassportEditModalProps) {
    const { content, loading, error, updateContent, fetchContent, clearError } = useHealthPassportContent();
    const [activeTab, setActiveTab] = useState('patient');
    const [formData, setFormData] = useState<FormData>({
        complaints: '',
        medical_history: '',
        lifestyle: '',
        files_analysis: '',
        general_conclusion: ''
    });

    useEffect(() => {
        if (isOpen && passportId) {
            fetchContent(passportId);
        }
    }, [isOpen, passportId, fetchContent]);

    useEffect(() => {
        if (content) {
            console.log('Инициализация данных:', content);
            
            // Если files_analysis пустой, добавляем шаблон таблицы
            const defaultAnalysisTable = `| Показатель | Значение | Норма | Ед. изм. | Результат |
|-----------|-----------| ------| ---------| ---------|
| МСН | 28.9 | 27.0 – 34.0 | пг | N |`;

            setFormData({
                complaints: content.complaints || '',
                medical_history: content.medical_history || '',
                lifestyle: content.lifestyle || '',
                files_analysis: content.files_analysis || defaultAnalysisTable,
                general_conclusion: content.general_conclusion || ''
            });
        }
    }, [content]);

    const handleChange = (field: keyof FormData) => (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setFormData(prev => ({
            ...prev,
            [field]: e.target.value
        }));
    };

    const handleSave = async () => {
        if (!content || !passportId) return;

        try {
            await updateContent(passportId, {
                ...content,
                ...formData
            });
            onSuccess?.();
            onClose();
        } catch (error) {
            console.error('Error saving health passport:', error);
        }
    };

    if (loading) {
        return <Loader loadingText='Загрузка данных паспорта' />;
    }

    const tabs = [
        {
            id: 'patient',
            label: 'Пациент',
            icon: <FaUser />,
        },
        {
            id: 'doctor',
            label: 'Врач',
            icon: <FaUser />,
        },
        {
            id: 'complaints',
            label: 'Жалобы',
            icon: <FaFileAlt />,
        },
        {
            id: 'medical_history',
            label: 'Анамнез',
            icon: <FaHistory />,
        },
        {
            id: 'lifestyle',
            label: 'Образ жизни',
            icon: <FaHeart />,
        },
        {
            id: 'files_analysis',
            label: 'Анализ файлов',
            icon: <FaFileMedical />,
        },
        {
            id: 'general_conclusion',
            label: 'Общее заключение',
            icon: <FaFileContract />,
        }
    ];

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Редактирование паспорта здоровья" size='full'>
            <div className="p-6 space-y-6 h-[80vh] overflow-y-auto">
                <div className='flex gap-x-8 gap-y-2 border-b flex-wrap'>
                    {tabs.map((tab) => (
                        <div 
                            key={tab.id} 
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-1 cursor-pointer pb-2 ${
                                activeTab === tab.id 
                                    ? 'text-primary border-b-2 border-primary -mb-[2px]' 
                                    : 'text-gray-500'
                            }`}
                        >
                            {tab.icon}
                            {tab.label}
                        </div>
                    ))}
                </div>

                <div className="mt-4">
                    {(activeTab === 'patient' || activeTab === 'doctor') && (
                        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md text-blue-700 text-sm">
                            Данная вкладка доступна только для чтения
                        </div>
                    )}

                    {activeTab === 'patient' && content?.patient && (
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">ФИО</label>
                                <div className="mt-1 p-2 bg-gray-50 rounded">
                                    {`${content.patient.last_name} ${content.patient.first_name} ${content.patient.middle_name || ''}`}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Дата рождения</label>
                                <div className="mt-1 p-2 bg-gray-50 rounded">
                                    {formatDate(content.patient.birth_date)} ({calculateAge(content.patient.birth_date)} лет)
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">ИИН</label>
                                <div className="mt-1 p-2 bg-gray-50 rounded">
                                    {content.patient.iin || '—'}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Пол</label>
                                <div className="mt-1 p-2 bg-gray-50 rounded">
                                    {content.patient.gender === 'male' ? 'Мужской' : 'Женский'}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Email</label>
                                <div className="mt-1 p-2 bg-gray-50 rounded">
                                    {content.patient.email || '—'}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Телефон</label>
                                <div className="mt-1 p-2 bg-gray-50 rounded">
                                    {content.patient.phone || '—'}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Адрес</label>
                                <div className="mt-1 p-2 bg-gray-50 rounded">
                                    {content.patient.address || '—'}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Физические параметры</label>
                                <div className="mt-1 p-2 bg-gray-50 rounded">
                                    Рост: {content.patient.height || '—'} см, 
                                    Вес: {content.patient.weight || '—'} кг, 
                                    ИМТ: {content.patient.bmi || '—'}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'doctor' && content?.doctor && (
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">ФИО врача</label>
                                <div className="mt-1 p-2 bg-gray-50 rounded">
                                    {`${content.doctor.last_name} ${content.doctor.first_name} ${content.doctor.middle_name || ''}`}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Роли</label>
                                <div className="mt-1 p-2 bg-gray-50 rounded">
                                    {content.doctor.roles.join(', ')}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Email</label>
                                <div className="mt-1 p-2 bg-gray-50 rounded">
                                    {content.doctor.email || '—'}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Телефон</label>
                                <div className="mt-1 p-2 bg-gray-50 rounded">
                                    {content.doctor.phone || '—'}
                                </div>
                            </div>
                            {content.doctor.description && (
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-700">Описание</label>
                                    <div className="mt-1 p-2 bg-gray-50 rounded">
                                        {content.doctor.description}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'files_analysis' ? (
                        <div className="space-y-4">
                            {/* Debugging content */}
                            {(() => { console.log('files_analysis content:', formData[activeTab]); return null; })()}
                            <HealthPassportAnalysisTable
                                content={formData[activeTab] || ''}
                                onChange={(newContent) => {
                                    console.log('Table content changed:', newContent);
                                    setFormData(prev => ({
                                        ...prev,
                                        [activeTab]: newContent
                                    }));
                                }}
                            />
                        </div>
                    ) : (activeTab === 'complaints' || 
                         activeTab === 'medical_history' || 
                         activeTab === 'lifestyle' || 
                         activeTab === 'general_conclusion') && (
                        <div className="space-y-4">
                            <MyTextarea
                                value={formData[activeTab as keyof FormData]}
                                onChange={handleChange(activeTab as keyof FormData)}
                                className="w-full h-64 md:h-96"
                                placeholder={`Введите ${tabs.find(tab => tab.id === activeTab)?.label.toLowerCase()}`}
                            />
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-4 mt-6 pt-4 border-t">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                        Отмена
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-4 py-2 text-sm font-medium text-white bg-primary border border-transparent rounded-md hover:bg-primary-dark"
                    >
                        Сохранить
                    </button>
                </div>
            </div>
        </Modal>
    );
}