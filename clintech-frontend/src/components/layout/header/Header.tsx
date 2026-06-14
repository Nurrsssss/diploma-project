'use client'
import { useAuth } from "@/context/AuthContext";
import IsLoggedIn from "./IsLoggedIn";
import IsNotLoggedIn from "./IsNotLoggedIn";

export default function Header() {
    const { isLoggedIn, session, role } = useAuth();

    return (
        <>
            {
                isLoggedIn ? (
                    <IsLoggedIn role={role || ''} session={session} />
                ) : (
                    <IsNotLoggedIn />
                )
            }
        </>
    );
}