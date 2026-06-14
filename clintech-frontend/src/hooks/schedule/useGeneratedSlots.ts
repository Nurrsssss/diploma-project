import { useState, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useAuthenticatedFetch } from '@/hooks/auth/useAuthenticatedFetch'

export interface GeneratedSlot {
  id: string
  start_time: string
  end_time: string
  is_available: boolean
  status: string
  title?: string
  duration_minutes?: number
  date?: string
  appointment_type?: string
  price?: number
  patient_name?: string
  patient_phone?: string

  // users.id — может приходить от старого бэка
  patient_id?: string

  // patients.id — это поле нужно использовать для /api/patients/:id
  patient_record_id?: string
}

interface UseGeneratedSlotsResult {
  slots: GeneratedSlot[]
  loading: boolean
  error: string | null
  fetchGeneratedSlots: (scheduleId: string, date?: string, status?: string) => Promise<void>
}

export const useGeneratedSlots = (): UseGeneratedSlotsResult => {
  const [slots, setSlots] = useState<GeneratedSlot[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { isLoggedIn } = useAuth()
  const authenticatedFetch = useAuthenticatedFetch()

  const fetchGeneratedSlots = useCallback(
    async (scheduleId: string, date?: string, _status?: string) => {
      if (!isLoggedIn) {
        setSlots([])
        setLoading(false)
        setError(null)
        return
      }

      try {
        setLoading(true)
        setError(null)

        let url = `/api/appointments/schedules/${scheduleId}/generated-slots`
        const queryParams = new URLSearchParams()

        if (date) {
          const formattedDate = date.includes('T') ? date.split('T')[0] : date
          queryParams.append('start_date', formattedDate)
          queryParams.append('end_date', formattedDate)
        }

        queryParams.append('include_all', '1')
        queryParams.append('include_booked', '1')
        queryParams.append('include_cancelled', '1')

        if (queryParams.toString()) {
          url += `?${queryParams.toString()}`
        }

        const response = await authenticatedFetch(url, { method: 'GET' })

        if (!response.ok) {
          let errorData: any = null

          try {
            errorData = await response.json()
          } catch {
            errorData = { message: 'Некорректный ответ от сервера' }
          }

          console.error('API Error fetching slots:', {
            status: response.status,
            statusText: response.statusText,
            errorData,
            url,
          })

          throw new Error(
            `Ошибка получения слотов (${response.status}): ${errorData.message || response.statusText}`
          )
        }

        const data = await response.json()

        if (!data?.success) {
          console.error('Invalid slots response:', data)
          throw new Error(data?.message || 'Не удалось получить сгенерированные слоты')
        }

        const rawSlots = data.data?.slots || data.slots || []

        if (!Array.isArray(rawSlots)) {
          console.error('Slots is not an array:', { rawSlots, data })
          setSlots([])
          return
        }

        const normalizedSlots: GeneratedSlot[] = rawSlots.map((slot: any) => ({
          id: String(slot?.id ?? ''),
          start_time: String(slot?.start_time ?? ''),
          end_time: String(slot?.end_time ?? ''),
          is_available: Boolean(slot?.is_available),
          status: String(slot?.status ?? ''),
          title: slot?.title ?? undefined,
          duration_minutes:
            typeof slot?.duration_minutes === 'number'
              ? slot.duration_minutes
              : slot?.duration_minutes != null
              ? Number(slot.duration_minutes)
              : undefined,
          date: slot?.date ?? undefined,
          appointment_type: slot?.appointment_type ?? undefined,
          price:
            typeof slot?.price === 'number'
              ? slot.price
              : slot?.price != null
              ? Number(slot.price)
              : undefined,
          patient_name: slot?.patient_name ?? undefined,
          patient_phone: slot?.patient_phone ?? undefined,

          // старое/текущее поле — часто users.id
          patient_id: slot?.patient_id ?? undefined,

          // правильное поле для /api/patients/:id
          patient_record_id:
            slot?.patient_record_id ??
            slot?.patient?.id ??
            slot?.patient_record?.id ??
            undefined,
        }))

        setSlots(normalizedSlots)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Неизвестная ошибка')
        setSlots([])
      } finally {
        setLoading(false)
      }
    },
    [isLoggedIn, authenticatedFetch]
  )

  return { slots, loading, error, fetchGeneratedSlots }
}