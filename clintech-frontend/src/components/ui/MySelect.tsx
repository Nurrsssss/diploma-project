import React from 'react'
import { FieldError, FieldErrors } from 'react-hook-form'

interface IMySelectProps {
    label?: string;
    id?: string;
    multiple?: boolean;
    options: { label: string; value: string }[];
    value?: string | string[];
    onChange?: (value: string | string[]) => void;
    className?: string;
    errors?: FieldError | FieldErrors | string | any;
    disabled?: boolean;
    placeholder?: string;
    [key: string]: any;
}
export default function MySelect({
    label,
    id,
    options,
    className = '',
    errors,
    multiple = false,
    value,
    onChange,
    disabled = false,
    placeholder,
    ...props
}: IMySelectProps) {
    const {
        onChange: rhfOnChange,
        onBlur: rhfOnBlur,
        name: rhfName,
        ref: rhfRef,
        ...restProps
    } = props;

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const target = e.target;
        if (onChange) {
            if (multiple) {
                const selectedOptions = Array.from(target.selectedOptions).map(option => option.value);
                onChange(selectedOptions);
            } else {
                onChange(target.value);
            }
        }
        if (rhfOnChange) {
            rhfOnChange(e);
        }
    };

    const getSelectValue = () => {
        if (multiple) {
            return Array.isArray(value) ? value : (value ? [String(value)] : []);
        }
        return value as string || '';
    };

    const getErrorMessage = () => {
        if (!errors) return null;
        if (typeof errors === 'string') return errors;
        if (typeof errors === 'object' && 'message' in errors && typeof errors.message === 'string') {
            return errors.message;
        }
        if (typeof errors === 'object' && errors.message) {
            return errors.message;
        }
        if (typeof errors === 'object' && errors.type) {
            return 'Поле обязательно для заполнения';
        }
        return null;
    };

    return (
        <div className="w-full">
            {label && (
                <label
                    htmlFor={id}
                    className="mb-2 text-[12px] text-[#374151] font-medium"
                >
                    {label}
                </label>
            )}

            <select
                id={id}
                name={rhfName}
                ref={rhfRef}
                multiple={multiple}
                value={getSelectValue()}
                onChange={handleChange}
                onBlur={rhfOnBlur}
                disabled={disabled}
                className={`
                    mt-2 w-full px-4 py-2 text-[16px] font-sans border rounded-lg 
                    focus:outline-none focus:border-darkPurple
                    placeholder:text-[#CCCCCC] placeholder:font-sans placeholder:text-[16px]
                    ${errors ? 'border-red-500' : 'border-[#D1D5DB]'}
                    ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}
                    ${multiple ? 'min-h-[120px]' : 'h-[42px]'}
                    ${className}
                `}
                {...restProps}
            >
                {!multiple && placeholder && (
                    <option value="" disabled>
                        {placeholder}
                    </option>
                )}
                {options.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>

            {getErrorMessage() && (
                <span className="text-red-500 text-sm mt-1 block">
                    {getErrorMessage()}
                </span>
            )}
        </div>
    )
}
