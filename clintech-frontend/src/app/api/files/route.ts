import { getTokenFromCookies, createUnauthorizedResponse } from '@/utils/auth';

export async function GET(req: Request) {
    try {
        const token = getTokenFromCookies(req);
        
        if (!token) {
            return createUnauthorizedResponse();
        }

        const backendRes = await fetch(`${process.env.FILE_SERVICE}/files`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
        });

        const responseText = await backendRes.text();
        let data;
        try {
            data = JSON.parse(responseText);
        } catch (e) {
            data = { error: 'Некорректный ответ от файлового сервиса' };
        }

        return new Response(JSON.stringify(data), {
            status: backendRes.status,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message || 'Ошибка сервера' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}


// app/api/upload/route.ts

export async function POST(req: Request) {
    try {
        const token = getTokenFromCookies(req);
        
        if (!token) {
            return createUnauthorizedResponse();
        }

        const contentType = req.headers.get("content-type") || "";
        if (!contentType.includes("multipart/form-data")) {
            return new Response(JSON.stringify({ error: "Неверный Content-Type" }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
            });
        }

        const formData = await req.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return new Response(JSON.stringify({ error: "Файл не найден" }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
            });
        }

        // Проксируем файл на FILE_SERVICE
        const proxyForm = new FormData();
        proxyForm.append("file", file, file.name);

        const backendRes = await fetch(`${process.env.FILE_SERVICE}/files`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                // Не указывай Content-Type! fetch сам выставит boundary для FormData
            },
            body: proxyForm,
        });

        const data = await backendRes.json();
        return new Response(JSON.stringify(data), {
            status: backendRes.status,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message || "Ошибка сервера" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
}