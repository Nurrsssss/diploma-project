import { getTokenFromCookies, createUnauthorizedResponse } from '@/utils/auth';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = getTokenFromCookies(req);
    if (!token) {
      return createUnauthorizedResponse('Требуется авторизация');
    }

    const { id } = await params;

    if (!id) {
      return new Response(JSON.stringify({ error: 'ID доктора обязателен' }), { status: 400 });
    }

    const url = new URL(req.url);

    const gateway = process.env.GATEWAY || 'http://185.125.46.62:8800';
    const backendUrl = new URL(`${gateway}/appointments/doctors/${id}/available-slots`);

    const passthroughParams = [
      'date',
      'start_date',
      'end_date',
      'start_time',
      'end_time',
      'appointment_type',
      'status',
      'include_all',
      'include_booked',
      'include_cancelled',
      'all',
      'doctor_user_id',
      'specialist_id',
      'alt_doctor_id',
    ];

    for (const key of passthroughParams) {
      const value = url.searchParams.get(key);
      if (value !== null && value !== '') {
        backendUrl.searchParams.set(key, value);
      }
    }

    const backendRes = await fetch(backendUrl.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    let data;
    try {
      data = await backendRes.json();
    } catch {
      data = { error: 'Некорректный ответ от сервера календаря' };
    }

    return new Response(JSON.stringify(data), {
      status: backendRes.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || 'Ошибка сервера' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}