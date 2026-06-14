'use client'
import ProtectedPage from '@/components/layout/general/ProtectedPage';
import SidebarLayout from '@/components/layout/navigation/SidebarLayout';

export default function DoctorLayout({ children }: { children: React.ReactNode }) {
    return (
        <ProtectedPage allowedRoles={['doctor']}>
            <SidebarLayout>
                {children}
            </SidebarLayout>
        </ProtectedPage>
    );
}