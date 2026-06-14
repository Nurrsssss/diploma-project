'use client'

import React, { useEffect, useState } from 'react'
import { FaUser, FaPhone } from 'react-icons/fa'

type PatientDto = {
  id?: string
  user_id?: string
  first_name?: string
  middle_name?: string
  last_name?: string
  phone?: string
  email?: string
}

function buildFullName(p?: { first_name?: string; middle_name?: string; last_name?: string }) {
  const parts = [p?.last_name, p?.first_name, p?.middle_name].filter(Boolean)
  return parts.join(' ')
}

export default function DrAppointmentPatient({ patientId }: { patientId: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')

  useEffect(() => {
    if (!patientId) return

    let cancelled = false

    const run = async () => {
      setLoading(true)
      setError(null)

      try {
        const r = await fetch(`/api/patients/${patientId}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
        })

        if (!r.ok) {
          const text = await r.text()
          throw new Error(text || `Не удалось получить пациента по id=${patientId}`)
        }

        const p = (await r.json()) as PatientDto

        if (!cancelled) {
          setFullName(buildFullName(p) || `Пациент (${patientId.slice(0, 6)}...)`)
          setPhone(p?.phone ?? '')
          setLoading(false)
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || 'Ошибка загрузки пациента')
          setLoading(false)
        }
      }
    }

    run()

    return () => {
      cancelled = true
    }
  }, [patientId])

  if (loading) {
    return (
      <div className="bg-gray-100 rounded-lg p-3 mb-3 text-sm text-gray-600">
        Загрузка пациента...
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3 text-sm text-red-700">
        {error}
      </div>
    )
  }

  return (
    <div className="bg-gray-100 rounded-lg p-3 mb-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-base sm:text-lg">
        <div className="flex items-center gap-2">
          <FaUser className="text-gray-500" />
          <span className="font-medium text-xs sm:text-base">{fullName || 'Пациент'}</span>
        </div>

        {phone && (
          <div className="flex items-center gap-2">
            <FaPhone className="text-gray-500" />
            <span>{phone}</span>
          </div>
        )}
      </div>
    </div>
  )
}