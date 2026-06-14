'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuthenticatedFetch } from '@/hooks/auth/useAuthenticatedFetch'

type TranscriptionData = {
  appointment_id: string
  text: string
  lang?: string
  source?: string
  transcribed_at?: string
  transcribed_by?: string
}

export function useAppointmentTranscription(appointmentId?: string | null) {
  const authenticatedFetch = useAuthenticatedFetch()
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const lastSavedTextRef = useRef('')
  const debounceTimerRef = useRef<any>(null)

  const fetchTranscription = useCallback(async () => {
    if (!appointmentId) return
    setLoading(true)
    setError(null)
    try {
      const res = await authenticatedFetch(`/api/appointments/${appointmentId}/transcription`)
      if (!res.ok) throw new Error('Ошибка загрузки транскрипции')
      const data = await res.json()
      const serverText = data?.data?.text || ''
      setText(serverText)
      lastSavedTextRef.current = serverText
    } catch (e: any) {
      setError(e.message || 'Ошибка загрузки транскрипции')
    } finally {
      setLoading(false)
    }
  }, [appointmentId, authenticatedFetch])

  const saveTranscription = useCallback(async (source: 'manual' | 'ai' = 'manual') => {
    if (!appointmentId) return false
    if (text.trim() === lastSavedTextRef.current.trim()) return true
    setSaving(true)
    setError(null)
    try {
      const res = await authenticatedFetch(`/api/appointments/${appointmentId}/transcription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, lang: 'ru', source })
      })
      if (!res.ok) throw new Error('Ошибка сохранения транскрипции')
      lastSavedTextRef.current = text
      return true
    } catch (e: any) {
      setError(e.message || 'Ошибка сохранения транскрипции')
      return false
    } finally {
      setSaving(false)
    }
  }, [appointmentId, authenticatedFetch, text])

  const clearTranscription = useCallback(async () => {
    if (!appointmentId) return false
    setSaving(true)
    setError(null)
    try {
      const res = await authenticatedFetch(`/api/appointments/${appointmentId}/transcription`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Ошибка очистки транскрипции')
      setText('')
      lastSavedTextRef.current = ''
      return true
    } catch (e: any) {
      setError(e.message || 'Ошибка очистки транскрипции')
      return false
    } finally {
      setSaving(false)
    }
  }, [appointmentId, authenticatedFetch])

  // Дебаунс-автосохранение
  useEffect(() => {
    if (!appointmentId) return
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    if (text.trim().length === 0) return
    debounceTimerRef.current = setTimeout(() => {
      // fire and forget; errors will be captured in hook state if any
      void saveTranscription('manual')
    }, 1500)
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    }
  }, [text, appointmentId, saveTranscription])

  // Сохранение при закрытии/перезагрузке (best-effort через sendBeacon)
  useEffect(() => {
    if (!appointmentId) return
    const handler = () => {
      const current = text.trim()
      if (current.length === 0) return
      if (current === lastSavedTextRef.current.trim()) return
      try {
        const payload = JSON.stringify({ text: current, lang: 'ru', source: 'manual' })
        const blob = new Blob([payload], { type: 'application/json' })
        const url = `${location.origin}/api/appointments/${appointmentId}/transcription`
        navigator.sendBeacon(url, blob)
      } catch {
        // ignore
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [appointmentId, text])

  return {
    text,
    setText,
    loading,
    saving,
    error,
    fetchTranscription,
    saveTranscription,
    clearTranscription,
  }
}


