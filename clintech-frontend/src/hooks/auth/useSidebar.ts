'use client'
import { useState, useCallback, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

export const useSidebar = () => {
    const { logout, role, isLoggedIn } = useAuth();
    const router = useRouter();
    const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);

    //Выйти из аккаунта
    const handleLogout = useCallback(() => {
        logout();
        router.replace('/login');
    }, [logout, router]);

    //Открыть/закрыть боковую панель
    const toggleSidebar = useCallback(() => {
        setIsSidebarOpen(prev => !prev);
    }, []);

    //Закрыть боковую панель
    const closeSidebar = useCallback(() => {
        setIsSidebarOpen(false);
    }, []);

    //Закрыть боковую панель при переходе на другую страницу
    useEffect(() => {
        if (isSidebarOpen) {
            document.body.classList.add('overflow-hidden');
        } else {
            document.body.classList.remove('overflow-hidden');
        }

        //Убрать overflow-hidden при размонтировании компонента
        return () => {
            document.body.classList.remove('overflow-hidden');
        }
    }, [isSidebarOpen]);


    return {
        role,
        isLoggedIn,
        isSidebarOpen,
        toggleSidebar,
        closeSidebar,
        handleLogout,
    }

}

