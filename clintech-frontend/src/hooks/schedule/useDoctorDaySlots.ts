import { useState, useCallback } from 'react'
import { useAuthenticatedFetch } from '@/hooks/auth/useAuthenticatedFetch'

export interface DoctorDaySlot {
  id: string
  start_time: string
  end_time: string
  status: string
  title?: string
  duration_minutes?: number
  appointment_type?: 'online' | 'offline' | 'both'
  patient_name?: string
  patient_phone?: string
  patient_id?: string
  patient_record_id?: string
}

interface UseDoctorDaySlotsResult {
  slots: DoctorDaySlot[]
  loading: boolean
  error: string | null
  fetchDaySlots: (doctorId: string, date: string, status?: string) => Promise<void>
}

export const useDoctorDaySlots = (): UseDoctorDaySlotsResult => {
  const [slots, setSlots] = useState<DoctorDaySlot[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const authenticatedFetch = useAuthenticatedFetch()

  const fetchDaySlots = useCallback(
    async (doctorId: string, date: string, status?: string) => {
      try {
        setLoading(true)
        setError(null)

        if (!doctorId) {
          throw new Error('Не указан doctorId')
        }

        const params = new URLSearchParams()
        if (date) params.set('date', date)
        if (status && status !== 'all') params.set('status', status)

        params.set('include_all', '1')
        params.set('include_booked', '1')
        params.set('include_cancelled', '1')

        const res = await authenticatedFetch(
          `/api/appointments/doctors/${doctorId}/available-slots?${params.toString()}`,
          { method: 'GET' }
        )

        if (!res.ok) {
          const err = await res.json().catch(() => null)
          throw new Error(err?.message || err?.error || `Ошибка загрузки слотов: ${res.status}`)
        }

        const data = await res.json()
        console.log('doctor day slots response:', data)

        const payload = data?.data ?? data ?? {}
        const rawSlots = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.slots)
            ? payload.slots
            : Array.isArray(payload?.Slots)
              ? payload.Slots
              : []

        const normalized: DoctorDaySlot[] = rawSlots.map((slot: any) => ({
          id: String(slot?.id ?? ''),
          start_time: String(slot?.start_time ?? slot?.startTime ?? ''),
          end_time: String(slot?.end_time ?? slot?.endTime ?? ''),
          status: String(slot?.status ?? ''),
          title: slot?.title ?? undefined,
          duration_minutes:
            typeof slot?.duration_minutes === 'number'
              ? slot.duration_minutes
              : slot?.duration_minutes != null
                ? Number(slot.duration_minutes)
                : slot?.duration ?? null
                  ? Number(slot.duration)
                  : undefined,
          appointment_type: slot?.appointment_type ?? slot?.appointmentType ?? undefined,
          patient_name:
            slot?.patient_name ??
            slot?.patient?.full_name ??
            slot?.patient?.name ??
            undefined,
          patient_phone:
            slot?.patient_phone ??
            slot?.patient?.phone ??
            undefined,
          patient_id:
            slot?.patient_id ??
            slot?.patient?.id ??
            undefined,
          patient_record_id:
            slot?.patient_record_id ??
            slot?.patient?.id ??
            slot?.patient_record?.id ??
            undefined,
        }))

        setSlots(normalized)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Неизвестная ошибка')
        setSlots([])
      } finally {
        setLoading(false)
      }
    },
    [authenticatedFetch]
  )

  return { slots, loading, error, fetchDaySlots }
}