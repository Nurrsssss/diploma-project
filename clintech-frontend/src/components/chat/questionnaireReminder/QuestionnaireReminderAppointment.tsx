'use client'
import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import QuestionnaireReminderContent from './QuestionnaireReminderContent'

interface QuestionnaireReminderAppointmentProps {
    isOpen?: boolean
    onClose?: () => void
    onCompleted?: () => void
}

export default function QuestionnaireReminderAppointment({
    isOpen: externalIsOpen,
    onClose,
    onCompleted
}: QuestionnaireReminderAppointmentProps = {}) {
    const [internalIsOpen, setInternalIsOpen] = useState(true)

    // Используем внешний isOpen если передан, иначе внутренний
    const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen

    const handleClose = () => {
        if (onClose) {
            onClose()
        } else {
            setInternalIsOpen(false)
        }
    }

    const handleCompleted = () => {
        if (onCompleted) {
            onCompleted()
        } else {
            setInternalIsOpen(false)
        }
    }

    return (
        <>
            {isOpen && typeof window !== 'undefined' && createPortal(
                <QuestionnaireReminderContent handleClose={handleClose} />,
                document.body
            )}
        </>
    )
}
