'use client'
import ProtectedPage from '@/components/layout/general/ProtectedPage';
import SidebarLayout from '@/components/layout/navigation/SidebarLayout';
import QuestionnaireReminder from '@/components/chat/questionnaireReminder/QuestionnaireReminder';
import { useAuth } from '@/context/AuthContext';

export default function PatientLayout({ children }: { children: React.ReactNode }) {
    const { hydrated, session } = useAuth();

    return (
        <ProtectedPage allowedRoles={['patient']}>
            <SidebarLayout>
                {children}
            </SidebarLayout>
            {/* Показываем QuestionnaireReminder только после полной инициализации */}
            {hydrated && session?.user_id && <QuestionnaireReminder />}
        </ProtectedPage>
    );
}