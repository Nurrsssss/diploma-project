package models

import "github.com/google/uuid"

type BookAppointmentByDoctorRequest struct {
	PatientID       uuid.UUID  `json:"patient_id" validate:"required"`
	AppointmentType string     `json:"appointment_type" validate:"omitempty,oneof=online offline both"`
	PatientNotes    string     `json:"patient_notes" validate:"max=1000"`
	AnketaID        *uuid.UUID `json:"anketa_id" validate:"omitempty"`
	CabinetNumber   *int       `json:"cabinet_number"`
	Channel         *string    `json:"channel"`
	ServiceID       *string    `json:"service_id"`
	DurationMinutes *int       `json:"duration_minutes" validate:"omitempty,min=15,max=480"` // ✅ NEW
	Blocks          int        `json:"blocks,omitempty" validate:"omitempty,min=1,max=32"`
}
