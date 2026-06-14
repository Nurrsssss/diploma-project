'use client'
import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserIcon } from 'lucide-react'
import { useDoctors } from '@/hooks/doctor/useDoctors'
import { useAuthenticatedFetch } from '@/hooks/auth/useAuthenticatedFetch'
import { TDoctor } from '@/types/doctors'
import { formatAppointmentTime } from '@/utils/appointments'
import { generateDates } from '@/utils/date'
import MyButton from '@/components/ui/MyButton'

interface IChatDoctorRecommendationProps {
    recommendations: string
}

interface RecommendedSlot {
    id: string
    start_time: string
    displayDate: string
}

interface RawSlot {
    id: string
    start_time: string
    is_available?: boolean
    status?: string
}

const MAX_RECOMMENDED_DOCTORS = 3

// Заголовки раздела "Кому записаться" в рекомендациях ИИ (ru/en/kz)
const BOOKING_SECTION_HEADERS = ['КОМУ ЗАПИСАТЬСЯ', 'WHO TO BOOK', 'КІМГЕ ЖАЗЫЛУ КЕРЕК']

// Вырезаем из текста рекомендаций раздел про запись к специалистам
function extractBookingSection(text: string): string {
    for (const header of BOOKING_SECTION_HEADERS) {
        const regex = new RegExp(`\\*\\*${header}[^*]*\\*\\*([\\s\\S]*?)(?=\\n\\*\\*|$)`, 'i')
        const match = text.match(regex)
        if (match) return match[1]
    }
    return text
}

// Для каждого специалиста, упомянутого в разделе, ищем реального врача с такой специализацией
function findRecommendedDoctors(doctors: TDoctor[], section: string): TDoctor[] {
    const sectionLower = section.toLowerCase()
    const bySpecialty = new Map<string, { doctor: TDoctor; index: number }>()

    for (const doctor of doctors) {
        for (const role of doctor.roles || []) {
            const roleLower = role.trim().toLowerCase()
            if (roleLower.length < 3) continue
            const index = sectionLower.indexOf(roleLower)
            if (index === -1) continue

            const existing = bySpecialty.get(roleLower)
            if (!existing || index < existing.index) {
                bySpecialty.set(roleLower, { doctor, index })
            }
        }
    }

    return Array.from(bySpecialty.values())
        .sort((a, b) => a.index - b.index)
        .slice(0, MAX_RECOMMENDED_DOCTORS)
        .map((m) => m.doctor)
}

export default function ChatDoctorRecommendation({ recommendations }: IChatDoctorRecommendationProps) {
    const { doctors, loading: doctorsLoading } = useDoctors()

    const recommendedDoctors = useMemo(() => {
        if (doctorsLoading || doctors.length === 0) return []
        const section = extractBookingSection(recommendations)
        return findRecommendedDoctors(doctors, section)
    }, [doctors, doctorsLoading, recommendations])

    if (recommendedDoctors.length === 0) return null

    return (
        <div className="mt-4 space-y-3">
            <h3 className="font-bold text-gray-900">Рекомендуем записаться</h3>
            {recommendedDoctors.map((doctor) => (
                <DoctorRecommendationCard key={doctor.id} doctor={doctor} />
            ))}
        </div>
    )
}

function DoctorRecommendationCard({ doctor }: { doctor: TDoctor }) {
    const router = useRouter()
    const authenticatedFetch = useAuthenticatedFetch()

    const [slots, setSlots] = useState<RecommendedSlot[]>([])
    const [slotsLoading, setSlotsLoading] = useState(false)

    useEffect(() => {
        let cancelled = false
        const doctorId = doctor.id || doctor.user_id || ''
        const altDoctorId = doctor.user_id || doctor.id || ''

        const loadSlots = async () => {
            setSlotsLoading(true)
            const found: RecommendedSlot[] = []

            for (const { date, displayDate, dayOfWeek } of generateDates(2)) {
                if (found.length >= 3) break
                try {
                    const params = new URLSearchParams({ date })
                    if (altDoctorId && altDoctorId !== doctorId) {
                        params.append('alt_doctor_id', altDoctorId)
                    }
                    const res = await authenticatedFetch(`/api/doctors/${doctorId}/available-slots?${params.toString()}`)
                    if (!res.ok) continue
                    const data = await res.json()
                    if (!data.success || !Array.isArray(data.data)) continue

                    const now = new Date()
                    for (const slot of data.data as RawSlot[]) {
                        if (found.length >= 3) break
                        if (slot.is_available === false || slot.status === 'booked' || slot.status === 'cancelled') continue
                        if (new Date(slot.start_time).getTime() <= now.getTime()) continue
                        found.push({ id: slot.id, start_time: slot.start_time, displayDate: `${dayOfWeek}, ${displayDate}` })
                    }
                } catch {
                    // пропускаем день, пробуем следующий
                }
            }

            if (!cancelled) {
                setSlots(found)
                setSlotsLoading(false)
            }
        }

        loadSlots()
        return () => { cancelled = true }
    }, [doctor, authenticatedFetch])

    const fullName = [doctor.last_name, doctor.first_name, doctor.middle_name]
        .filter(Boolean)
        .join(' ')

    const handleBook = () => {
        // Тот же ключ, что читает AppointmentProvider при инициализации (sessionStorage.selectedDoctor)
        sessionStorage.setItem('selectedDoctor', JSON.stringify(doctor))
        router.push('/patient/my-appointments/make/format')
    }

    return (
        <div className="p-4 border border-primary/20 rounded-lg bg-primary/5">
            <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center shrink-0">
                    <UserIcon className="w-7 h-7 text-white" />
                </div>
                <div>
                    <p className="font-semibold text-gray-900">{fullName || 'Врач'}</p>
                    <p className="text-sm text-primary">{doctor.roles?.join(', ')}</p>
                </div>
            </div>

            {slotsLoading ? (
                <p className="text-sm text-gray-500 mb-3">Загрузка свободного времени...</p>
            ) : slots.length > 0 ? (
                <div className="mb-3">
                    <p className="text-sm text-gray-600 mb-2">Ближайшее свободное время:</p>
                    <div className="flex flex-wrap gap-2">
                        {slots.map((slot) => (
                            <span key={slot.id} className="px-3 py-1.5 border rounded-lg text-sm bg-white">
                                {slot.displayDate}, {formatAppointmentTime(slot.start_time)}
                            </span>
                        ))}
                    </div>
                </div>
            ) : (
                <p className="text-sm text-gray-500 mb-3">Свободное время можно выбрать на странице записи</p>
            )}

            <MyButton
                onClick={handleBook}
                className="bg-primary text-white hover:bg-primary/90 text-md px-4 py-2"
            >
                Записаться к {doctor.roles?.[0] ? doctor.roles[0].toLowerCase() : 'специалисту'}
            </MyButton>
        </div>
    )
}
