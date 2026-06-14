import React from 'react'
import Image from 'next/image'
import { services } from '@/arrays/home/service'

export default function ServiceSection() {

  return (
    <section className="my-16">
      <div className="container mx-auto px-4">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-12">
          <div className="relative order-2 h-[400px] overflow-hidden rounded-2xl shadow-card ring-1 ring-slate-200/60 lg:order-1">
            <Image
              src="/image/doctor-with-patient.svg"
              alt="Врач с пациентом"
              fill
              className="object-cover rounded-2xl"
            />
          </div>
          <div className="order-1 space-y-6 rounded-2xl border border-slate-200/80 bg-surface p-6 shadow-soft sm:p-8 lg:order-2">
            <h2 className="bg-gradient-to-r from-primaryDark via-primary to-accent bg-clip-text text-3xl font-bold tracking-tight text-transparent">
              Виды услуг
            </h2>

            <ul className="space-y-3">
              {services.map((service, index) => (
                <li key={index} className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3 transition-colors hover:border-primary/20 hover:bg-white">
                  <svg className="mt-0.5 h-5 w-5 shrink-0 text-primary" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <h3 className="text-slate-700">{service.title}</h3>
                </li>
              ))}
            </ul>

          </div>
        </div>
      </div>
    </section>
  );
}
