import { FaSignOutAlt } from "react-icons/fa";
import MyButton from "@/components/ui/MyButton";
import { NavigationItem } from "./NavigationItem";

interface IMobileSidebarProps {
    isOpen: boolean;
    sidebarItems: Array<{
        href: string;
        label: string;
        icon?: React.ComponentType;
    }>;
    onItemClick: () => void;
    onLogout: () => void;
}

export const MobileSidebar: React.FC<IMobileSidebarProps> = ({
    isOpen,
    sidebarItems,
    onItemClick,
    onLogout
}) => {
    return (
        <div
            className={`
                fixed top-16 z-[100] md:hidden left-0 h-screen bg-white border-r 
                transform transition-all duration-300 ease-in-out lg:hidden
                ${isOpen ? 'w-full' : 'w-0 pointer-events-none overflow-hidden'}
            `}
        >
            <div className={`transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`}>
                <nav className="flex-1 flex flex-col justify-between h-full mt-4">
                    <ul>
                        {sidebarItems.map(item => (
                            <NavigationItem
                                key={item.href}
                                href={item.href}
                                label={item.label}
                                icon={item.icon}
                                isMobile={true}
                                onClick={onItemClick}
                            />
                        ))}
                    </ul>
                    <MyButton
                        onClick={onLogout}
                        className="ml-5 flex h-12 items-center gap-2 px-4 text-xl font-light text-primary shadow-none"
                    >
                        <FaSignOutAlt />
                        Выйти
                    </MyButton>
                </nav>
            </div>
        </div>
    );
};