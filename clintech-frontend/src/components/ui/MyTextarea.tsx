import React from 'react'

interface IMyTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    label?: string;
    errors?: any;
    rows?: number;
}

export default function MyTextarea({ label, id, placeholder, className, errors, rows = 4, ...props }: IMyTextareaProps) {
    return (
        <div>
            {label && (<label htmlFor={id} className="mb-2 text-[12px] text-[#374151] font-medium">{label}</label>)}
            <textarea
                id={id}
                placeholder={placeholder}
                rows={rows}
                className={`mt-2 w-full px-4 py-2 text-[16px] border font-sans border-[#D1D5DB] rounded-lg focus:outline-none focus:border-darkPurple placeholder:text-[#CCCCCC] placeholder:font-sans placeholder:text-[16px] resize-vertical ${className}`}
                {...props}
            />
            {errors && (<span className="text-red-500 text-sm mt-1 block">{errors.message as string}</span>)}
        </div>
    )
} 