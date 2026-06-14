import React from 'react'
import Image from 'next/image'
import LoginForm from '@/components/auth/LoginForm'
import Link from 'next/link'

export default function LoginPage() {
    return (
        <div className="grid h-screen w-screen bg-gradient-to-br from-teal-50 via-cyan-50 to-slate-100 md:grid-cols-5">
            <div
                className="relative hidden grid-flow-row grid-cols-2 bg-custom-gradient shadow-card md:col-span-3 md:grid md:rounded-r-3xl md:ring-1 md:ring-white/10"
            >
                <div className='row-span-1 absolute top-[7%] left-[7%]'>
                    <h1 className='font-outfit text-7xl font-bold text-cyan-100 lg:text-8xl xl:text-[143px]'>Clintech</h1>
                    <h2 className='mt-[40px] flex items-center gap-4 font-outfit text-2xl font-normal text-teal-100'>
                        <span className="relative w-8 h-8 xl:w-[50px] xl:h-[50px]">
                          <Image src='/image/pulse.svg' alt='pulse' fill className="object-contain"/>
                        </span>
                        Ваш личный Помощник
                    </h2>
                    <h3 className='font-outfit font-normal text-white text-xl w-[476px] h-[75px] mt-7 uppercase'>
                        Clintech
                        — современное приложение, где вы можете легко записаться к врачу онлайн в удобное для вас
                        время.
                    </h3>

                </div>

                <div className='items-center hidden md:block absolute bottom-[9%] left-[9%] space-x-5'>
                    <button className='shadow-none'>
                        <Link href='/' className='flex items-center gap-2 text-2xl font-bold '>
                            <p className='flex items-center gap-2 rounded-full bg-teal-100/90 px-4 py-4 font-outfit text-sm font-medium text-teal-900 transition-all duration-300 hover:scale-105 hover:bg-cyan-100'>
                                Главный Экран
                            </p>
                        </Link>
                    </button>

                    <button className='shadow-none'>
                        <Link href='/' className='flex items-center gap-2 text-2xl font-bold rounded-full'>
                            <p className='flex items-center gap-2 rounded-full bg-teal-100/90 px-4 py-4 font-outfit text-sm font-medium text-teal-900 transition-all duration-300 hover:scale-105 hover:bg-cyan-100'>
                                <Image src="/image/arrow-right.svg" width={14} height={14} alt="arrow"/>
                            </p>
                        </Link>
                    </button>
                </div>
            </div>
            <div className='col-span-5 flex flex-col bg-surface p-4 md:col-span-2 md:rounded-l-3xl lg:p-8 2xl:p-10'>
                <LoginForm />
            </div>
        </div>
    )
}

