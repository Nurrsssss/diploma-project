'use client';

import ProtectedPage from '@/components/layout/general/ProtectedPage';
import SidebarLayout from '@/components/layout/navigation/SidebarLayout';

export default function ReceptionLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedPage allowedRoles={['reception']}>
      <SidebarLayout>
        {children}
      </SidebarLayout>
    </ProtectedPage>
  );
}