package models

import (
	"time"

	"github.com/google/uuid"
)

type Service struct {
	ID              uint64          `gorm:"primaryKey" json:"id"`
	LegacyID        *int64          `gorm:"column:legacy_id" json:"legacy_id,omitempty"`
	CategoryID      uuid.UUID       `gorm:"type:uuid;not null;index" json:"category_id"`
	Category        ServiceCategory `gorm:"foreignKey:CategoryID" json:"category"`
	ExternalCode    *string         `gorm:"type:varchar(100)" json:"external_code,omitempty"`
	Name            string          `gorm:"type:text;not null" json:"name"`
	ServiceName     string          `gorm:"column:service_name;type:text;not null" json:"service_name"`
	Price           int             `gorm:"not null;default:0" json:"price"`
	DurationMinutes int             `gorm:"column:duration_minutes;not null;default:0" json:"duration_minutes"`
	IsActive        bool            `gorm:"column:is_active;not null;default:true" json:"is_active"`
	CreatedAt       time.Time       `json:"created_at"`
	UpdatedAt       time.Time       `json:"updated_at"`
}

func (Service) TableName() string {
	return "services"
}
