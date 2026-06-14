package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// AppointmentFile - связь файлов с записями к врачу
type AppointmentFile struct {
	ID            uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	AppointmentID uuid.UUID `gorm:"type:uuid;not null;index" json:"appointment_id"`
	FileID        uuid.UUID `gorm:"type:uuid;not null;index" json:"file_id"`

	// Тип файла (опционально, может быть пустым)
	FileType string `gorm:"type:varchar(50)" json:"file_type,omitempty"`

	// Кто загрузил файл
	UploadedBy string `gorm:"type:varchar(20);not null;check:uploaded_by IN ('patient', 'doctor')" json:"uploaded_by"`

	CreatedAt time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt time.Time `gorm:"autoUpdateTime" json:"updated_at"`
}

// Константы для загрузчика файла
const (
	UploadedByPatient = "patient"
	UploadedByDoctor  = "doctor"
)

func (AppointmentFile) TableName() string {
	return "appointment_files"
}

func (af *AppointmentFile) BeforeCreate(tx *gorm.DB) error {
	if af.ID == uuid.Nil {
		af.ID = uuid.New()
	}
	return nil
}

// ValidateUploadedBy проверяет корректность загрузчика
func ValidateUploadedBy(uploadedBy string) bool {
	return uploadedBy == UploadedByPatient || uploadedBy == UploadedByDoctor
}
