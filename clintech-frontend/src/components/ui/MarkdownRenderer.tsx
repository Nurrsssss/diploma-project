'use client'
import React from 'react'
import ReactMarkdown from 'react-markdown'

interface MarkdownRendererProps {
    content: string;
    className?: string;
}

export default function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
    return (
        <div className={`prose prose-sm max-w-none ${className}`}>
            <ReactMarkdown
                components={{
                    // Стилизация заголовков
                    h1: ({ children }) => (
                        <h1 className="text-2xl font-bold text-gray-900 mb-4 mt-6 first:mt-0">
                            {children}
                        </h1>
                    ),
                    h2: ({ children }) => (
                        <h2 className="text-xl font-bold text-gray-900 mb-3 mt-5 first:mt-0">
                            {children}
                        </h2>
                    ),
                    h3: ({ children }) => (
                        <h3 className="text-lg font-semibold text-gray-800 mb-2 mt-4 first:mt-0">
                            {children}
                        </h3>
                    ),
                    h4: ({ children }) => (
                        <h4 className="text-base font-semibold text-gray-800 mb-2 mt-3 first:mt-0">
                            {children}
                        </h4>
                    ),
                    // Стилизация параграфов
                    p: ({ children }) => (
                        <p className="text-gray-700 leading-relaxed mb-3 last:mb-0">
                            {children}
                        </p>
                    ),
                    // Стилизация списков
                    ul: ({ children }) => (
                        <ul className="list-disc list-inside text-gray-700 mb-3 space-y-1">
                            {children}
                        </ul>
                    ),
                    ol: ({ children }) => (
                        <ol className="list-decimal list-inside text-gray-700 mb-3 space-y-1">
                            {children}
                        </ol>
                    ),
                    li: ({ children }) => (
                        <li className="text-gray-700 leading-relaxed">
                            {children}
                        </li>
                    ),
                    // Стилизация выделения
                    strong: ({ children }) => (
                        <strong className="font-semibold text-gray-900">
                            {children}
                        </strong>
                    ),
                    em: ({ children }) => (
                        <em className="italic text-gray-800">
                            {children}
                        </em>
                    ),
                    // Стилизация кода
                    code: ({ children, className }) => {
                        const isInline = !className;
                        if (isInline) {
                            return (
                                <code className="bg-gray-100 text-gray-800 px-1 py-0.5 rounded text-sm font-mono">
                                    {children}
                                </code>
                            );
                        }
                        return (
                            <code className="block bg-gray-100 text-gray-800 p-3 rounded text-sm font-mono overflow-x-auto">
                                {children}
                            </code>
                        );
                    },
                    // Стилизация блоков кода
                    pre: ({ children }) => (
                        <pre className="bg-gray-100 p-3 rounded mb-3 overflow-x-auto">
                            {children}
                        </pre>
                    ),
                    // Стилизация ссылок
                    a: ({ children, href }) => (
                        <a 
                            href={href} 
                            className="text-blue-600 hover:text-blue-800 underline"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            {children}
                        </a>
                    ),
                    // Стилизация цитат
                    blockquote: ({ children }) => (
                        <blockquote className="border-l-4 border-blue-500 pl-4 italic text-gray-600 mb-3">
                            {children}
                        </blockquote>
                    ),
                    // Стилизация горизонтальной линии
                    hr: () => (
                        <hr className="border-gray-300 my-4" />
                    ),
                    // Стилизация таблиц
                    table: ({ children }) => (
                        <div className="overflow-x-auto mb-3">
                            <table className="min-w-full border border-gray-300">
                                {children}
                            </table>
                        </div>
                    ),
                    thead: ({ children }) => (
                        <thead className="bg-gray-50">
                            {children}
                        </thead>
                    ),
                    tbody: ({ children }) => (
                        <tbody>
                            {children}
                        </tbody>
                    ),
                    tr: ({ children }) => (
                        <tr className="border-b border-gray-300">
                            {children}
                        </tr>
                    ),
                    th: ({ children }) => (
                        <th className="px-3 py-2 text-left font-semibold text-gray-900 border-r border-gray-300">
                            {children}
                        </th>
                    ),
                    td: ({ children }) => (
                        <td className="px-3 py-2 text-gray-700 border-r border-gray-300">
                            {children}
                        </td>
                    ),
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    )
}
