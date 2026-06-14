/*
    Получение информации о враче по его userId
    Возвращает информацию о враче.
*/

import { NextRequest } from 'next/server'
import { createUnauthorizedResponse, getTokenFromCookies } from '@/utils/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

const GATEWAY = (
  process.env.APPOINTMENTS_GATEWAY?.trim() ||
  process.env.GATEWAY?.trim() ||
  process.env.SPECIALIST_SERVICE?.trim() ||
  'http://185.125.46.62:8800'
).replace(/\/+$/, '')

function withJson(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function GET(request: NextRequest, context: { params: Promise<{ userId: string }> }) {
  try {
    const { userId } = await context.params

    const token = getTokenFromCookies(request)
    if (!token) return createUnauthorizedResponse('Требуется авторизация')

    const backendRes = await fetch(`${GATEWAY}/users/${encodeURIComponent(userId)}/doctor`, {
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
  } catch {
    return withJson({ success: false, error: 'Ошибка сервера при получении данных врача' }, 500)
  }

}

/*
    Обновление информации о враче по его userId
    Возвращает обновленную информацию о враче.
*/

export async function PUT(request: NextRequest, context: { params: Promise<{ userId: string }> }) {
  try {
    const { userId } = await context.params

    const token = getTokenFromCookies(request)
    if (!token) return createUnauthorizedResponse('Требуется авторизация')

    const body = await request.text()

    const backendRes = await fetch(`${GATEWAY}/users/${encodeURIComponent(userId)}/doctor`, {
      method: 'PUT',
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
  } catch {
    return withJson({ success: false, error: 'Ошибка сервера при обновлении данных врача' }, 500)
  }
}
