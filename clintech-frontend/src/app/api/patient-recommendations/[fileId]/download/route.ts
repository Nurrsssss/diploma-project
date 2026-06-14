import { NextRequest, NextResponse } from 'next/server';
import { anketaServiceBase, upstreamAuthHeaders } from '@/app/api/health-passport/_anketa';

export async function GET(req: NextRequest, ctx: { params: Promise<{ fileId: string }> }) {
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

  const { fileId } = await ctx.params;
  const url = `${base.replace(/\/$/, '')}/patient-recommendations/${encodeURIComponent(fileId)}/download`;

  const upstream = await fetch(url, {
    method: 'GET',
    headers: { ...auth },
    cache: 'no-store',
  });

  const buf = await upstream.arrayBuffer();
  const res = new NextResponse(buf, { status: upstream.status });

  const pass = ['content-type', 'content-disposition'] as const;
  for (const name of pass) {
    const v = upstream.headers.get(name);
    if (v) res.headers.set(name, v);
  }

  return res;
}
