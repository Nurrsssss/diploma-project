import { NextRequest } from 'next/server';
import { getTokenFromCookies, createUnauthorizedResponse } from '@/utils/auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ doctorId: string }> }) {
    const token = getTokenFromCookies(req);
    if (!token) return createUnauthorizedResponse();
    const { doctorId } = await params;
    if (!process.env.ANKETA_SERVICE) {
        return new Response(JSON.stringify({ error: 'ANKETA_SERVICE не настроен' }), { status: 500 });
    }
    const url = `${process.env.ANKETA_SERVICE}/health-passport/doctor/${doctorId}`;
    const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    return new Response(JSON.stringify(data), { status: res.status, headers: { 'Content-Type': 'application/json' } });
} 