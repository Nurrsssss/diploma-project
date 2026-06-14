/*
Удаление конкретного закрытия расписания по ID
DELETE /appointments/exceptions/{id}
*/
import type { NextRequest } from 'next/server'

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        
        // Получаем токен из cookies
        const authToken = req.headers.get('cookie')?.match(/auth_token=([^;]+)/)?.[1];
        
        if (!authToken) {
            return new Response(JSON.stringify({ 
                success: false, 
                error: 'Токен авторизации не найден' 
            }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const gateway = process.env.GATEWAY || 'http://185.125.46.62:8800';
        const backendRes = await fetch(`${gateway}/appointments/exceptions/${id}`, {
            method: 'DELETE',
            headers: { 
                'Authorization': `Bearer ${authToken}`
            }
        });

        let data;
        try {
            data = await backendRes.json();
        } catch {
            data = { success: true }; // DELETE может возвращать пустой ответ
        }

        return new Response(JSON.stringify(data), {
            status: backendRes.status,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (e: any) {
        return new Response(JSON.stringify({ 
            success: false,
            error: e.message || 'Ошибка сервера' 
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
