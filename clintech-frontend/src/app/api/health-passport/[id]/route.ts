import { NextRequest, NextResponse } from 'next/server';
import { anketaServiceBase, upstreamAuthHeaders } from '@/app/api/health-passport/_anketa';

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
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

  const { id } = await ctx.params;
  const url = `${base.replace(/\/$/, '')}/health-passport/${encodeURIComponent(id)}`;

  const upstream = await fetch(url, {
    method: 'GET',
    headers: { ...auth, Accept: 'application/json' },
    cache: 'no-store',
  });

  const text = await upstream.text();
  const ct = upstream.headers.get('Content-Type') || 'application/json';
  return new NextResponse(text, {
    status: upstream.status,
    headers: { 'Content-Type': ct },
  });
}
