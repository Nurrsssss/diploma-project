import { RECEPTION_DOCTOR_ID, RECEPTION_EMAIL } from '@/constants/reception';

export function isReceptionAccount(session: any): boolean {
  return (
    session?.user_id === RECEPTION_DOCTOR_ID ||
    session?.email === RECEPTION_EMAIL
  );
}