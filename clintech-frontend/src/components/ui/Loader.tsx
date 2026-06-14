import React from 'react'
import '@/styles/ui.css'

export default function Loader({ loadingText }: { loadingText?: string }) {

    return (
        <div className="fixed inset-0 flex flex-col items-center justify-center min-h-screen  bg-white bg-opacity-60 z-50">
            <div className="loading">
                <svg height="48px" width="64px">
                    <polyline id="back" points="0.157 23.954, 14 23.954, 21.843 48, 43 0, 50 24, 64 24"></polyline>
                    <polyline id="front" points="0.157 23.954, 14 23.954, 21.843 48, 43 0, 50 24, 64 24"></polyline>
                </svg>
            </div>
            {loadingText && <p className="text-gray-600 mt-4">{loadingText}</p>}
        </div>
    )
}
