import { NavigationItem } from "@/components/layout/navigation/NavigationItem";

interface IDesktopNavigationProps {
    sidebarItems: Array<{
        href: string;
        label: string;
        icon?: React.ComponentType;
    }>
}

export const DesktopNavigation: React.FC<IDesktopNavigationProps> = ({
    sidebarItems }) => {

    return (
        <ul className="hidden md:flex flex-wrap items-center justify-center gap-x-6 min-h-12 text-md xl:text-lg">
            {sidebarItems.map(item => (
                <NavigationItem
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    icon={item.icon}
                />
            ))}
        </ul>
    )
}