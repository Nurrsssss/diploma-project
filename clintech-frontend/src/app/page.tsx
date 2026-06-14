'use client';

import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import SidebarLayout from '@/components/layout/navigation/SidebarLayout';

export default function HomePage() {
  const { isLoggedIn } = useAuth();

  const content = (
    <section className="mx-auto w-full max-w-6xl px-6 py-10 md:py-14">
      <div className="relative overflow-hidden rounded-3xl border border-cyan-100 bg-gradient-to-br from-cyan-50 via-white to-blue-50 p-8 shadow-sm md:p-12">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-cyan-200/40 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-10 h-56 w-56 rounded-full bg-blue-200/30 blur-3xl" />

        <p className="inline-flex rounded-full border border-cyan-200 bg-white/80 px-3 py-1 text-xs font-medium text-cyan-700">
          Digital Health Platform
        </p>

        <h1 className="mt-4 text-3xl font-bold tracking-tight text-gray-900 md:text-5xl">
          ClinTech
        </h1>
        <p className="mt-4 max-w-2xl text-base text-gray-600 md:text-lg">
          Умная экосистема для записи к врачу, онлайн-консультаций и персонального маршрута здоровья.
          Легко для пациента, удобно для врача, понятно для ресепшна.
        </p>

        <div className="mt-7 flex flex-wrap gap-3">
          
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="text-sm font-semibold text-cyan-700">Быстрая запись</div>
          <p className="mt-2 text-sm text-gray-600">
            Выбирайте врача, время и формат консультации за пару шагов.
          </p>
        </article>

        <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="text-sm font-semibold text-cyan-700">История приемов</div>
          <p className="mt-2 text-sm text-gray-600">
            Все ваши визиты, статусы и документы собраны в одном месте.
          </p>
        </article>

        <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="text-sm font-semibold text-cyan-700">Единое пространство</div>
          <p className="mt-2 text-sm text-gray-600">
            Врачи, пациенты и ресепшн работают синхронно в единой системе.
          </p>
        </article>
      </div>
    </section>
  );

  return (
    <main className="w-full overflow-x-hidden bg-transparent">
      {isLoggedIn ? (
        <SidebarLayout>
          {content}
        </SidebarLayout>
      ) : (
        content
      )}
    </main>
  );
}
