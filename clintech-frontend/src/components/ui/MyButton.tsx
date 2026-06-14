import React from 'react';

interface IMyButtonProps {
    children: React.ReactNode
    className?: string
    type?: "button" | "submit" | "reset"
    onClick?: () => void
    disabled?: boolean
    title?: string
}
export default function MyButton({ children, onClick, className, type, disabled, title }: IMyButtonProps) {
    return (
        <button className={`px-4 py-2 rounded-lg shadow-md transition-all duration-300 ease-in-out hover:shadow-lg ${className}`}
            onClick={onClick} type={type} disabled={disabled} title={title}>
            {children}
        </button>
    )
}
