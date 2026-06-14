'use client'

import { useState } from 'react'
import { useAuthenticatedFetch } from '@/hooks/auth/useAuthenticatedFetch'

export function useDeleteAppointmentByDoctor() {
  const authenticatedFetch = useAuthenticatedFetch()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const deleteAppointment = async (appointmentId: string): Promise<boolean> => {
    if (!appointmentId) return false

    setLoading(true)
    setError(null)

    try {
      const res = await authenticatedFetch(`/api/appointments/${encodeURIComponent(appointmentId)}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!res.ok) {
        let msg = `Ошибка удаления (${res.status})`

        try {
          const data = await res.json()
          msg = data?.message || data?.error || msg
        } catch {}

        setError(msg)
        return false
      }

      return true
    } catch (e: any) {
      setError(e?.message || 'Не удалось удалить приём')
      return false
    } finally {
      setLoading(false)
    }
  }

  return {
    deleteAppointment,
    loading,
    error,
  }
}