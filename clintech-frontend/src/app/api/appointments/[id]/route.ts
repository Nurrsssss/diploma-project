import { NextRequest } from 'next/server';
import { getTokenFromCookies, createUnauthorizedResponse } from '@/utils/auth';

export const runtime = 'nodejs';

function getGatewayBase() {
  return process.env.GATEWAY || 'http://185.125.46.62:8800';
}

async function proxyToBackend(
  method: 'GET' | 'PUT' | 'DELETE',
  id: string,
  authToken: string,
  body?: string
) {
  const backendUrl = `${getGatewayBase()}/appointments/${id}`;

  const backendRes = await fetch(backendUrl, {
    method,
    headers: {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
    body,
  });

  const text = await backendRes.text();

  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: 'Некорректный ответ от сервера', raw: text };
  }

  return new Response(JSON.stringify(data), {
    status: backendRes.status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userToken = getTokenFromCookies(req);
    if (!userToken) return createUnauthorizedResponse('Требуется авторизация');

    const { id } = await params;
    if (!id) {
      return new Response(JSON.stringify({ error: 'ID записи обязателен' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return await proxyToBackend('GET', id, userToken);
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'Ошибка сервера' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userToken = getTokenFromCookies(req);
    if (!userToken) return createUnauthorizedResponse('Требуется авторизация');

    const { id } = await params;
    if (!id) {
      return new Response(JSON.stringify({ error: 'ID записи обязателен' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await req.text();

    return await proxyToBackend('PUT', id, userToken, body);
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'Ошибка сервера' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userToken = getTokenFromCookies(req);
    if (!userToken) return createUnauthorizedResponse('Требуется авторизация');

    const { id } = await params;
    if (!id) {
      return new Response(JSON.stringify({ error: 'ID записи обязателен' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return await proxyToBackend('DELETE', id, userToken);
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'Ошибка сервера' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}