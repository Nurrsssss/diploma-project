import React from 'react'
import MyButton from '../ui/MyButton'

interface IPaginationProps {
    page: number;
    totalPages: number;
    onPageChange: (page: number) => void;
}

export default function Pagination({ page, totalPages, onPageChange }: IPaginationProps) {
    return (
        <div className="flex items-center justify-center gap-4 py-4">
            <MyButton
                onClick={() => onPageChange(page - 1)}
                disabled={page === 1}
                className={`${page === 1
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    : 'bg-primary hover:bg-primary/90 text-white'
                    }`}
            >
                Назад
            </MyButton>

            <span className="text-lg">
                Страница <span className="font-bold">{page}</span> из {totalPages}
            </span>

            <MyButton
                onClick={() => onPageChange(page + 1)}
                disabled={page === totalPages}
                className={`${page === totalPages
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    : 'bg-primary hover:bg-primary/90 text-white'
                    }`}
            >
                Вперед
            </MyButton>
        </div>
    )
}
