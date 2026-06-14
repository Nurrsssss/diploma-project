// // src/app/api/doctor/analysis/[userId]/answers/route.ts
// import { getTokenFromCookies, createUnauthorizedResponse } from '@/utils/auth';

// export async function PUT(
//   req: Request,
//   { params }: { params: Promise<{ userId: string }> } // ✅ params как Promise
// ) {
//   try {
//     const token = getTokenFromCookies(req);
//     if (!token) return createUnauthorizedResponse('Требуется авторизация');

//     const anketa = process.env.ANKETA_SERVICE;
//     if (!anketa) {
//       return new Response(JSON.stringify({ error: 'ANKETA_SERVICE не настроен' }), {
//         status: 500,
//         headers: { 'Content-Type': 'application/json' },
//       });
//     }

//     const { userId } = await params; // ✅ await
//     const body = await req.json().catch(() => null);
//     const answers = body?.answers;
//     if (!answers || typeof answers !== 'object') {
//       return new Response(
//         JSON.stringify({ error: 'Body must be { answers: Record<string, any> }' }),
//         { status: 400, headers: { 'Content-Type': 'application/json' } }
//       );
//     }

//     const backendRes = await fetch(
//       `${anketa}/doctor/analysis/${encodeURIComponent(userId)}/answers`,
//       {
//         method: 'PUT',
//         headers: {
//           'Content-Type': 'application/json',
//           Authorization: `Bearer ${token}`,
//         },
//         body: JSON.stringify({ answers }),
//       }
//     );

//     const text = await backendRes.text();
//     return new Response(text || '{}', {
//       status: backendRes.status,
//       headers: { 'Content-Type': 'application/json' },
//     });
//   } catch (e: any) {
//     return new Response(JSON.stringify({ error: e?.message ?? 'Ошибка сервера' }), {
//       status: 500,
//       headers: { 'Content-Type': 'application/json' },
//     });
//   }
// }
import { getTokenFromCookies, createUnauthorizedResponse } from '@/utils/auth';

function extractUserId(req: Request, context: any): string | null {
  // 1) обычный путь
  const fromParams = context?.params?.userId;
  if (typeof fromParams === 'string' && fromParams.length > 0) return fromParams;

  // 2) fallback: достаем из URL (если params пустые)
  const pathname = new URL(req.url).pathname;
  // ожидаем: /api/doctor/analysis/<uuid>/answers
  const m = pathname.match(/\/api\/doctor\/analysis\/([^\/]+)\/answers\/?$/);
  if (m?.[1]) return decodeURIComponent(m[1]);

  return null;
}

export async function PUT(req: Request, context: any) {
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

    const userId = extractUserId(req, context);
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'userId is required', params: context?.params ?? null, url: req.url }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
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
    return new Response(text || '{}', {
      status: backendRes.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? 'Ошибка сервера' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

