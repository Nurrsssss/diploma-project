import { getTokenFromCookies, createUnauthorizedResponse } from '@/utils/auth';

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;

    const token = getTokenFromCookies(req);
    if (!token) return createUnauthorizedResponse();

    // ✅ забираем query из входящего запроса
    const incomingUrl = new URL(req.url);

    // ✅ строим upstream URL и приклеиваем query
    const upstream = new URL(
      `${process.env.CALENDAR_SERVICE}/appointments/schedules/${resolvedParams.id}`
    );
    upstream.search = incomingUrl.search; // <— ВАЖНО

    const body = await req.text();

    const backendRes = await fetch(upstream.toString(), {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body,
    });

    const data = await backendRes.json();
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

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;

    const token = getTokenFromCookies(req);
    if (!token) return createUnauthorizedResponse();

    // ✅ забираем query из входящего запроса
    const incomingUrl = new URL(req.url);

    // ✅ строим upstream URL и приклеиваем query
    const upstream = new URL(
      `${process.env.CALENDAR_SERVICE}/appointments/schedules/${resolvedParams.id}`
    );
    upstream.search = incomingUrl.search; // <— ВАЖНО

    const backendRes = await fetch(upstream.toString(), {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await backendRes.json();
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
