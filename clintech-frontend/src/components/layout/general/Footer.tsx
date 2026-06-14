import Link from "next/link";
import { MapPinIcon } from "lucide-react";
import { socials } from "@/arrays/layout/socials";

export default function Footer() {
    return (
        <footer className="w-full bg-gradient-to-br from-primaryDark via-primary to-accent text-white shadow-card">
            {/* Основной контент */}
            <div className="container px-4 py-5 grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Колонка 1: Логотип и описание */}
                <div>
                    <h1 className="text-2xl font-bold mb-3 flex items-center gap-2">
                        <Link href="/" className="flex items-center gap-2">
                            <span className="font-ibm text-white font-bold text-[32px] leading-[100%]">
                                Clintech<span className="">AI</span>
                            </span>
                        </Link>
                    </h1>
                    <p className="text-white/90 text-lg leading-relaxed">
                        Ваш цифровой помощник для здоровья и медицинских консультаций. Мы заботимся о вашем благополучии каждый день.
                    </p>
                </div>

                {/* Колонка 2: Соцсети */}
                <div className="flex flex-col gap-3">
                    <div className="text-xl font-semibold mb-3">Контакты</div>
                    <div className="flex flex-row gap-6 text-3xl">
                        {socials.map((social) => (
                            <Link key={social.link} href={social.link} target="_blank" aria-label={social.ariaLabel} className="transition-colors hover:text-emerald-300">
                                {social.icon}
                            </Link>
                        ))}
                    </div>
                </div>

                {/* Колонка 3: Адрес */}
                <div>
                    <div className="flex flex-col xs:flex-row gap-2 font-semibold mb-3">
                        <span className="text-lg flex items-center gap-2">
                            <MapPinIcon className="w-6 h-6" />
                            Мы на карте:
                        </span>
                        <span className="text-lg">
                            <Link href="https://2gis.kz/almaty/firm/70000001044793584?m=76.91738%2C43.253243%2F18" target="_blank" className="text-white">
                                Толе би, 127, Алматы
                            </Link>
                        </span>
                    </div>
                    <div className="rounded-lg overflow-hidden shadow-md w-full h-60 bg-white">
                        {/* Можно вставить карту или просто адрес */}
                        <iframe
                            title="map"
                            src="https://maps.google.com/maps?q=Улица%20Толе%20би%20127%2C%20Алматы&t=&z=16&ie=UTF8&iwloc=&output=embed"
                            width="100%"
                            height="100%"
                            style={{ border: 0 }}
                            allowFullScreen
                            loading="lazy"
                        />
                    </div>

                </div>
            </div>

            {/* Копирайт */}
            <div className="border-t border-white/30 mt-6">
                <div className="max-w-6xl mx-auto px-4 py-4 text-center text-sm text-white/70">
                    © {new Date().getFullYear()} Clintech. Все права защищены.
                </div>
            </div>
        </footer>
    );
}