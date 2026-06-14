import React from 'react';

type EmptyStateProps = {
    title: string;
    description?: string;
    icon?: React.ReactNode;
    actionText?: string;
    onAction?: () => void;
    className?: string;
    children?: React.ReactNode;
};

const EmptyState: React.FC<EmptyStateProps> = ({
    title,
    description,
    icon,
    actionText,
    onAction,
    className = '',
    children,
}) => (
    <div className={`flex flex-col items-center justify-center py-12 px-4 ${className}`}>
        {icon && <div className="mb-4 h-12 w-12 p-2 flex items-center justify-center bg-primary/70 rounded-full text-white">{icon}</div>}
        <h2 className="text-lg font-semibold mb-2 text-gray-800 text-center">{title}</h2>
        {description && <p className="text-center text-gray-500 mb-6">{description}</p>}
        {children}
        {actionText && onAction && (
            <button
                className="px-6 py-2 bg-primary text-white rounded-lg shadow hover:bg-primary-dark transition"
                onClick={onAction}
            >
                {actionText}
            </button>
        )}
    </div>
);

export default EmptyState;