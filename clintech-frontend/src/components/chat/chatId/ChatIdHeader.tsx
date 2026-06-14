import { TAnalysis } from '@/types/questionnaire'
import { BrainIcon, CalendarIcon, ClockIcon } from 'lucide-react'
import React from 'react'
import { formatDateWithTime } from '@/utils/date'

export default function ChatIdHeader({ analysis }: { analysis: TAnalysis }) {
    return (
        <div className=' flex flex-row items-center gap-2 md:gap-4 p-4 bg-white rounded-lg'>
            <div className='w-fit rounded-lg bg-primary p-2 text-white md:p-4'>
                <BrainIcon className='w-7 h-7 md:w-8 md:h-8' />
            </div>
            <div>
                <h1 className='text-xl md:text-2xl font-bold'>Предварительный прием ИИ</h1>
                <p className='flex items-center gap-6'>
                    <span className='flex items-center gap-2'>
                        <CalendarIcon className='w-4 h-4' />
                        {formatDateWithTime(analysis.created_at).split(',')[0]}
                    </span>
                    <span className='flex items-center gap-2'>
                        <ClockIcon className='w-4 h-4' />
                        {formatDateWithTime(analysis.created_at).split(',')[1]}
                    </span>
                </p>
            </div>
        </div>
    )
}
