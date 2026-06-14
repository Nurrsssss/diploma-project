import { NextRequest } from 'next/server';
import { getTokenFromCookies, createUnauthorizedResponse } from '@/utils/auth';

const GATEWAY = (
  process.env.APPOINTMENTS_GATEWAY?.trim() ||
  process.env.GATEWAY?.trim() ||
  'http://host.docker.internal:8800'
).replace(/\/+$/, '');

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const token = getTokenFromCookies(req);
  if (!token) {
    return createUnauthorizedResponse('Требуется авторизация для просмотра приёмов');
  }

  const backendUrl = `${GATEWAY}/appointments`;

  const res = await fetch(backendUrl, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  const text = await res.text();

  return new Response(text || '[]', {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  });
}

