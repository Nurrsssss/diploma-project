'use client'
import React from 'react'
import MyButton from './MyButton'
import { useRouter } from 'next/navigation'

interface NoContentProps {
    title: string
    description?: string
    icon?: React.ReactNode
    button?: string
    href?: string
}

export default function NoContent({ title, description, icon, button, href }: NoContentProps) {
    const router = useRouter()
    return (
        <div className="flex flex-col items-center justify-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300 shadow-inner w-full">
            {icon ? (
                icon
            ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-primary mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
            )}
            <h2 className="text-xl font-semibold text-gray-700 mb-2 text-center">{title}</h2>
            {description && <p className="text-gray-500 text-md text-center max-w-md">{description}</p>}
            {button && href &&
                <div className='mt-4 w-fit mx-auto'>
                    <MyButton className='w-fit bg-primary hover:bg-primary/90 text-white' onClick={() => router.push(href)}>{button}</MyButton>
                </div>
            }

        </div>
    )
}
