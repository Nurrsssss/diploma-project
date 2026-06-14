import { Search, Star, Shield, Clock } from 'lucide-react';

type TFeature = {
    icon: React.ReactNode;
    title: string;
    description: string;
}

type TStat = {
    title: string;
    description: string;
}

export const features: TFeature[] = [
    {
        icon: <Star className="h-6 w-6 text-primary sm:h-5 sm:w-5" strokeWidth={1.75} />,
        title: "Высокое качество",
        description: "Современные методы лечения"
    },
    {
        icon: <Shield className="h-6 w-6 text-primary sm:h-5 sm:w-5" strokeWidth={1.75} />,
        title: "Безопасность",
        description: "Защита ваших данных"
    },
    {
        icon: <Clock className="h-6 w-6 text-primary sm:h-5 sm:w-5" strokeWidth={1.75} />,
        title: "Экономия времени",
        description: "Быстрая запись онлайн"
    },
    {
        icon: <Search className="h-6 w-6 text-primary sm:h-5 sm:w-5" strokeWidth={1.75} />,
        title: "Точная диагностика",
        description: "Современное оборудование"
    }
]

export const stats: TStat[] = [
    {
        title: "СОВРЕМЕННОЕ ОБОРУДОВАНИЕ",
        description: "Новейшие технологии диагностики"
    },
    {
        title: "КВАЛИФИЦИРОВАННЫЕ ВРАЧИ",
        description: "Опытные специалисты"
    },
    {
        title: "ЛАБОРАТОРНЫЕ ИССЛЕДОВАНИЯ",
        description: "Точные результаты анализов"
    }
]