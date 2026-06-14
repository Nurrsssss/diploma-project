'use client'
import Link from "next/link";
import { usePathname } from "next/navigation";

interface INavigationItemProps {
    href: string;
    label: string;
    icon?: React.ComponentType;
    isMobile?: boolean;
    onClick?: () => void;
}

export const NavigationItem: React.FC<INavigationItemProps> = ({
    href, label, icon: Icon, isMobile = false, onClick }) => {

    const pathname = usePathname();
    
    // Специальная логика для вкладки "Мои приёмы" (пациенты)
    let isActive = pathname === href;
    
    // Если это вкладка "Мои приёмы", то она активна на всех страницах записи
    if (href === '/patient/my-appointments') {
        isActive = pathname === href || pathname.startsWith('/patient/my-appointments/');
    }
    
    // Если это вкладка "Приемы" (врачи), то она активна на всех страницах приемов
    if (href === '/doctor/appointments') {
        isActive = pathname === href || pathname.startsWith('/doctor/appointments/');
    }

    return (
        <li>
            <Link
                href={href}
                onClick={onClick}
                className={`
                    font-sans font-light py-2 text-xl m-0 transition-all duration-300 
                    hover:bg-gray-100 flex items-center h-[50px] px-8 gap-2
                    ${isActive
                        ? 'border-b-2 border-primary bg-primary/15 text-teal-900'
                        : 'text-gray-500 hover:text-gray-700'
                    }
                `}
            >
                {Icon && <Icon />}
                {label}
            </Link>
        </li>
    )
}