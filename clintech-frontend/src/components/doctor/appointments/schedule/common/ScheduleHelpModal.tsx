'use client'
import React from 'react'
import { FaCalendar, FaClock, FaVideo, FaHospital, FaToggleOn, FaEdit, FaTrash, FaTimes, FaCheckCircle, FaInfoCircle, FaBolt } from 'react-icons/fa'

interface ScheduleHelpModalProps {
    isOpen: boolean
    onClose: () => void
}

export default function ScheduleHelpModal({ isOpen, onClose }: ScheduleHelpModalProps) {
    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl transform transition-all duration-300 scale-100 opacity-100">
                {/* Заголовок */}
                <div className="sticky top-0 bg-white border-b border-gray-100 p-6 rounded-t-2xl">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-gradient-to-r from-primary to-blue-600 rounded-xl flex items-center justify-center">
                                <FaInfoCircle className="text-white" size={20} />
                            </div>
                            <div>
                                <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Как работают расписания?</h2>
                                <p className="text-gray-600 text-sm sm:text-base">Полное руководство по управлению рабочим временем</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded-xl flex items-center justify-center transition-colors"
                        >
                            <FaTimes className="text-gray-600" size={16} />
                        </button>
                    </div>
                </div>

                {/* Содержимое */}
                <div className="p-6 space-y-8">
                    {/* Что такое расписания */}
                    <section>
                        <div className="flex items-center gap-3 mb-4">
                            <FaCalendar className="text-primary" size={20} />
                            <h3 className="text-xl font-bold text-gray-900">Что такое шаблоны расписаний?</h3>
                        </div>
                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
                            <p className="text-gray-700 leading-relaxed">
                                <strong>Шаблон расписания</strong> — это настраиваемый график работы, который определяет:
                            </p>
                            <div className="grid md:grid-cols-2 gap-4 mt-4">
                                <div className="flex items-start gap-3">
                                    <FaCheckCircle className="text-green-600 mt-1" size={16} />
                                    <div>
                                        <p className="font-semibold text-gray-900">Рабочие часы</p>
                                        <p className="text-sm text-gray-600">Время начала и окончания приема</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <FaCheckCircle className="text-green-600 mt-1" size={16} />
                                    <div>
                                        <p className="font-semibold text-gray-900">Дни недели</p>
                                        <p className="text-sm text-gray-600">Какие дни вы принимаете пациентов</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <FaCheckCircle className="text-green-600 mt-1" size={16} />
                                    <div>
                                        <p className="font-semibold text-gray-900">Длительность слотов</p>
                                        <p className="text-sm text-gray-600">Время на каждого пациента</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <FaCheckCircle className="text-green-600 mt-1" size={16} />
                                    <div>
                                        <p className="font-semibold text-gray-900">Формат приема</p>
                                        <p className="text-sm text-gray-600">Онлайн, офлайн или оба варианта</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Форматы приема */}
                    <section>
                        <div className="flex items-center gap-3 mb-4">
                            <FaVideo className="text-blue-600" size={20} />
                            <h3 className="text-xl font-bold text-gray-900">Форматы приема</h3>
                        </div>
                        <div className="grid md:grid-cols-3 gap-4">
                            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-5 border border-blue-200">
                                <div className="flex items-center gap-3 mb-3">
                                    <FaVideo className="text-blue-600" size={24} />
                                    <h4 className="font-bold text-blue-900">Только онлайн</h4>
                                </div>
                                <p className="text-sm text-blue-800">
                                    Консультации проводятся через видеосвязь. Пациенты подключаются из любого места.
                                </p>
                            </div>
                            <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-5 border border-green-200">
                                <div className="flex items-center gap-3 mb-3">
                                    <FaHospital className="text-green-600" size={24} />
                                    <h4 className="font-bold text-green-900">Только офлайн</h4>
                                </div>
                                <p className="text-sm text-green-800">
                                    Очные приемы в клинике. Пациенты приходят лично на консультацию.
                                </p>
                            </div>
                            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl p-5 border border-purple-200">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="flex gap-2">
                                        <FaVideo className="text-blue-600" size={20} />
                                        <FaHospital className="text-green-600" size={20} />
                                    </div>
                                    <h4 className="font-bold text-purple-900">Смешанный</h4>
                                </div>
                                <p className="text-sm text-purple-800">
                                    Пациент может выбрать формат при записи: онлайн или офлайн.
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* Как это работает */}
                    <section>
                        <div className="flex items-center gap-3 mb-4">
                            <FaBolt className="text-orange-600" size={20} />
                            <h3 className="text-xl font-bold text-gray-900">Как это работает?</h3>
                        </div>
                        <div className="space-y-4">
                            <div className="flex items-start gap-4">
                                <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                                    <span className="text-primary font-bold">1</span>
                                </div>
                                <div>
                                    <h4 className="font-semibold text-gray-900 mb-1">Создайте шаблон расписания</h4>
                                    <p className="text-gray-600">Задайте время работы, дни недели, длительность слотов и формат приема</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4">
                                <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                                    <span className="text-primary font-bold">2</span>
                                </div>
                                <div>
                                    <h4 className="font-semibold text-gray-900 mb-1">Активируйте расписание</h4>
                                    <p className="text-gray-600">Только одно расписание может быть активным. Система автоматически создаст слоты для записи</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4">
                                <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                                    <span className="text-primary font-bold">3</span>
                                </div>
                                <div>
                                    <h4 className="font-semibold text-gray-900 mb-1">Создайте слоты</h4>
                                    <p className="text-gray-600">Перейдите в раздел генерации слотов и выберите диапозон дат для нужного расписания</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4">
                                <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                                    <span className="text-primary font-bold">4</span>
                                </div>
                                <div>
                                    <h4 className="font-semibold text-gray-900 mb-1">Пациенты записываются</h4>
                                    <p className="text-gray-600">Пациенты видят доступные слоты и могут записаться на удобное время</p>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Управление расписаниями */}
                    <section>
                        <div className="flex items-center gap-3 mb-4">
                            <FaClock className="text-orange-600" size={20} />
                            <h3 className="text-xl font-bold text-gray-900">Управление расписаниями</h3>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-6">
                            <div className="grid md:grid-cols-2 gap-6">
                                <div>
                                    <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                        <FaToggleOn className="text-green-600" />
                                        Основные действия
                                    </h4>
                                    <ul className="space-y-2 text-sm text-gray-600">
                                        <li>• <strong>Активировать/Деактивировать</strong> - включить или выключить расписание</li>
                                        <li>• <strong>Удалить слоты</strong> - очистить все созданные временные слоты</li>
                                    </ul>
                                </div>
                                <div>
                                    <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                        <FaEdit className="text-blue-600" />
                                        Дополнительные действия
                                    </h4>
                                    <ul className="space-y-2 text-sm text-gray-600">
                                        <li>• <strong>Изменить</strong> - редактировать параметры расписания</li>
                                        <li>• <strong>Удалить</strong> - полностью удалить шаблон расписания</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Полезные советы */}
                    <section>
                        <div className="bg-gradient-to-r from-yellow-50 to-amber-50 rounded-xl p-6 border border-yellow-200">
                            <h3 className="text-lg font-bold text-amber-900 mb-3">Полезные советы</h3>
                            <div className="space-y-2 text-sm text-amber-800">
                                <p>• Создайте несколько шаблонов для разных типов приема (первичная консультация, повторный прием)</p>
                                <p>• Оптимальная длительность слота для большинства консультаций — 30-60 минут</p>
                                <p>• Используйте смешанный формат, чтобы дать пациентам больше гибкости</p>
                                <p>• Регулярно проверяйте и обновляйте свои расписания в зависимости от загруженности</p>
                            </div>
                        </div>
                    </section>
                </div>

                {/* Футер */}
                <div className="sticky bottom-0 bg-white border-t border-gray-100 p-6 rounded-b-2xl">
                    <div className="flex justify-end">
                        <button
                            onClick={onClose}
                            className="px-6 py-3 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors font-medium"
                        >
                            Понятно, спасибо!
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
} 