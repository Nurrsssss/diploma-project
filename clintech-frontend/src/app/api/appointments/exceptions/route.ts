/*
Управление закрытиями расписания врача
POST - создание закрытия (day_off или custom_hours)
GET - получение списка закрытий в период
*/

function getAuthToken(req: Request) {
  return req.headers.get('cookie')?.match(/auth_token=([^;]+)/)?.[1];
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const authToken = getAuthToken(req);
    if (!authToken) {
      return new Response(
        JSON.stringify({ success: false, error: 'Токен авторизации не найден' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // ✅ поддерживаем specialist_id/doctor_user_id для ресепшн
    // фронт может прислать либо specialist_id, либо doctor_user_id — нормализуем
    const specialistId =
      body?.specialist_id || body?.doctor_user_id || body?.doctorId || undefined;

    const payload = {
      ...body,
      ...(specialistId ? { specialist_id: String(specialistId).trim() } : {}),
    };

    const gateway = process.env.GATEWAY || 'http://185.125.46.62:8800';
    const backendRes = await fetch(`${gateway}/appointments/exceptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(payload),
    });

    let data: any;
    try {
      data = await backendRes.json();
    } catch {
      data = { success: false, error: 'Некорректный ответ от сервера' };
    }

    return new Response(JSON.stringify(data), {
      status: backendRes.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, error: e.message || 'Ошибка сервера' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    // ✅ ВАЖНО: прокидываем specialist_id (или doctor_user_id)
    const specialistId =
      searchParams.get('specialist_id') ||
      searchParams.get('doctor_user_id') ||
      searchParams.get('doctorId');

    const authToken = getAuthToken(req);
    if (!authToken) {
      return new Response(
        JSON.stringify({ success: false, error: 'Токен авторизации не найден' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const gateway = process.env.GATEWAY || 'http://185.125.46.62:8800';
    const url = new URL(`${gateway}/appointments/exceptions`);
    if (startDate) url.searchParams.set('start_date', startDate);
    if (endDate) url.searchParams.set('end_date', endDate);

    if (specialistId) {
      url.searchParams.set('specialist_id', String(specialistId).trim());
    }

    const backendRes = await fetch(url.toString(), {
      method: 'GET',
      headers: { Authorization: `Bearer ${authToken}` },
    });

    let data: any;
    try {
      data = await backendRes.json();
    } catch {
      data = { success: false, error: 'Некорректный ответ от сервера' };
    }

    return new Response(JSON.stringify(data), {
      status: backendRes.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, error: e.message || 'Ошибка сервера' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
