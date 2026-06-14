'use client'
import { useRouter } from "next/navigation";
import { FaArrowLeft } from "react-icons/fa";

interface IPagesLayoutProps {
    children: React.ReactNode;
    title?: string;
    isBackButton?: boolean;
    description?: string;
}

export default function PagesLayout({ children, title, description, isBackButton }: IPagesLayoutProps) {
    const router = useRouter()
    return (
        <>
            <div className="bg-white rounded-lg p-4 my-4">
                <div className='container '>
                    {isBackButton && (
                        <button onClick={() => router.back()} className="flex items-center gap-2 text-blue-500">
                            <FaArrowLeft /> назад
                        </button>
                    )}
                    <h1 className={`text-2xl font-sans font-bold text-black`}>{title}</h1>
                    {description && <h2 className={`text-md text-gray-500`}>{description}</h2>}
                </div>
            </div>
            {children}
        </>
    )
}