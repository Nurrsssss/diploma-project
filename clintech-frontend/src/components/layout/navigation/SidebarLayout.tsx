'use client'

import { sidebarItemsByRole } from "@/arrays/layout/sidebarItems";
import { useMemo } from "react";
import { useSidebar } from "@/hooks/auth/useSidebar";
import { DesktopNavigation } from "./DesktopNavigation";
import { MobileHeader } from "./MobileHeader";
import { MobileSidebar } from "./MobileSidebar";

export default function SidebarLayout({ children }: { children: React.ReactNode }) {
    const { role, isLoggedIn, isSidebarOpen, toggleSidebar, closeSidebar, handleLogout } = useSidebar();
    const sidebarItems = useMemo(() => sidebarItemsByRole[role || 'default'] || [], [role]);
    
    if (!isLoggedIn) {
        return (
            <main className="min-h-[90vh] flex-1 bg-pageBg">
                {children}
            </main>
        );
    }

    return (
        <div className="bg-white relative">
            <nav className="container">
                <DesktopNavigation
                    sidebarItems={sidebarItems}
                />

                <MobileHeader
                    isSidebarOpen={isSidebarOpen}
                    onToggleSidebar={toggleSidebar}
                    role={role}
                />

                <MobileSidebar
                    isOpen={isSidebarOpen}
                    sidebarItems={sidebarItems}
                    onItemClick={closeSidebar}
                    onLogout={handleLogout}
                />

            </nav>

            <main className="min-h-[90vh] flex-1 bg-pageBg pb-4 transition-all duration-300 lg:pb-8">
                {children}
            </main>
        </div>
    );
}
