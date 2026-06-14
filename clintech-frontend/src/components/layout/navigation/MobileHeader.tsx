'use client'
import Link from "next/link";
import Image from "next/image";
import MyButton from "@/components/ui/MyButton";
import { useAuth } from "@/context/AuthContext";

interface IMobileHeaderProps {
    isSidebarOpen: boolean;
    onToggleSidebar: () => void;
    role: string | null;
}

export const MobileHeader: React.FC<IMobileHeaderProps> = ({
    isSidebarOpen, onToggleSidebar, role }) => {
    const { session } = useAuth();

    return (
        <div className="md:hidden bg-preDesign border-darkPurple border-b flex justify-between items-center h-16 px-4">
            <div>
                <button
                    onClick={onToggleSidebar}
                    className=" text-3xl z-50 relative text-primary mr-4 p-3 rounded"
                    aria-label={isSidebarOpen ? "Закрыть меню" : "Открыть меню"}
                >
                    <Image
                        src="/image/burger.svg"
                        alt="burger"
                        width={20}
                        height={20}
                        className={`transform transition-transform duration-300 ${isSidebarOpen ? 'rotate-90' : ''
                            }`}
                    />
                </button>

                <span className="text-center text-xl font-sans font-extrabold text-primary">
                    Clintech               </span>
            </div>

            <MyButton className="hidden xs:block py-2 px-4 rounded-[50px] bg-primary hover:bg-primary/90 text-white">
                <Link href={`/${role}/profile`} className="px-2 text-sm font-medium">
                    Профиль
                </Link>
            </MyButton>
            <MyButton className="hidden md:block py-2 px-4 rounded-[50px] bg-primary hover:bg-primary/90 text-white">
                <Link href={`/${role}/profile`} className="px-2 text-sm font-medium">
                    {session?.email || 'Профиль'}
                </Link>
            </MyButton>
        </div>
    )
}