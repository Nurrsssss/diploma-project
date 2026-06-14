import { NextRequest } from 'next/server';
import { getTokenFromCookies, createUnauthorizedResponse } from '@/utils/auth';

export async function POST(req: NextRequest) {
    const token = getTokenFromCookies(req);
    if (!token) return createUnauthorizedResponse();
    if (!process.env.ANKETA_SERVICE) {
        return new Response(JSON.stringify({ error: 'ANKETA_SERVICE не настроен' }), { status: 500 });
    }
    const body = await req.text();
    const url = `${process.env.ANKETA_SERVICE}/questionnaire/question`;
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body
    });
    const data = await res.json();
    return new Response(JSON.stringify(data), { status: res.status, headers: { 'Content-Type': 'application/json' } });
} 