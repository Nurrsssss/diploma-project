export async function POST(req: Request) {
    try {
        const body = await req.json();

        // Здесь будет вызов бэкенда для верификации OTP
        const backendResponse = await fetch(`http://185.125.46.62:8806/api/auth/verify-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        const data = await backendResponse.json();

        return new Response(JSON.stringify(data), {
            status: backendResponse.status,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message || 'Ошибка сервера' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
} 