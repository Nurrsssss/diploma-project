// export const formatDate = (dateString: string | undefined | null): string => {
//     if (!dateString) return 'Не указано';
//     try {
//         return new Date(dateString).toLocaleDateString('ru-RU');
//     } catch {
//         return 'Не указано';
//     }
// };

// export const formatDateWithTime = (dateString: string | undefined | null): string => {
//     if (!dateString) return 'Не указано';
//     try {
//         return new Date(dateString).toLocaleDateString('ru-RU', {
//             day: '2-digit',
//             month: '2-digit',
//             year: 'numeric',
//             hour: '2-digit',
//             minute: '2-digit'
//         });
//     } catch {
//         return 'Не указано';
//     }
// };

// /**
//  * Форматирование даты с полным названием месяца и днем недели
//  */
// export const formatDateFull = (dateString: string | undefined | null): string => {
//     if (!dateString) return 'Не указано';
//     try {
//         const date = new Date(dateString);
//         const options: Intl.DateTimeFormatOptions = {
//             year: 'numeric',
//             month: 'long',
//             day: 'numeric',
//             weekday: 'long'
//         };
//         return date.toLocaleDateString('ru-RU', options);
//     } catch {
//         return 'Не указано';
//     }
// };

// /**
//  * Расчет возраста на основе даты рождения
//  */
// export const calculateAge = (birthDate: string | undefined | null): number => {
//     if (!birthDate) return 0;
//     try {
//         const birth = new Date(birthDate);
//         const today = new Date();
//         let age = today.getFullYear() - birth.getFullYear();
//         const monthDiff = today.getMonth() - birth.getMonth();
        
//         if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
//             age--;
//         }
        
//         return age;
//     } catch {
//         return 0;
//     }
// };

// // Генерируем массив дат на DAYS (по умолчанию 14) дней вперед
// export const generateDates = (days: number = 14) => {
//     const dates = []
//     for (let i = 0; i < days; i++) {
//         const date = new Date()
//         date.setDate(date.getDate() + i)
//         dates.push({
//             date: date.toLocaleDateString('en-CA'), // YYYY-MM-DD в локальном часовом поясе
//             displayDate: i === 0 ? 'Сегодня' : i === 1 ? 'Завтра' : date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }),
//             dayOfWeek: date.toLocaleDateString('ru-RU', { weekday: 'short' })
//         })
//     }
//     return dates
// }

// src/utils/date.ts
// src/utils/date.ts

export const KZ_TZ = 'Asia/Almaty';

/* =========================
   Казахстанские YYYY-MM-DD
========================= */
export function ymdInKz(d: Date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: KZ_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);

  const y = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const m = parts.find((p) => p.type === 'month')?.value ?? '01';
  const day = parts.find((p) => p.type === 'day')?.value ?? '01';

  return `${y}-${m}-${day}`;
}

// Совместимость со старым названием
export function todayYmdLocal() {
  return ymdInKz();
}

// Совместимость со старым названием
export function addDaysYmdLocal(days: number, from: Date = new Date()) {
  const d = new Date(from.getTime());
  // добавляем дни устойчиво, потом форматируем в KZ TZ
  d.setUTCDate(d.getUTCDate() + days);
  return ymdInKz(d);
}

// Новое имя (если используешь где-то)
export function addDaysYmdInKz(days: number, from: Date = new Date()) {
  return addDaysYmdLocal(days, from);
}

/* =========================
   Форматирование дат
   (сделано tolerant к undefined)
========================= */
export function formatDate(date?: string | Date | null) {
  if (!date) return '—';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: KZ_TZ,
  });
}

export function formatDateWithTime(date?: string | Date | null) {
  if (!date) return '—';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: KZ_TZ,
  });
}

/* =========================
   calculateAge (вернуть экспорт)
========================= */
export function calculateAge(birthDate?: string | Date | null): number {
  if (!birthDate) return 0;
  const d = new Date(birthDate);
  if (Number.isNaN(d.getTime())) return 0;

  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();

  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;

  return Math.max(age, 0);
}

/* =========================
   generateDates (вернуть экспорт)
   Генерирует массив YYYY-MM-DD (локально/KZ)
========================= */
// overload signatures
export type TGeneratedDate = {
  date: string;        // YYYY-MM-DD
  displayDate: string; // например "02 мар"
  dayOfWeek: string;   // например "Пн"
};

function kzDisplayDate(ymd: string) {
  // ymd: YYYY-MM-DD
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1, 0, 0, 0));

  // "02 мар" (коротко)
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: KZ_TZ,
    day: '2-digit',
    month: 'short',
  }).format(dt);
}

function kzDayOfWeek(ymd: string) {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1, 0, 0, 0));

  // "Пн", "Вт"...
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: KZ_TZ,
    weekday: 'short',
  }).format(dt);
}
// overload signatures
export function generateDates(days: number): TGeneratedDate[];
export function generateDates(startYmd: string, endYmd: string): TGeneratedDate[];

// implementation
export function generateDates(a: number | string, b?: string): TGeneratedDate[] {
  // generateDates(30) => [{date:'YYYY-MM-DD'}, ...] в KZ
  if (typeof a === 'number') {
    const start = ymdInKz(new Date());
    const end = addDaysYmdLocal(a);
    return generateDates(start, end);
  }

  const startYmd = a;
  const endYmd = b ?? a;

  const parse = (s: string) => {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(Date.UTC(y, (m || 1) - 1, d || 1, 0, 0, 0));
  };

  const start = parse(startYmd);
  const end = parse(endYmd);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
  if (start.getTime() > end.getTime()) return [];

  const out: TGeneratedDate[] = [];
  const cur = new Date(start.getTime());
while (cur.getTime() <= end.getTime()) {
  const date = ymdInKz(cur);

  out.push({
    date,
    displayDate: kzDisplayDate(date),
    dayOfWeek: kzDayOfWeek(date),
  });

  cur.setUTCDate(cur.getUTCDate() + 1);
}
  return out;
}