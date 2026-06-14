import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function getAuthToken(req?: NextRequest): Promise<string | null> {
    // ✅ Получаем токен из HttpOnly cookie
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    
    return token || null;
}

export async function requireAuth(req: NextRequest): Promise<NextResponse | null> {
    const token = await getAuthToken(req);
    
    if (!token) {
        return NextResponse.json(
            { error: 'Authorization required. Please provide a valid Bearer token.' },
            { status: 401 }
        );
    }
    
    return null; // No error, auth is valid
}

export async function addAuthHeaderToRequest(req?: NextRequest, headers: Record<string, string> = {}): Promise<Record<string, string>> {
    const token = await getAuthToken(req);
    
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    return headers;
}

/**
 * Извлекает токен из HttpOnly cookie в API routes
 * @param req - Request объект
 * @returns токен или null если не найден
 */
export function getTokenFromCookies(req: Request): string | null {
    const cookieHeader = req.headers.get('Cookie') || '';
    
    const authCookie = cookieHeader
        .split(';')
        .find(cookie => cookie.trim().startsWith('auth_token='));
    
    return authCookie?.split('=')[1] || null;
}

/**
 * Создает ответ с ошибкой авторизации
 * @param message - сообщение об ошибке
 * @returns Response с 401 статусом
 */
export function createUnauthorizedResponse(message: string = 'Отсутствует сессия'): Response {
    return new Response(JSON.stringify({
        error: 'Не авторизован',
        message
    }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
    });
} 