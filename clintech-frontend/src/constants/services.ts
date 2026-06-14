export type TService = {
  id: string;
  title: string;
  duration_min?: number;
  category?: string;
};

export const SERVICES: TService[] = [
  { id: 'svc-visit', title: 'Приём врача', duration_min: 30, category: 'Приём' },
  { id: 'svc-online', title: 'Онлайн консультация', duration_min: 30, category: 'Онлайн' },
  { id: 'svc-home', title: 'Вызов на дом', duration_min: 60, category: 'Дом' },
  { id: 'svc-lab', title: 'Анализы', duration_min: 15, category: 'Лаборатория' },
];
