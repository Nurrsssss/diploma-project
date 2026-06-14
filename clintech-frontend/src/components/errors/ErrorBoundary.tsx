'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary для обработки ошибок React компонентов
 * Включая ChunkLoadError
 */
export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
        };
    }

    static getDerivedStateFromError(error: Error): State {
        // Проверяем, является ли это ChunkLoadError
        const isChunkError =
            error.name === 'ChunkLoadError' ||
            error.message.includes('Loading chunk') ||
            error.message.includes('chunk');

        if (isChunkError && typeof window !== 'undefined') {
            // Для ChunkLoadError сразу пытаемся перезагрузить страницу
            console.warn('ChunkLoadError in ErrorBoundary, reloading page...');
            
            // Очищаем кеш
            if ('caches' in window) {
                caches.keys().then((names) => {
                    names.forEach((name) => {
                        caches.delete(name);
                    });
                });
            }
            
            // Перезагружаем страницу
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        }

        return {
            hasError: true,
            error,
            errorInfo: null,
        };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
        
        this.setState({
            error,
            errorInfo,
        });

        // Если это ChunkLoadError, перезагружаем страницу
        const isChunkError =
            error.name === 'ChunkLoadError' ||
            error.message.includes('Loading chunk') ||
            error.message.includes('chunk');

        if (isChunkError && typeof window !== 'undefined') {
            if ('caches' in window) {
                caches.keys().then((names) => {
                    names.forEach((name) => {
                        caches.delete(name);
                    });
                });
            }
            
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        }
    }

    handleReload = () => {
        if (typeof window !== 'undefined') {
            // Очищаем кеш
            if ('caches' in window) {
                caches.keys().then((names) => {
                    names.forEach((name) => {
                        caches.delete(name);
                    });
                });
            }
            
            window.location.reload();
        }
    };

    render() {
        if (this.state.hasError) {
            // Если есть кастомный fallback, используем его
            if (this.props.fallback) {
                return this.props.fallback;
            }

            // Проверяем, является ли это ChunkLoadError
            const isChunkError =
                this.state.error?.name === 'ChunkLoadError' ||
                this.state.error?.message.includes('Loading chunk') ||
                this.state.error?.message.includes('chunk');

            if (isChunkError) {
                // Для ChunkLoadError показываем сообщение о перезагрузке
                return (
                    <div className="flex items-center justify-center min-h-screen bg-gray-50">
                        <div className="text-center p-8">
                            <div className="mb-4">
                                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                            </div>
                            <h2 className="text-xl font-semibold text-gray-900 mb-2">
                                Обновление приложения...
                            </h2>
                            <p className="text-gray-600 mb-4">
                                Произошла ошибка загрузки. Страница будет перезагружена автоматически.
                            </p>
                            <button
                                onClick={this.handleReload}
                                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                            >
                                Перезагрузить сейчас
                            </button>
                        </div>
                    </div>
                );
            }

            // Для других ошибок показываем стандартное сообщение
            return (
                <div className="flex items-center justify-center min-h-screen bg-gray-50">
                    <div className="text-center p-8 max-w-md">
                        <h2 className="text-2xl font-bold text-gray-900 mb-4">
                            Что-то пошло не так
                        </h2>
                        <p className="text-gray-600 mb-6">
                            Произошла непредвиденная ошибка. Пожалуйста, попробуйте перезагрузить страницу.
                        </p>
                        <div className="space-y-2">
                            <button
                                onClick={this.handleReload}
                                className="w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                            >
                                Перезагрузить страницу
                            </button>
                            <button
                                onClick={() => {
                                    this.setState({ hasError: false, error: null, errorInfo: null });
                                }}
                                className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                            >
                                Попробовать снова
                            </button>
                        </div>
                        {process.env.NODE_ENV === 'development' && this.state.error && (
                            <details className="mt-6 text-left">
                                <summary className="cursor-pointer text-sm text-gray-500 mb-2">
                                    Детали ошибки (только для разработки)
                                </summary>
                                <pre className="text-xs bg-gray-100 p-4 rounded overflow-auto max-h-64">
                                    {this.state.error.toString()}
                                    {this.state.errorInfo?.componentStack}
                                </pre>
                            </details>
                        )}
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

