import { getTokenFromCookies, createUnauthorizedResponse } from '@/utils/auth'

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params

    const token = getTokenFromCookies(req)
    if (!token) return createUnauthorizedResponse()

    const url = new URL(req.url)

    // Проксируем ВСЕ query-параметры как есть
    const queryParams = new URLSearchParams()
    url.searchParams.forEach((value, key) => {
      if (value !== '') queryParams.append(key, value)
    })

    // Подстраховка: чтобы график всегда видел booked/cancelled
    if (!queryParams.has('include_all')) queryParams.set('include_all', '1')
    if (!queryParams.has('include_booked')) queryParams.set('include_booked', '1')
    if (!queryParams.has('include_cancelled')) queryParams.set('include_cancelled', '1')

    let backendUrl = `${process.env.CALENDAR_SERVICE}/appointments/schedules/${id}/generated-slots`
    const qs = queryParams.toString()
    if (qs) backendUrl += `?${qs}`

    const backendRes = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    })

    const text = await backendRes.text()
    let data: any = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = { error: 'Некорректный JSON от backend', raw: text }
    }

    return new Response(JSON.stringify(data), {
      status: backendRes.status,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'Ошибка сервера' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}