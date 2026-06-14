package models

import (
	"time"

	"github.com/google/uuid"
)

// === SCHEDULE DTOs ===

// ScheduleDayRequest - настройки для конкретного дня недели (DTO)
type ScheduleDayRequest struct {
	DayOfWeek    int     `json:"day_of_week" validate:"required,min=1,max=7"`      // 1=Пн, 2=Вт, ..., 7=Вс
	StartTime    string  `json:"start_time" validate:"required,len=5"`             // "09:00"
	EndTime      string  `json:"end_time" validate:"required,len=5"`               // "17:00"
	BreakStart   *string `json:"break_start,omitempty" validate:"omitempty,len=5"` // "12:00"
	BreakEnd     *string `json:"break_end,omitempty" validate:"omitempty,len=5"`   // "13:00"
	IsWorkingDay bool    `json:"is_working_day"`                                   // true/false
}

// CreateScheduleRequest - создание расписания врача (основной DTO)
type CreateScheduleRequest struct {
	Name              string               `json:"name" validate:"required,min=1,max=255"`                                // "Основное расписание"
	WorkDays          []int                `json:"work_days,omitempty" validate:"omitempty,min=1,max=7,dive,min=1,max=7"` // [1,2,3,4,5] - для обратной совместимости
	StartTime         string               `json:"start_time,omitempty" validate:"omitempty,len=5"`                       // "09:00" - для обратной совместимости
	EndTime           string               `json:"end_time,omitempty" validate:"omitempty,len=5"`                         // "18:00" - для обратной совместимости
	BreakStart        *string              `json:"break_start,omitempty" validate:"omitempty,len=5"`                      // "12:00" - для обратной совместимости
	BreakEnd          *string              `json:"break_end,omitempty" validate:"omitempty,len=5"`                        // "13:00" - для обратной совместимости
	SlotDuration      int64                `json:"slot_duration" validate:"required,min=1,max=180"`                       // 30
	SlotTitle         string               `json:"slot_title" validate:"max=255"`                                         // "Консультация"
	AppointmentFormat string               `json:"appointment_format" validate:"required,oneof=offline online both"`      // "offline", "online", "both"
	Days              []ScheduleDayRequest `json:"days,omitempty" validate:"omitempty,dive"`                              // Детальные настройки для каждого дня

	// Параметры для генерации слотов (опционально)
	SlotsStartDate string `json:"slots_start_date,omitempty" validate:"omitempty,len=10"` // "2024-06-01"
	SlotsEndDate   string `json:"slots_end_date,omitempty" validate:"omitempty,len=10"`   // "2024-06-30"
}

// CreateScheduleResponse - ответ создания расписания
type CreateScheduleResponse struct {
	Schedule *ScheduleResponse      `json:"schedule"`
	Slots    *GenerateSlotsResponse `json:"slots,omitempty"`
}

// ScheduleResponse - ответ с расписанием
type ScheduleResponse struct {
	ID                uuid.UUID            `json:"id"`
	DoctorID          uuid.UUID            `json:"doctor_id"`
	Name              string               `json:"name"`
	WorkDays          []int                `json:"work_days"`             // Для обратной совместимости
	StartTime         string               `json:"start_time"`            // Для обратной совместимости
	EndTime           string               `json:"end_time"`              // Для обратной совместимости
	BreakStart        *string              `json:"break_start,omitempty"` // Для обратной совместимости
	BreakEnd          *string              `json:"break_end,omitempty"`   // Для обратной совместимости
	SlotDuration      int64                `json:"slot_duration"`
	SlotTitle         string               `json:"slot_title"`
	AppointmentFormat string               `json:"appointment_format"`
	IsActive          bool                 `json:"is_active"`
	Days              []ScheduleDayRequest `json:"days,omitempty"`             // Детальные настройки для каждого дня
	SlotsStartDate    string               `json:"slots_start_date,omitempty"` // Дата начала генерации слотов
	SlotsEndDate      string               `json:"slots_end_date,omitempty"`   // Дата окончания генерации слотов
	CreatedAt         time.Time            `json:"created_at"`
	UpdatedAt         time.Time            `json:"updated_at"`
}

