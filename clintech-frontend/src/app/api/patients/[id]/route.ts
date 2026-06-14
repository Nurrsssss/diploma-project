/*
  Получение пациента по patients.id
  Используется врачом для просмотра данных пациента.
*/

import { NextRequest, NextResponse } from 'next/server'
import { getTokenFromCookies, createUnauthorizedResponse } from '@/utils/auth'

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params

    const token = getTokenFromCookies(request)
    if (!token) {
      return createUnauthorizedResponse('Требуется авторизация')
    }

    const base = process.env.PATIENT_SERVICE
    if (!base) {
      return NextResponse.json({ error: 'PATIENT_SERVICE is not set' }, { status: 500 })
    }

    // ⚠️ ВАЖНО: выбери правильный вариант:
    // 1) если на patient_service endpoint = /patients/:id
    const url = `${base}/patients/${id}`

    // 2) если endpoint = /api/patients/:id — используй это вместо строки выше:
    // const url = `${base}/api/patients/${id}`

    const backendRes = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      cache: 'no-store'
    })

    const text = await backendRes.text()
    // пробуем распарсить JSON, но не падаем
    let data: any
    try {
      data = JSON.parse(text)
    } catch {
      data = { error: 'Некорректный ответ от сервера', raw: text }
    }

    return NextResponse.json(data, { status: backendRes.status })
  } catch (error) {
    console.error('Ошибка при получении пациента:', error)
    return NextResponse.json({ error: 'Ошибка сервера при получении данных пациента' }, { status: 500 })
  }
}