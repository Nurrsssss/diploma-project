package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// DoctorSchedule представляет расписание врача
type DoctorSchedule struct {
	ID                uuid.UUID `json:"id" gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	DoctorID          uuid.UUID `json:"doctor_id" gorm:"type:uuid;not null;index"`
	Name              string    `json:"name" gorm:"type:varchar(255);not null"`
	WorkDays          []int     `json:"work_days" gorm:"serializer:json"`
	StartTime         string    `json:"start_time" gorm:"type:varchar(5);not null"`
	EndTime           string    `json:"end_time" gorm:"type:varchar(5);not null"`
	BreakStart        *string   `json:"break_start,omitempty" gorm:"type:varchar(5)"`
	BreakEnd          *string   `json:"break_end,omitempty" gorm:"type:varchar(5)"`
	SlotDuration      int64     `json:"slot_duration" gorm:"type:bigint;not null;default:30"`
	SlotTitle         string    `json:"slot_title" gorm:"type:varchar(255)"`
	AppointmentFormat string    `json:"appointment_format" gorm:"type:varchar(10);not null;default:'offline'"`
	IsActive          bool      `json:"is_active" gorm:"default:true"`
	CreatedAt         time.Time `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt         time.Time `json:"updated_at" gorm:"autoUpdateTime"`
}

// ScheduleDay представляет настройки для конкретного дня недели
type ScheduleDay struct {
	ID           uuid.UUID `json:"id" gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	ScheduleID   uuid.UUID `json:"schedule_id" gorm:"type:uuid;not null;index"`
	DayOfWeek    int       `json:"day_of_week" gorm:"not null"` // 1=Пн, 2=Вт, ..., 7=Вс
	StartTime    string    `json:"start_time" gorm:"type:varchar(5);not null"`
	EndTime      string    `json:"end_time" gorm:"type:varchar(5);not null"`
	BreakStart   *string   `json:"break_start,omitempty" gorm:"type:varchar(5)"`
	BreakEnd     *string   `json:"break_end,omitempty" gorm:"type:varchar(5)"`
	IsWorkingDay bool      `json:"is_working_day" gorm:"default:true"`
	CreatedAt    time.Time `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt    time.Time `json:"updated_at" gorm:"autoUpdateTime"`
}

// TableName задает имя таблицы для GORM
func (DoctorSchedule) TableName() string {
	return "doctor_schedules"
}

// TableName задает имя таблицы для ScheduleDay
func (ScheduleDay) TableName() string {
	return "schedule_days"
}

// BeforeCreate автоматически генерирует UUID для ScheduleDay
func (sd *ScheduleDay) BeforeCreate(tx *gorm.DB) error {
	if sd.ID == uuid.Nil {
		sd.ID = uuid.New()
	}
	return nil
}

// HasWorkDay проверяет работает ли врач в указанный день недели
func (s *DoctorSchedule) HasWorkDay(day int) bool {
	for _, d := range s.WorkDays {
		if d == day {
			return true
		}
	}
	return false
}

// IsWorkingAt проверяет работает ли врач в указанное время
func (s *DoctorSchedule) IsWorkingAt(t time.Time) bool {
	weekday := int(t.Weekday())
	if weekday == 0 {
		weekday = 7 // Воскресенье = 7
	}

	if !s.HasWorkDay(weekday) {
		return false
	}

	timeStr := t.Format("15:04")
	return timeStr >= s.StartTime && timeStr <= s.EndTime
}

// ScheduleException - исключения в расписании (выходные, изменения)
type ScheduleException struct {
	ID       uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	DoctorID uuid.UUID `gorm:"type:uuid;not null;index" json:"doctor_id"`
	Date     time.Time `gorm:"type:date;not null;index" json:"date"`
	Type     string    `gorm:"type:varchar(20);not null" json:"type"` // "day_off", "custom_hours"

	// Для кастомных часов
	CustomStartTime *string `gorm:"type:varchar(5)" json:"custom_start_time,omitempty"`
	CustomEndTime   *string `gorm:"type:varchar(5)" json:"custom_end_time,omitempty"`

	Reason    string    `gorm:"type:varchar(255)" json:"reason"` // "Отпуск"
	CreatedAt time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt time.Time `gorm:"autoUpdateTime" json:"updated_at"`
}

func (ScheduleException) TableName() string {
	return "schedule_exceptions"
}

func (e *ScheduleException) BeforeCreate(tx *gorm.DB) error {
	if e.ID == uuid.Nil {
		e.ID = uuid.New()
	}
	return nil
}