// UpdateScheduleRequest - обновление расписания врача
type UpdateScheduleRequest struct {
	Name              *string               `json:"name,omitempty" validate:"omitempty,min=1,max=255"`
	WorkDays          *[]int                `json:"work_days,omitempty" validate:"omitempty,min=1,max=7,dive,min=1,max=7"`
	StartTime         *string               `json:"start_time,omitempty" validate:"omitempty,len=5"`
	EndTime           *string               `json:"end_time,omitempty" validate:"omitempty,len=5"`
	BreakStart        *string               `json:"break_start,omitempty" validate:"omitempty,len=5"`
	BreakEnd          *string               `json:"break_end,omitempty" validate:"omitempty,len=5"`
	SlotDuration      *int64                `json:"slot_duration,omitempty" validate:"omitempty,min=1,max=180"`
	SlotTitle         *string               `json:"slot_title,omitempty" validate:"omitempty,max=255"`
	AppointmentFormat *string               `json:"appointment_format,omitempty" validate:"omitempty,oneof=offline online both"`
	Days              *[]ScheduleDayRequest `json:"days,omitempty" validate:"omitempty,dive"`               // Детальные настройки для каждого дня
	SlotsStartDate    *string               `json:"slots_start_date,omitempty" validate:"omitempty,len=10"` // Дата начала генерации слотов
	SlotsEndDate      *string               `json:"slots_end_date,omitempty" validate:"omitempty,len=10"`   // Дата окончания генерации слотов
}

// ToggleScheduleRequest - активация/деактивация расписания
type ToggleScheduleRequest struct {
	IsActive bool `json:"is_active"`
}

// GenerateSlotsRequest - генерация слотов
type GenerateSlotsRequest struct {
	StartDate string `json:"start_date" validate:"required,len=10"` // "2024-06-01"
	EndDate   string `json:"end_date" validate:"required,len=10"`   // "2024-06-30"
}

// GenerateSlotsResponse - ответ генерации слотов
type GenerateSlotsResponse struct {
	SlotsCreated int    `json:"slots_created"`
	Message      string `json:"message"`
}

// === APPOINTMENT DTOs ===

// BookAppointmentRequest - бронирование записи
type BookAppointmentRequest struct {
	AppointmentType string     `json:"appointment_type" validate:"omitempty,oneof=offline online"` // "offline", "online"
	PatientNotes    string     `json:"patient_notes" validate:"max=1000"`                          // "Болит голова"
	AnketaID        *uuid.UUID `json:"anketa_id,omitempty" validate:"omitempty,uuid"`
	Blocks          int        `json:"blocks" validate:"omitempty,min=1,max=32"`
}

// RescheduleAppointmentRequest - перенос записи врачом по целевому слоту
type RescheduleAppointmentRequest struct {
	TargetSlotID uuid.UUID `json:"target_slot_id" validate:"required,uuid"`
	Reason       string    `json:"reason" validate:"max=255"`
}

