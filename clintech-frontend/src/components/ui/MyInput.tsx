import React from 'react'

interface IMyInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    errors?: any;
}

export default function MyInput({ label, id, type, placeholder, className, errors, ...props }: IMyInputProps) {
    return (
        <div>
            {label && (<label htmlFor={id} className="mb-2 text-[12px] text-[#374151] font-medium">{label}</label>)}
            <input
                id={id}
                type={type}
                placeholder={placeholder}
                className={`mt-2 w-full px-4 py-2 text-[16px] border font-sans border-[#D1D5DB] rounded-lg focus:outline-none focus:border-darkPurple placeholder:text-[#CCCCCC] placeholder:font-sans placeholder:text-[16px] h-[42px] ${className}`}
                {...props}
            />
            {errors && (<span className="text-red-500 text-sm mt-1 block">{errors.message as string}</span>)}
        </div>
    )
}


