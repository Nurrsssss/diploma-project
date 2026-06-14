import { NextRequest } from 'next/server';
import { getTokenFromCookies } from '@/utils/auth';

export function anketaServiceBase(): string | null {
  const u = process.env.ANKETA_SERVICE?.trim();
  return u || null;
}

/** Проксируем Authorization с клиента (Bearer) или из cookie auth_token. */
export function upstreamAuthHeaders(req: NextRequest): Record<string, string> {
  const headers: Record<string, string> = {};
  const incoming = req.headers.get('Authorization');
  if (incoming) {
    headers.Authorization = incoming.startsWith('Bearer ') ? incoming : `Bearer ${incoming}`;
    return headers;
  }
  const token = getTokenFromCookies(req);
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}