// AppointmentResponse - ответ с записью
type AppointmentResponse struct {
	ID        uuid.UUID `json:"id"`
	StartTime time.Time `json:"start_time"`
	EndTime   time.Time `json:"end_time"`

	DoctorID     uuid.UUID  `json:"doctor_id"`
	DoctorUserID *uuid.UUID `json:"doctor_user_id,omitempty"` // user_id врача для переноса записи
	PatientID    *uuid.UUID `json:"patient_id,omitempty"`

	Title           string `json:"title"`
	Status          string `json:"status"`
	AppointmentType string `json:"appointment_type"`

	// Онлайн встреча (только для онлайн записей)
	MeetingLink *string `json:"meeting_link,omitempty"`
	MeetingID   *string `json:"meeting_id,omitempty"`

	PatientNotes string `json:"patient_notes"`
	DoctorNotes  string `json:"doctor_notes"`

	// Новые поля для анкет и паспортов здоровья
	AnketaID         *uuid.UUID `json:"anketa_id,omitempty"`          // ID анкеты, выбранной пациентом
	HealthPassportID *uuid.UUID `json:"health_passport_id,omitempty"` // ID паспорта здоровья, созданного врачом

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// UpdateAppointmentRequest - обновление записи врачом
type UpdateAppointmentRequest struct {
	DoctorNotes      string     `json:"doctor_notes" validate:"max=1000"`                       // Заметки врача
	HealthPassportID *uuid.UUID `json:"health_passport_id,omitempty" validate:"omitempty,uuid"` // ID паспорта здоровья
}

// CompleteAppointmentRequest - завершение записи врачом
type CompleteAppointmentRequest struct {
	DoctorNotes      string     `json:"doctor_notes" validate:"max=1000"`                       // Заметки врача о завершении
	CompletedReason  string     `json:"completed_reason" validate:"max=255"`                    // Причина завершения
	HealthPassportID *uuid.UUID `json:"health_passport_id,omitempty" validate:"omitempty,uuid"` // ID паспорта здоровья
}

// AvailableSlot - доступный слот для пациента
type AvailableSlot struct {
	ID              uuid.UUID `json:"id"`
	StartTime       time.Time `json:"start_time"`
	EndTime         time.Time `json:"end_time"`
	Duration        int       `json:"duration_minutes"`
	Title           string    `json:"title"`
	AppointmentType string    `json:"appointment_type"` // "offline", "online", "both"
}

// === EXCEPTION DTOs ===

// AddExceptionRequest - добавление исключения
// Поддерживает: конкретную дату (date) ИЛИ диапазон дат (start, end)
// Для закрытия часуов в конкретный день используйте type=custom_hours + custom_start_time/custom_end_time
// Для закрытия целого дня используйте type=day_off
// При переданном диапазоне создаются исключения на каждый день включительно
// Если указаны и date, и start/end — приоритет у диапазона
// time форматы: date/start/end = YYYY-MM-DD; custom_* = HH:MM
// Валидация на стороне handler
// NOTE: прежнее значение "custom_hours" сохраняем для совместимости
// (type поддерживает обе записи: custom_hours и closed_hours)
//
// example payloads:
// {"type":"day_off","date":"2025-08-21","reason":"совещание"}
// {"type":"day_off","start":"2025-08-21","end":"2025-09-03","reason":"отпуск"}
// {"type":"custom_hours","date":"2025-08-21","custom_start_time":"13:00","custom_end_time":"18:00","reason":"встреча"}
// {"type":"closed_hours","date":"2025-08-21","custom_start_time":"13:00","custom_end_time":"18:00"}
//
// swagger:parameters AddExceptionRequest
type AddExceptionRequest struct {
	// ✅ то, что требует reception
	DoctorUserID string `json:"doctor_user_id,omitempty" query:"doctor_user_id"`
	SpecialistID string `json:"specialist_id,omitempty"  query:"specialist_id"`

	// существующие поля
	Date            string `json:"date,omitempty"`
	Start           string `json:"start,omitempty"`
	End             string `json:"end,omitempty"`
	Type            string `json:"type" validate:"required,oneof=day_off custom_hours closed_hours"`
	Reason          string `json:"reason" validate:"required"`
	CustomStartTime string `json:"custom_start_time,omitempty"`
	CustomEndTime   string `json:"custom_end_time,omitempty"`
}

// ExceptionResponse - ответ с исключением
type ExceptionResponse struct {
	ID              uuid.UUID `json:"id"`
	DoctorID        uuid.UUID `json:"doctor_id"`
	Date            time.Time `json:"date"`
	Type            string    `json:"type"`
	CustomStartTime *string   `json:"custom_start_time,omitempty"`
	CustomEndTime   *string   `json:"custom_end_time,omitempty"`
	Reason          string    `json:"reason"`
	CreatedAt       time.Time `json:"created_at"`
}

// === COMMON RESPONSES ===

// APIResponse - стандартный ответ API
type APIResponse struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
}

// PaginatedResponse - ответ с пагинацией
type PaginatedResponse struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data"`
	Total   int64       `json:"total"`
	Page    int         `json:"page"`
	Limit   int         `json:"limit"`
}

// GeneratedSlotsRequest - запрос для получения сгенерированных слотов
type GeneratedSlotsRequest struct {
	StartDate string `json:"start_date" validate:"required,len=10"` // "2024-06-01"
	EndDate   string `json:"end_date" validate:"required,len=10"`   // "2024-06-30"
}

// === APPOINTMENT FILES DTOs ===

// AppointmentFileUploadRequest - запрос загрузки файла к записи
type AppointmentFileUploadRequest struct {
	FileType string `json:"file_type" validate:"max=50"` // Тип файла (опционально)
	Name     string `json:"name" validate:"max=255"`     // Описательное имя (опционально)
}

// AddAppointmentFilesRequest - запрос добавления существующих файлов к записи
type AddAppointmentFilesRequest struct {
	FileIDs []uuid.UUID `json:"file_ids" validate:"required,min=1,dive,uuid"` // Список ID файлов для добавления
}

