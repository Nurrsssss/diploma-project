export type TChannel = 'cabinet' | 'home' | 'online' | 'lab';

export type TColumn = {
  key: string;
  title: string;
  channel: TChannel;
  cabinet_number?: number; // только для cabinet
};

export const SCHEDULE_COLUMNS: TColumn[] = [
  { key: 'cab-1', title: 'Кабинет 1', channel: 'cabinet', cabinet_number: 1 },
  { key: 'cab-2', title: 'Кабинет 2', channel: 'cabinet', cabinet_number: 2 },
  { key: 'cab-3', title: 'Кабинет 3', channel: 'cabinet', cabinet_number: 3 },
  { key: 'cab-4', title: 'Кабинет 4', channel: 'cabinet', cabinet_number: 4 },
  { key: 'cab-5', title: 'Кабинет 5', channel: 'cabinet', cabinet_number: 5 },
  { key: 'cab-6', title: 'Кабинет 6', channel: 'cabinet', cabinet_number: 6 },
  { key: 'home', title: 'Вызов на дом', channel: 'home' },
  { key: 'online', title: 'Онлайн консультация', channel: 'online' },
  { key: 'lab', title: 'Анализы', channel: 'lab' },
];
