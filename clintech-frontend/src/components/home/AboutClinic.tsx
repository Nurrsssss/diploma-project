
import Image from 'next/image';

export default function AboutClinic() {
  return (
    <section className="my-16">
      <div className="container mx-auto px-4">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-12">
          <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-surface p-6 shadow-soft sm:p-8">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">
              О клинике <span className="bg-gradient-to-r from-primaryDark via-primary to-accent bg-clip-text text-transparent">&quot;Clintech&quot;</span>
            </h2>
            <h3 className="text-xl font-semibold text-slate-800">
              Революция в здравоохранении с помощью ИИ, объединяющего пациентов и врачей
            </h3>
            <h4 className="text-slate-600 leading-relaxed">
              Concierge клиника "Clintech" имеет честь предложить услуги персональных врачей в
              области предупреждения, раннего выявления и управления заболеваниями.
            </h4>
            <h5 className="text-slate-600 leading-relaxed">
              Ваш голосовой ответ сохранится и будет доступен врачу
              — это ускорит постановку предварительной рекомендации и облегчит диагностику
            </h5>
          </div>

          <div className="relative h-[400px] overflow-hidden rounded-2xl shadow-card ring-1 ring-slate-200/60">
            <Image
              src="/image/about/2docs.jpg"
              alt="Группа врачей Clintech"
              fill
              className="object-cover rounded-2xl md:hidden"
            />
            <Image
              src="/image/doctors.svg"
              alt="Группа врачей Clintech"
              fill
              className="object-cover rounded-2xl hidden md:block"
            />
          </div>
        </div>
      </div>
    </section>
  );
} 