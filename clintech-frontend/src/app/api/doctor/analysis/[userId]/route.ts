// src/app/api/doctor/analysis/[userId]/route.ts
// import { getTokenFromCookies, createUnauthorizedResponse } from '@/utils/auth';

// export async function GET(req: Request, context: any) {
//   try {
//     const token = getTokenFromCookies(req);
//     if (!token) return createUnauthorizedResponse('Требуется авторизация');

//     const anketa = process.env.ANKETA_SERVICE;
//     if (!anketa) {
//       return new Response(JSON.stringify({ error: 'ANKETA_SERVICE не настроен' }), { status: 500, headers: { 'Content-Type': 'application/json' }});
//     }

//     const userId = context?.params?.userId as string | undefined;
//     if (!userId) {
//       return new Response(JSON.stringify({ error: 'userId is required' }), { status: 400, headers: { 'Content-Type': 'application/json' }});
//     }

//     const backendRes = await fetch(`${anketa}/doctor/analysis/${encodeURIComponent(userId)}`, {
//       method: 'GET',
//       headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
//     });

//     const text = await backendRes.text();
//     return new Response(text, { status: backendRes.status, headers: { 'Content-Type': 'application/json' }});
//   } catch (e: any) {
//     return new Response(JSON.stringify({ error: e?.message ?? 'Ошибка сервера' }), { status: 500, headers: { 'Content-Type': 'application/json' }});
//   }
// }
// src/app/api/doctor/analysis/[userId]/route.ts

// export async function PUT(req: Request, context: any) {
//   try {
//     const token = getTokenFromCookies(req);
//     if (!token) return createUnauthorizedResponse('Требуется авторизация');

//     const anketa = process.env.ANKETA_SERVICE;
//     if (!anketa) {
//       return new Response(JSON.stringify({ error: 'ANKETA_SERVICE не настроен' }), { status: 500, headers: { 'Content-Type': 'application/json' }});
//     }

//     const userId = context?.params?.userId as string | undefined;
//     console.log("doctor/analysis route url:", req.url);
//     console.log("doctor/analysis route params:", context?.params);
//     if (!userId) {
//       return new Response(JSON.stringify({ error: 'userId is required' }), { status: 400, headers: { 'Content-Type': 'application/json' }});
//     }

//     const body = await req.json().catch(() => null);
//     const answers = body?.answers;
//     if (!answers || typeof answers !== 'object') {
//       return new Response(JSON.stringify({ error: 'Body must be { answers: Record<string,string> }' }), { status: 400, headers: { 'Content-Type': 'application/json' }});
//     }

//     // Проксируем на Go: PUT /doctor/analysis/:user_id/answers  (UUID user_id)
//     const backendRes = await fetch(`${anketa}/doctor/analysis/${encodeURIComponent(userId)}/answers`, {
//       method: 'PUT',
//       headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
//       body: JSON.stringify({ answers }),
//     });

//     const text = await backendRes.text();
//     return new Response(text || '{}', { status: backendRes.status, headers: { 'Content-Type': 'application/json' }});
//   } catch (e: any) {
//     return new Response(JSON.stringify({ error: e?.message ?? 'Ошибка сервера' }), { status: 500, headers: { 'Content-Type': 'application/json' }});
//   }
// }
import { getTokenFromCookies, createUnauthorizedResponse } from '@/utils/auth';

type RouteContext = { params: Promise<{ userId: string }> };

async function resolveUserId(req: Request, context: RouteContext): Promise<string | null> {
  const params = await context.params;
  const fromParams = params?.userId;
  if (typeof fromParams === 'string' && fromParams.length > 0) {
    return fromParams;
  }

  const pathname = new URL(req.url).pathname;
  const m = pathname.match(/\/api\/doctor\/analysis\/([^/]+)\/?$/);
  if (m?.[1]) {
    return decodeURIComponent(m[1]);
  }

  return null;
}

export async function GET(req: Request, context: RouteContext) {
  try {
    const token = getTokenFromCookies(req);
    if (!token) return createUnauthorizedResponse('Требуется авторизация');

    const anketa = process.env.ANKETA_SERVICE;
    if (!anketa) {
      return new Response(JSON.stringify({ error: 'ANKETA_SERVICE не настроен' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const userId = await resolveUserId(req, context);
    if (!userId) {
      return new Response(JSON.stringify({ error: 'userId is required', url: req.url }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const backendRes = await fetch(`${anketa}/doctor/analysis/${encodeURIComponent(userId)}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    });

    const text = await backendRes.text();
    return new Response(text || '{}', { status: backendRes.status, headers: { 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? 'Ошибка сервера' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function PUT(req: Request, context: RouteContext) {
  try {
    const token = getTokenFromCookies(req);
    if (!token) return createUnauthorizedResponse('Требуется авторизация');

    const anketa = process.env.ANKETA_SERVICE;
    if (!anketa) {
      return new Response(JSON.stringify({ error: 'ANKETA_SERVICE не настроен' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const userId = await resolveUserId(req, context);
    if (!userId) {
      return new Response(JSON.stringify({ error: 'userId is required', url: req.url }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => null);
    const answers = body?.answers;
    if (!answers || typeof answers !== 'object') {
      return new Response(JSON.stringify({ error: 'Body must be { answers: Record<string, any> }' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const backendRes = await fetch(`${anketa}/doctor/analysis/${encodeURIComponent(userId)}/answers`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ answers }),
    });

    const text = await backendRes.text();
    return new Response(text || '{}', { status: backendRes.status, headers: { 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? 'Ошибка сервера' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
