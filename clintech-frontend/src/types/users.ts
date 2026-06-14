// main from db
export type TUser = {
    id: string;
    email: string;
    hashed_password?: string;
    role: string;
    created_at?: string;
}