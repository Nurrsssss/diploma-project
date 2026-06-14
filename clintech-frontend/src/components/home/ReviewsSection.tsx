'use client';

import Image from 'next/image';

export default function ReviewsSection() {
  
  return (
    <section className="my-16 bg-hero-mesh py-12">
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-start lg:items-center">
          {/* Левая часть */}
          <div className="space-y-4 lg:space-y-6 text-left">
            <h2 className="text-2xl font-bold leading-tight text-slate-900 sm:text-3xl lg:text-4xl">
              Что говорят о нас<br />
              <span className="bg-gradient-to-r from-primaryDark via-primary to-accent bg-clip-text text-transparent">наши врачи</span>
            </h2>
            <p className="text-md max-w-sm leading-relaxed text-slate-600 lg:max-w-xs">
              В составе наших врачей есть специалисты всех направлений
            </p>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 mt-4 lg:mt-6 justify-start w-full">
              <div className="flex -space-x-2 sm:-space-x-4">
                <img src="/image/home/Ellipse 7.png" alt="user1" className="w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 rounded-full border-2 border-white" />
                <img src="/image/home/Ellipse 8.png" alt="user2" className="w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 rounded-full border-2 border-white" />
                <img src="/image/home/Ellipse 9.png" alt="user3" className="w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 rounded-full border-2 border-white" />
                <img src="/image/home/Ellipse 10.png" alt="user4" className="w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 rounded-full border-2 border-white" />
                <img src="/image/home/Ellipse 11.png" alt="user5" className="w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 rounded-full border-2 border-white" />
                <img src="/image/home/Ellipse 12.png" alt="user6" className="w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 rounded-full border-2 border-white" />
              </div>
              <span className="text-xl font-bold text-slate-900 sm:text-2xl">100+ отзывов</span>
            </div>
          </div>
          {/* Правая часть — карточка отзыва */}
          <div className="mx-auto max-w-xl rounded-2xl border border-slate-200/80 bg-surface p-4 shadow-card sm:p-6 lg:mx-0 lg:p-8">
            <div className="flex items-center gap-3 sm:gap-4 mb-4">
              <Image src="/image/home/vrach-women.png" alt="Ермакова Ирина Александровна" width={40} height={40} className="sm:w-12 sm:h-12 rounded-full object-cover" />
              <div className="flex-1">
                <h2 className="font-bold text-gray-900 leading-tight text-sm sm:text-base">Ермакова Ирина Александровна</h2>
                <h3 className="text-gray-500 text-xs sm:text-sm">Врач Терапевт</h3>
              </div>
              <div className="flex items-center gap-1">
                {[1,2,3,4,5].map(i => (
                  <svg key={i} className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-yellow-400 fill-yellow-400" viewBox="0 0 20 20"><polygon points="9.9,1.1 7.6,6.6 1.6,7.5 6,11.7 4.9,17.6 9.9,14.7 14.9,17.6 13.8,11.7 18.2,7.5 12.2,6.6 "/></svg>
                ))}
              </div>
            </div>
            <h3 className="text-gray-700 text-md leading-relaxed">
              Пациенты стали приходить более подготовленными, многие отмечают удобство записи и прозрачность процесса. Это повышает доверие к лечению и улучшает взаимодействие между врачом и пациентом.
            </h3>
          </div>
        </div>
      </div>
    </section>
  );
} 