/*
Выход из системы.
Удаляет HttpOnly cookie с токеном авторизации.
*/

export async function POST(req: Request) {
    try {
        // ✅ Создаем ответ об успешном logout
        const response = new Response(JSON.stringify({
            success: true,
            message: 'Успешный выход из системы'
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

        // ✅ Удаляем HttpOnly cookie, устанавливая срок жизни в 0
        const isProduction = process.env.NODE_ENV === 'production';
        const cookieOptions = [
            'auth_token=',
            'HttpOnly',
            'Path=/',
            'Max-Age=0',
            isProduction ? 'Secure' : '', // Secure только в продакшене
            isProduction ? 'SameSite=Strict' : 'SameSite=Lax' // Более мягкий SameSite в dev
        ].filter(Boolean).join('; ');
        
        response.headers.set('Set-Cookie', cookieOptions);

        return response;
    } catch (e: any) {
        return new Response(JSON.stringify({
            error: e.message || 'Ошибка при выходе из системы'
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
} 