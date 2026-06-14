'use client'
import React from 'react';
import Image from "next/image";
import { features, stats } from '@/arrays/home/hero';
import { useAuth } from '@/context/AuthContext';

export default function MainHero() {
    const {isLoggedIn } = useAuth();    

    return (
        <section className={`px-4 relative ${!isLoggedIn ? 'mt-16 md:mt-12 lg:mt-16' : 'mt-0'} min-h-screen overflow-hidden bg-hero-mesh bg-lightBg`}>

            <div className="relative container pb-4">

                {/* Main content */}
                <div className="grid grid-cols-1 xl:grid-cols-2 lg:gap-12 items-center">
                    {/* Left column - Text content */}
                    <div className="space-y-6 sm:space-y-8 order-2 lg:order-1">
                        <h1 className="mt-4 break-words bg-gradient-to-r from-primaryDark via-primary to-accent bg-clip-text text-4xl font-bold leading-tight text-transparent sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl">
                            Clintech — твой личный помощник
                        </h1>

                        <h2 className="text-slate-600 text-xl leading-relaxed max-w-none lg:max-w-2xl">
                            Клиника "Clintech" имеет честь предложить услуги персональных врачей в области предупреждения,
                            раннего выявления и управления заболеваниями.
                        </h2>

                        {/* Features grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-6 mt-8 sm:mt-12">
                            {features.map((feature, index) => (
                                <div key={index} className="group flex items-start gap-4 sm:gap-4 rounded-2xl border border-slate-200/80 bg-surface/90 p-5 sm:p-4 shadow-soft backdrop-blur-sm transition-all duration-300 hover:border-primary/25 hover:shadow-card">
                                    <div className="flex-shrink-0 rounded-xl bg-primary/10 p-3 text-primary transition-colors group-hover:bg-primary/15">
                                        {feature.icon}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h3 className="text-lg font-semibold text-slate-900">{feature.title}</h3>
                                        <h4 className="text-md mt-1 text-slate-600 lg:text-lg">{feature.description}</h4>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right column - Image */}
                    <div className="relative order-1 lg:order-2">
                        <div className="relative hidden xl:block z-10 w-full max-w-md sm:max-w-lg lg:max-w-none mx-auto">
                            <Image
                                src="/image/home/main-2doctors.svg"
                                alt="Doctors"
                                width={600}
                                height={600}
                                className="w-full h-auto object-contain"
                            />
                        </div>
                        {/* Decorative circle */}
                        <div className="absolute top-1/2 right-0 h-32 w-32 -translate-y-1/2 rounded-full bg-primary opacity-15 blur-3xl sm:h-48 sm:w-48 lg:h-64 lg:w-64"></div>
                    </div>
                </div>

                {/* Bottom stats section */}
                <div className="mt-16 sm:mt-20 rounded-2xl bg-custom-gradient px-2 py-8 shadow-card sm:p-8 lg:p-12 ring-1 ring-white/20">
                    <div className="grid grid-cols-1 gap-6 text-white sm:gap-8 md:grid-cols-3">
                        {stats.map((stat, index) => (
                            <div
                                key={index}
                                className={`text-center ${index === 0 ? 'md:text-left' : index === 1 ? 'md:text-center' : 'md:text-right'} border-b border-white/20 pb-6 last:border-0 last:pb-0 md:border-0 md:border-r md:border-white/25 md:pb-0 md:pr-8 last:md:border-r-0 last:md:pr-0`}
                            >
                                <h3 className="text-lg sm:text-xl lg:text-2xl xl:text-3xl font-bold mb-2 leading-tight">{stat.title}</h3>
                                <h4 className="text-white/80 text-md sm:text-base">{stat.description}</h4>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
} 