import { NextRequest, NextResponse } from 'next/server';
import { anketaServiceBase, upstreamAuthHeaders } from '@/app/api/health-passport/_anketa';

export async function POST(req: NextRequest) {
  const base = anketaServiceBase();
  if (!base) {
    return NextResponse.json(
      { error: 'Сервис анкеты не настроен', details: 'Задайте ANKETA_SERVICE в .env' },
      { status: 500 },
    );
  }

  const auth = upstreamAuthHeaders(req);
  if (!auth.Authorization) {
    return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 });
  }

  const body = await req.text();
  const upstream = await fetch(`${base.replace(/\/$/, '')}/patient-recommendations/generate`, {
    method: 'POST',
    headers: {
      ...auth,
      'Content-Type': 'application/json',
    },
    body,
    cache: 'no-store',
  });

  const text = await upstream.text();
  const ct = upstream.headers.get('Content-Type') || 'application/json';
  return new NextResponse(text, {
    status: upstream.status,
    headers: { 'Content-Type': ct },
  });
}
