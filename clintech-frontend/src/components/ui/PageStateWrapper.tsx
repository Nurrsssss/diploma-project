import React, { useState, useEffect } from 'react';
import MyButton from './MyButton';
import Loader from './Loader';
import { MdError, MdFolder } from 'react-icons/md';
import NoContent from './NoContent';

interface PageStateWrapperProps {
    loading?: boolean;
    error?: string | null;
    isEmpty?: boolean;
    emptyTitle?: string;
    emptyDescription?: string;
    emptyIcon?: React.ReactNode; // Поддерживает React компоненты (например, react-icons)
    errorIcon?: React.ReactNode; // Иконка для ошибок
    onRetry?: () => void;
    retryText?: string;
    loadingText?: string;
    button?: string;
    buttonHref?: string;
    children: React.ReactNode;
    className?: string;
    centerContent?: boolean;
}

const PageStateWrapper: React.FC<PageStateWrapperProps> = ({
    loading = false,
    error = null,
    isEmpty = false,
    emptyTitle = "Данные не найдены",
    emptyDescription = "В данный момент здесь нет информации для отображения",
    emptyIcon = <MdFolder size={48} />,
    errorIcon = <MdError size={48} />,
    onRetry,
    retryText = "Попробовать снова",
    loadingText = "Загрузка...",
    button,
    buttonHref,
    children,
    className = "",
    centerContent = true
}) => {
    const [canShowEmpty, setCanShowEmpty] = useState(false);

    // Задержка в 2 секунды перед показом пустого состояния
    useEffect(() => {
        const timer = setTimeout(() => {
            setCanShowEmpty(true);
        }, 2000);

        return () => clearTimeout(timer);
    }, []);

    const centerClass = centerContent ? "h-screen bg-gray-50 flex items-center justify-center" : "";

    // Состояние загрузки
    if (loading) {
        return (
            <div className={`${centerClass} ${className}`}>
                <div className="text-center">
                    <Loader loadingText={loadingText} />
                </div>
            </div>
        );
    }

    // Состояние ошибки
    if (error) {
        return (
            <div className={`${centerClass} ${className}`}>
                <div className="text-center max-w-md mx-auto p-6">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-2xl">{errorIcon}</span>
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">Произошла ошибка сервера</h3>
                    <p className="text-red-600 mb-4">{error}</p>
                    {onRetry && (
                        <MyButton
                            onClick={onRetry}
                            className="bg-primary hover:bg-primary/90 text-white px-6 py-2"
                        >
                            {retryText}
                        </MyButton>
                    )}
                </div>
            </div>
        );
    }

    // Состояние "пусто" - показываем только через 2 секунды И если действительно пусто
    if (isEmpty && canShowEmpty) {
        return (
            <NoContent
                title={emptyTitle}
                description={emptyDescription}
                icon={emptyIcon}
                button={button}
                href={buttonHref}

            />
        );
    }

    // Если isEmpty=true но еще не прошло 2 секунды - показываем loading
    if (isEmpty && !canShowEmpty) {
        return (
            <div className={`${centerClass} ${className}`}>
                <div className="text-center">
                    <Loader loadingText={loadingText} />
                </div>
            </div>
        );
    }

    // Обычное содержимое
    return <>{children}</>;
};

export default PageStateWrapper; 