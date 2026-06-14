'use client';

import Image from 'next/image';
import {FC} from 'react';

interface ButtonProps {
    onClick: () => void;
    className?: string;
}

export const DictButton: FC<ButtonProps> = ({onClick, className = ''}) => {
    return (
        <button
            onClick={onClick}
            className={`group w-32 h-32 flex items-center justify-center relative transition-all duration-300 hover:scale-110 active:scale-110 ${className}`}
        >
            <div
                className="absolute inset-0 z-0 animate-pulse rounded-full bg-teal-400/40 opacity-0 transition-opacity duration-300 group-active:opacity-80 group-hover:opacity-100"/>
            <div
                className="absolute inset-[-18px] z-0 animate-pulse rounded-full bg-cyan-300/35 opacity-0 transition-opacity duration-300 group-active:opacity-80 group-hover:opacity-100"
                style={{animationDelay: '0.2s'}}/>
            <Image
                src="/image/health-check/voice/dict.svg"
                alt="Dictophone"
                width={80}
                height={80}
                className="transition-all m-auto duration-300 group-hover:scale-105 group-active:scale-95 z-10"
            />
        </button>
    );
};

export const ControlButton: FC<ButtonProps & {type: 'remove' | 'done'}> = ({onClick, type, className = ''}) => {
    return (
        <button
            onClick={onClick}
            className={`group relative transition-all duration-300 hover:scale-110 active:scale-95 ${className}`}
        >
            <div
                className="absolute inset-0 rounded-full bg-teal-100/60 opacity-0 transition-opacity duration-300 group-active:opacity-80 group-hover:opacity-100"/>
            <Image
                src={`/image/health-check/voice/${type}.svg`}
                alt={type === 'remove' ? 'Remove' : 'Done'}
                width={56}
                height={56}
                className="relative rounded-full p-1 transition-all duration-300 group-hover:scale-105 group-active:scale-95"
            />
        </button>
    );
};

export const AudioRemoveButton: FC<ButtonProps> = ({onClick, className = ''}) => {
    return (
        <button
            onClick={onClick}
            className={`cursor-pointer group relative transition-all duration-300 hover:scale-110 active:scale-95 ${className}`}
        >
            <Image
                src="/image/health-check/voice/bin.svg"
                alt="Remove"
                width={32}
                height={32}
                className="relative p-1 transition-all duration-300 group-hover:scale-105 group-active:scale-95"
            />
        </button>
    );
}; 