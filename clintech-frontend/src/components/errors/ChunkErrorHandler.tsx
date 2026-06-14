'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Компонент для обработки ошибок загрузки chunks в Next.js
 * Автоматически перезагружает страницу при ошибке загрузки chunk
 */
export default function ChunkErrorHandler() {
    const router = useRouter();

    useEffect(() => {
        const handleChunkError = (event: ErrorEvent) => {
            const error = event.error;
            
            // Проверяем, является ли это ошибкой загрузки chunk
            if (
                error?.name === 'ChunkLoadError' ||
                error?.message?.includes('Loading chunk') ||
                error?.message?.includes('Failed to load resource') ||
                (error?.message && error.message.includes('chunk'))
            ) {
                console.warn('ChunkLoadError detected, attempting to reload page...', error);
                
                // Пытаемся перезагрузить страницу
                // Используем window.location.reload() для полной перезагрузки
                if (typeof window !== 'undefined') {
                    // Очищаем кеш перед перезагрузкой
                    if ('caches' in window) {
                        caches.keys().then((names) => {
                            names.forEach((name) => {
                                caches.delete(name);
                            });
                        });
                    }
                    
                    // Перезагружаем страницу через небольшую задержку
                    setTimeout(() => {
                        window.location.reload();
                    }, 1000);
                }
            }
        };

        // Обработчик для unhandledrejection (для промисов)
        const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
            const reason = event.reason;
            
            if (
                reason?.name === 'ChunkLoadError' ||
                reason?.message?.includes('Loading chunk') ||
                reason?.message?.includes('Failed to load resource') ||
                (reason?.message && reason.message.includes('chunk'))
            ) {
                console.warn('ChunkLoadError in promise rejection, attempting to reload page...', reason);
                event.preventDefault(); // Предотвращаем вывод в консоль
                
                if (typeof window !== 'undefined') {
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
        };

        // Добавляем обработчики событий
        window.addEventListener('error', handleChunkError);
        window.addEventListener('unhandledrejection', handleUnhandledRejection);

        // Обработчик для ошибок загрузки скриптов
        const originalErrorHandler = window.onerror;
        window.onerror = (message, source, lineno, colno, error) => {
            if (
                error?.name === 'ChunkLoadError' ||
                (typeof message === 'string' && message.includes('chunk')) ||
                (typeof message === 'string' && message.includes('Loading chunk'))
            ) {
                console.warn('ChunkLoadError detected in window.onerror, attempting to reload...');
                
                if (typeof window !== 'undefined') {
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
                return true; // Предотвращаем вывод ошибки в консоль
            }
            
            // Вызываем оригинальный обработчик для других ошибок
            if (originalErrorHandler) {
                return originalErrorHandler(message, source, lineno, colno, error);
            }
            return false;
        };

        // Перехватываем ошибки в webpack chunk loading
        if (typeof window !== 'undefined' && (window as any).__NEXT_DATA__) {
            const originalFetch = window.fetch;
            window.fetch = async (...args) => {
                try {
                    const response = await originalFetch(...args);
                    
                    // Если запрос к chunk файлу вернул ошибку, пытаемся перезагрузить
                    if (
                        !response.ok &&
                        args[0] &&
                        typeof args[0] === 'string' &&
                        (args[0].includes('/_next/static/chunks/') || args[0].includes('chunk'))
                    ) {
                        console.warn(`Chunk load failed: ${args[0]}, status: ${response.status}`);
                        
                        // Если это 400 или 404, перезагружаем страницу
                        if (response.status === 400 || response.status === 404) {
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
                    
                    return response;
                } catch (error: any) {
                    if (
                        error?.name === 'ChunkLoadError' ||
                        error?.message?.includes('chunk') ||
                        (args[0] && typeof args[0] === 'string' && args[0].includes('chunk'))
                    ) {
                        console.warn('Chunk load error in fetch, reloading...');
                        
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
                    throw error;
                }
            };
        }

        // Cleanup
        return () => {
            window.removeEventListener('error', handleChunkError);
            window.removeEventListener('unhandledrejection', handleUnhandledRejection);
        };
    }, [router]);

    return null; // Этот компонент не рендерит ничего
}

