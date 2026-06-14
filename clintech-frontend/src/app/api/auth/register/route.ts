/*
Создание нового аккаунта пользователя (пациент или врач)
Принимает email, пароль и роль.
*/

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const authBaseUrl = process.env.GATEWAY || process.env.BACKEND_URL;

    if (!authBaseUrl) {
      return new Response(JSON.stringify({ error: 'GATEWAY env is missing' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const backendRes = await fetch(`${authBaseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    });

    let data;
    try {
      data = await backendRes.json();
    } catch {
      data = { error: 'Некорректный ответ от сервера авторизации' };
    }

    return new Response(JSON.stringify(data), {
      status: backendRes.status,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || 'Ошибка сервера' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}