import { NextRequest } from 'next/server';
import { getTokenFromCookies, createUnauthorizedResponse } from '@/utils/auth';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const token = getTokenFromCookies(req);
    if (!token) return createUnauthorizedResponse();
    const { id } = await params;
    if (!process.env.ANKETA_SERVICE) {
        return new Response(JSON.stringify({ error: 'ANKETA_SERVICE не настроен' }), { status: 500 });
    }
    const body = await req.text();
    const url = `${process.env.ANKETA_SERVICE}/questionnaire/question/${id}`;
    const res = await fetch(url, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body
    });
    const data = await res.json();
    return new Response(JSON.stringify(data), { status: res.status, headers: { 'Content-Type': 'application/json' } });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const token = getTokenFromCookies(req);
    if (!token) return createUnauthorizedResponse();
    const { id } = await params;
    if (!process.env.ANKETA_SERVICE) {
        return new Response(JSON.stringify({ error: 'ANKETA_SERVICE не настроен' }), { status: 500 });
    }
    const url = `${process.env.ANKETA_SERVICE}/questionnaire/question/${id}`;
    const res = await fetch(url, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    return new Response(JSON.stringify(data), { status: res.status, headers: { 'Content-Type': 'application/json' } });
} 