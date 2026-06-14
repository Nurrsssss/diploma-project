import { useState, useEffect, useCallback, useMemo } from 'react'
import { TPatient } from '@/types/patient'
import { useAuth } from '@/context/AuthContext'
import { useAuthenticatedFetch } from '@/hooks/auth/useAuthenticatedFetch'

type UsePatientByUserIdResult = {
  patient: TPatient | null
  loading: boolean
  error: string | null
  updating: boolean
  refetch: () => Promise<void>
  updatePatient: (data: Partial<TPatient>) => Promise<boolean>
}

export const usePatientByUserId = (userId: string | null): UsePatientByUserIdResult => {
  const [patient, setPatient] = useState<TPatient | null>(null)
  const [loading, setLoading] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { session } = useAuth()
  const authenticatedFetch = useAuthenticatedFetch()

  const sessionData = useMemo(
    () => ({
      isLoggedIn: session?.isLoggedIn,
      role: session?.role,
      userId: session?.user_id
    }),
    [session?.isLoggedIn, session?.role, session?.user_id]
  )

  const fetchPatient = useCallback(async () => {
    if (!userId) {
      setPatient(null)
      setError('Не указан ID пользователя')
      return
    }
    if (!sessionData.isLoggedIn) {
      setPatient(null)
      setError('Пользователь не авторизован')
      return
    }
    if (sessionData.role !== 'patient' && sessionData.role !== 'doctor') {
      setPatient(null)
      setError(`Доступ запрещен. Требуется роль patient или doctor, а у вас: ${sessionData.role}`)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const res = await authenticatedFetch(`/api/users/${userId}/patient`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store'
      })

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        const msg = data?.error || data?.message || `Ошибка получения данных пациента: ${res.status}`
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
  }, [userId, sessionData.isLoggedIn, sessionData.role, authenticatedFetch])

  const updatePatient = useCallback(
    async (patch: Partial<TPatient>): Promise<boolean> => {
      if (!userId) {
        setError('Нет userId')
        return false
      }
      if (!sessionData.isLoggedIn) {
        setError('Пользователь не авторизован')
        return false
      }

      try {
        setUpdating(true)
        setError(null)

        const res = await authenticatedFetch(`/api/users/${userId}/patient`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch)
        })

        const data = await res.json().catch(() => null)

        if (!res.ok) {
          const msg = data?.error || data?.message || `Ошибка обновления пациента: ${res.status}`
          setError(msg)
          return false
        }

        const payload = data?.data ?? data
        setPatient(payload ?? patient)
        return true
      } catch (e: any) {
        setError(e?.message || 'Ошибка сети при обновлении пациента')
        return false
      } finally {
        setUpdating(false)
      }
    },
    [userId, sessionData.isLoggedIn, authenticatedFetch, patient]
  )

  useEffect(() => {
    if (userId && sessionData.isLoggedIn && sessionData.role) {
      fetchPatient()
    }
  }, [userId, sessionData.isLoggedIn, sessionData.role, fetchPatient])

  return {
    patient,
    loading,
    error,
    updating,
    refetch: fetchPatient,
    updatePatient
  }
}