// import { getTokenFromCookies, createUnauthorizedResponse } from '@/utils/auth';

// export async function GET(req: Request) {
//     try {
//         const token = getTokenFromCookies(req);
//         if (!token) {
//             return createUnauthorizedResponse();
//         }

//         // Получаем параметры запроса
//         const url = new URL(req.url);
//         const specialistId = url.searchParams.get('specialist_id');

//         // Формируем URL для backend
//         let backendUrl = `${process.env.CALENDAR_SERVICE}/appointments/schedules`;
//         if (specialistId) {
//             backendUrl += `?specialist_id=${encodeURIComponent(specialistId)}`;
//         }

//         const backendRes = await fetch(backendUrl, {
//             method: 'GET',
//             headers: {
//                 'Authorization': `Bearer ${token}`,
//                 'Content-Type': 'application/json'
//             }
//         });

//         const data = await backendRes.json();

//         return new Response(JSON.stringify(data), {
//             status: backendRes.status,
//             headers: { 'Content-Type': 'application/json' }
//         });
//     } catch (e: any) {
//         return new Response(JSON.stringify({ error: e.message || 'Ошибка сервера' }), {
//             status: 500,
//             headers: { 'Content-Type': 'application/json' }
//         });
//     }
// }

// export async function POST(req: Request) {
//     try {
//         const token = getTokenFromCookies(req);
//         if (!token) {
//             return createUnauthorizedResponse();
//         }
//         const body = await req.text();
//         const backendRes = await fetch(`${process.env.CALENDAR_SERVICE}/appointments/schedules`, {
//             method: 'POST',
//             headers: {
//                 'Authorization': `Bearer ${token}`,
//                 'Content-Type': 'application/json'
//             },
//             body,
//         });
//         const data = await backendRes.json();
//         return new Response(JSON.stringify(data), {
//             status: backendRes.status,
//             headers: { 'Content-Type': 'application/json' }
//         });
//     } catch (e: any) {
//         return new Response(JSON.stringify({ error: e.message || 'Ошибка сервера' }), {
//             status: 500,
//             headers: { 'Content-Type': 'application/json' }
//         });
//     }
// } 
import { NextRequest } from 'next/server'
import { getTokenFromCookies, createUnauthorizedResponse } from '@/utils/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

const GATEWAY = (
  process.env.APPOINTMENTS_GATEWAY?.trim() ||
  process.env.GATEWAY?.trim() ||
  'http://185.125.46.62:8800'
).replace(/\/+$/, '')

async function resolveSpecialistIdByUserId(token: string, doctorUserId?: string | null) {
  const userId = String(doctorUserId || '').trim()
  if (!userId) return null

  const res = await fetch(`${GATEWAY}/users/${userId}/doctor`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || 'Не удалось определить doctor profile')
  }

  const data = await res.json()
  return data?.id ? String(data.id).trim() : null
}

async function tryResolveSpecialistIdByUserId(token: string, doctorUserId?: string | null) {
  try {
    return await resolveSpecialistIdByUserId(token, doctorUserId)
  } catch {
    return null
  }
}

function withJson(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function GET(req: NextRequest) {
  try {
    const token = getTokenFromCookies(req)
    if (!token) return createUnauthorizedResponse()

    const url = new URL(req.url)
    const doctorUserId = (url.searchParams.get('doctor_user_id') ?? '').trim()
    let specialistId = (url.searchParams.get('specialist_id') ?? '').trim()

    // Безопасная подмена только если specialist_id не передан
    // или ошибочно совпадает с doctor_user_id
    if (doctorUserId && (!specialistId || specialistId === doctorUserId)) {
      const resolved = await tryResolveSpecialistIdByUserId(token, doctorUserId)
      if (resolved) specialistId = resolved
    }

    const backend = new URL(`${GATEWAY}/appointments/schedules`)
    if (specialistId) backend.searchParams.set('specialist_id', specialistId)

    const backendRes = await fetch(backend.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
    })

    const text = await backendRes.text()
    let data: any = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = { success: false, error: 'Некорректный ответ от сервера', raw: text }
    }

    return withJson(data, backendRes.status)
  } catch (e: any) {
    return withJson({ success: false, error: e?.message || 'Ошибка сервера' }, 500)
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = getTokenFromCookies(req)
    if (!token) return createUnauthorizedResponse()

    const url = new URL(req.url)
    const doctorUserId = (url.searchParams.get('doctor_user_id') ?? '').trim()
    let specialistId = (url.searchParams.get('specialist_id') ?? '').trim()

    // Старых не ломаем: если specialist_id уже правильный, оставляем как есть.
    // Чиним только ошибочный кейс новых врачей.
    if (doctorUserId && (!specialistId || specialistId === doctorUserId)) {
      const resolved = await tryResolveSpecialistIdByUserId(token, doctorUserId)
      if (resolved) specialistId = resolved
    }

    const backend = new URL(`${GATEWAY}/appointments/schedules`)
    if (doctorUserId) backend.searchParams.set('doctor_user_id', doctorUserId)
    if (specialistId) backend.searchParams.set('specialist_id', specialistId)

    const body = await req.text()

    const backendRes = await fetch(backend.toString(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body,
      cache: 'no-store',
    })

    const text = await backendRes.text()
    let data: any = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = { success: false, error: 'Некорректный ответ от сервера', raw: text }
    }

    return withJson(data, backendRes.status)
  } catch (e: any) {
    return withJson({ success: false, error: e?.message || 'Ошибка сервера' }, 500)
  }
}