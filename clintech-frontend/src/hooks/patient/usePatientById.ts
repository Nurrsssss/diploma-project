import { useEffect, useState, useCallback } from 'react'
import { TPatient } from '@/types/patient'

export function usePatientById(patientId: string | null, enabled: boolean = true) {
  const [patient, setPatient] = useState<TPatient | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchPatient = useCallback(async () => {
    if (!enabled || !patientId) {
      setPatient(null)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/patients/${patientId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      })

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        const msg =
          data?.error ||
          data?.message ||
          `Ошибка получения данных пациента: ${res.status}`

        setPatient(null)
        setError(msg)
        return
      }

      const payload = data?.data ?? data
      setPatient(payload ?? null)
    } catch (e: any) {
      setPatient(null)
      setError(e?.message || 'Ошибка сети при получении пациента')
    } finally {
      setLoading(false)
    }
  }, [enabled, patientId])

  useEffect(() => {
    fetchPatient()
  }, [fetchPatient])

  return {
    patient,
    loading,
    error,
    refetch: fetchPatient,
  }
}