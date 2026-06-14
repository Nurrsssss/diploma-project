import { useState, useEffect, useMemo } from 'react'
import { TPatient } from '@/types/patient'
import { TAppointment } from '@/types/appointments'

interface UsePatientCacheResult {
    patientsCache: Record<string, TPatient>
    loadingPatients: boolean
}

export const usePatientCache = (appointments: TAppointment[]): UsePatientCacheResult => {
    const [patientsCache, setPatientsCache] = useState<Record<string, TPatient>>({})
    const [loadingPatients, setLoadingPatients] = useState(false)

    // Получаем уникальные ID пациентов из appointments
    const patientIds = useMemo(() => {
        const ids = new Set<string>()
        appointments.forEach(appointment => {
            if (appointment.patient_id && appointment.status !== 'available') {
                ids.add(appointment.patient_id)
            }
        })
        return Array.from(ids)
    }, [appointments])

    useEffect(() => {
        const loadPatients = async () => {
            if (patientIds.length === 0) return

            setLoadingPatients(true)
            const newCache: Record<string, TPatient> = { ...patientsCache }

            // Загружаем только тех пациентов, которых еще нет в кэше
            const missingIds = patientIds.filter(id => !newCache[id])
            
            if (missingIds.length > 0) {
                // ✅ Загружаем пациентов параллельно (но ограничиваем количество одновременных запросов)
                const batchSize = 5
                for (let i = 0; i < missingIds.length; i += batchSize) {
                    const batch = missingIds.slice(i, i + batchSize)
                    const promises = batch.map(async (patientId) => {
                        try {
                            const response = await fetch(`/api/users/${patientId}/patient`, {
                                method: 'GET',
                                credentials: 'include'
                            })
                            if (response.ok) {
                                const data = await response.json()
                                return { id: patientId, patient: data.success ? data.data : data }
                            }
                        } catch (error) {
                            console.error(`Ошибка загрузки пациента ${patientId}:`, error)
                        }
                        return null
                    })

                    const results = await Promise.allSettled(promises)
                    results.forEach((result) => {
                        if (result.status === 'fulfilled' && result.value) {
                            newCache[result.value.id] = result.value.patient
                        }
                    })
                }
            }

            setPatientsCache(newCache)
            setLoadingPatients(false)
        }

        loadPatients()
    }, [patientIds])

    return { patientsCache, loadingPatients }
}
