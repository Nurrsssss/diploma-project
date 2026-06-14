package models

import (
	"time"

	"github.com/google/uuid"
)

// AppointmentBookedEvent событие бронирования записи к врачу
type AppointmentBookedEvent struct {
	Type            string    `json:"type"`
	AppointmentID   uuid.UUID `json:"appointment_id"`
	PatientID       uuid.UUID `json:"patient_id"`
	DoctorID        uuid.UUID `json:"doctor_id"`
	PatientPhone    string    `json:"patient_phone"`
	DoctorPhone     string    `json:"doctor_phone"`
	PatientName     string    `json:"patient_name"`
	DoctorName      string    `json:"doctor_name"`
	StartTime       time.Time `json:"start_time"`
	EndTime         time.Time `json:"end_time"`
	AppointmentType string    `json:"appointment_type"`
	PatientNotes    string    `json:"patient_notes"`
}

// AppointmentCanceledEvent событие отмены записи к врачу
type AppointmentCanceledEvent struct {
	Type            string    `json:"type"`
	AppointmentID   uuid.UUID `json:"appointment_id"`
	PatientID       uuid.UUID `json:"patient_id"`
	DoctorID        uuid.UUID `json:"doctor_id"`
	PatientPhone    string    `json:"patient_phone"`
	DoctorPhone     string    `json:"doctor_phone"`
	PatientName     string    `json:"patient_name"`
	DoctorName      string    `json:"doctor_name"`
	StartTime       time.Time `json:"start_time"`
	EndTime         time.Time `json:"end_time"`
	AppointmentType string    `json:"appointment_type"`
	CancelReason    string    `json:"cancel_reason,omitempty"`
}

// AppointmentRescheduledEvent событие переноса записи
type AppointmentRescheduledEvent struct {
	Type            string    `json:"type"`
	AppointmentID   uuid.UUID `json:"appointment_id"`
	PatientID       uuid.UUID `json:"patient_id"`
	DoctorID        uuid.UUID `json:"doctor_id"`
	PatientPhone    string    `json:"patient_phone"`
	DoctorPhone     string    `json:"doctor_phone"`
	PatientName     string    `json:"patient_name"`
	DoctorName      string    `json:"doctor_name"`
	OldStartTime    time.Time `json:"old_start_time"`
	OldEndTime      time.Time `json:"old_end_time"`
	NewStartTime    time.Time `json:"new_start_time"`
	NewEndTime      time.Time `json:"new_end_time"`
	AppointmentType string    `json:"appointment_type"`
	Reason          string    `json:"reason,omitempty"`
}

// AppointmentCompletedEvent событие завершения записи
type AppointmentCompletedEvent struct {
	Type            string    `json:"type"`
	AppointmentID   uuid.UUID `json:"appointment_id"`
	PatientID       uuid.UUID `json:"patient_id"`
	DoctorID        uuid.UUID `json:"doctor_id"`
	PatientPhone    string    `json:"patient_phone"`
	DoctorPhone     string    `json:"doctor_phone"`
	PatientName     string    `json:"patient_name"`
	DoctorName      string    `json:"doctor_name"`
	StartTime       time.Time `json:"start_time"`
	EndTime         time.Time `json:"end_time"`
	AppointmentType string    `json:"appointment_type"`
	CompletedReason string    `json:"completed_reason,omitempty"`
}