// AddAppointmentFilesResponse - ответ добавления файлов к записи
type AddAppointmentFilesResponse struct {
	AddedFiles []*AppointmentFileResponse `json:"added_files"` // Добавленные файлы
	Errors     []string                   `json:"errors"`      // Ошибки при добавлении (если есть)
}

// AppointmentFileResponse - ответ с информацией о файле записи
type AppointmentFileResponse struct {
	ID            uuid.UUID `json:"id"`
	AppointmentID uuid.UUID `json:"appointment_id"`
	FileID        uuid.UUID `json:"file_id"`
	FileType      string    `json:"file_type"`
	UploadedBy    string    `json:"uploaded_by"`
	CreatedAt     time.Time `json:"created_at"`

	// Информация о файле из FileServer
	FileName     string `json:"file_name"`
	OriginalName string `json:"original_name"`
	MimeType     string `json:"mime_type"`
	Size         int64  `json:"size"`
}

// === APPOINTMENT TRANSCRIPTION DTOs ===

type AppointmentTranscriptionResponse struct {
	AppointmentID uuid.UUID  `json:"appointment_id"`
	Text          *string    `json:"text"`
	Lang          *string    `json:"lang,omitempty"`
	Source        *string    `json:"source,omitempty"`
	TranscribedAt *time.Time `json:"transcribed_at,omitempty"`
	TranscribedBy *uuid.UUID `json:"transcribed_by,omitempty"`
}

type AppointmentTranscriptionUpdateRequest struct {
	Text   string  `json:"text" validate:"required,min=1"`
	Lang   *string `json:"lang,omitempty" validate:"omitempty,max=8"`
	Source *string `json:"source,omitempty" validate:"omitempty,oneof=ai manual"`
}

// GeneratedSlotDetail - детальная информация о сгенерированном слоте
type GeneratedSlotDetail struct {
	ID              uuid.UUID  `json:"id"`
	StartTime       time.Time  `json:"start_time"`
	EndTime         time.Time  `json:"end_time"`
	Duration        int        `json:"duration_minutes"`
	Status          string     `json:"status"`           // "available", "booked", "canceled"
	AppointmentType string     `json:"appointment_type"` // "offline", "online", "both"
	Title           string     `json:"title"`
	Channel         *string    `json:"channel,omitempty"`
	CabinetNumber   *int       `json:"cabinet_number,omitempty"`
	ServiceID       *string    `json:"service_id,omitempty"`
	DoctorID        uuid.UUID  `json:"doctor_id"`
	PatientID       *uuid.UUID `json:"patient_id,omitempty"`
	// Информация о пациенте, если слот забронирован
	PatientNotes string     `json:"patient_notes,omitempty"`
	BookedAt     *time.Time `json:"booked_at,omitempty"`
}

// ScheduleMetadata - метаданные расписания для сгенерированных слотов
type ScheduleMetadata struct {
	ID                uuid.UUID `json:"id"`
	Name              string    `json:"name"`
	WorkDays          []int     `json:"work_days"`
	StartTime         string    `json:"start_time"`
	EndTime           string    `json:"end_time"`
	BreakStart        *string   `json:"break_start,omitempty"`
	BreakEnd          *string   `json:"break_end,omitempty"`
	SlotDuration      int64     `json:"slot_duration"`
	SlotTitle         string    `json:"slot_title"`
	AppointmentFormat string    `json:"appointment_format"`
	IsActive          bool      `json:"is_active"`
}

// GeneratedSlotsResponse - ответ с детальной информацией о сгенерированных слотах
type GeneratedSlotsResponse struct {
	Schedule ScheduleMetadata      `json:"schedule"`
	Period   Period                `json:"period"`
	Slots    []GeneratedSlotDetail `json:"slots"`
	Summary  SlotsSummary          `json:"summary"`
}

// Period - период генерации слотов
type Period struct {
	StartDate string `json:"start_date"` // "2024-06-01"
	EndDate   string `json:"end_date"`   // "2024-06-30"
	Days      int    `json:"days"`       // Количество дней в периоде
}

// SlotsSummary - сводка по слотам
type SlotsSummary struct {
	TotalSlots     int `json:"total_slots"`
	AvailableSlots int `json:"available_slots"`
	BookedSlots    int `json:"booked_slots"`
	CanceledSlots  int `json:"canceled_slots"`
}
