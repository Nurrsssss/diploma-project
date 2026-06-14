import { NextRequest } from 'next/server';
import { getTokenFromCookies, createUnauthorizedResponse } from '@/utils/auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const token = getTokenFromCookies(req);
    if (!token) return createUnauthorizedResponse('Требуется авторизация');

    const gateway = process.env.GATEWAY || 'http://185.125.46.62:8800';
    const backendRes = await fetch(`${gateway}/appointments/${id}/transcription`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const text = await backendRes.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { error: 'Некорректный ответ сервера' }; }

    return new Response(JSON.stringify(data), {
      status: backendRes.status,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || 'Ошибка сервера' }), { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const token = getTokenFromCookies(req);
    if (!token) return createUnauthorizedResponse('Требуется авторизация');

    const body = await req.text(); // поддержка sendBeacon/keepalive
    const gateway = process.env.GATEWAY || 'http://185.125.46.62:8800';
    const backendRes = await fetch(`${gateway}/appointments/${id}/transcription`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body
    });

    const text = await backendRes.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { error: 'Некорректный ответ сервера' }; }

    return new Response(JSON.stringify(data), {
      status: backendRes.status,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || 'Ошибка сервера' }), { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const token = getTokenFromCookies(req);
    if (!token) return createUnauthorizedResponse('Требуется авторизация');

    const gateway = process.env.GATEWAY || 'http://185.125.46.62:8800';
    const backendRes = await fetch(`${gateway}/appointments/${id}/transcription`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const text = await backendRes.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { error: 'Некорректный ответ сервера' }; }

    return new Response(JSON.stringify(data), {
      status: backendRes.status,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || 'Ошибка сервера' }), { status: 500 });
  }
}


