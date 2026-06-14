package repository

import (
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/printprince/vitalem/appointment_service/internal/models"
	"gorm.io/gorm"
)

// AppointmentRepository - интерфейс репозитория
type AppointmentRepository interface {
	// OPTIONAL: если где-то нужен доступ к *gorm.DB (транзакции и т.п.)
	DB() *gorm.DB

	// Schedules
	GetDoctorIDByUserID(userID uuid.UUID) (*uuid.UUID, error)
	GetAppointmentsInRange(startTime, endTime time.Time) ([]*models.Appointment, error)
	DeleteAppointment(appointmentID uuid.UUID) error
	CreateSchedule(schedule *models.DoctorSchedule) error
	GetDoctorSchedules(doctorID uuid.UUID) ([]*models.DoctorSchedule, error)
	GetScheduleByID(id uuid.UUID) (*models.DoctorSchedule, error)
	UpdateSchedule(schedule *models.DoctorSchedule) error
	DeleteSchedule(id uuid.UUID) error
	Delete(id uuid.UUID) error

	// Slots
	DeleteScheduleSlots(scheduleID uuid.UUID) error
	GetScheduleSlots(scheduleID uuid.UUID, startDate, endDate time.Time) ([]*models.Appointment, error)
	UpdateScheduleAppointmentType(scheduleID uuid.UUID, appointmentType string) error
	CreateAppointmentsBatch(appointments []*models.Appointment) error

	// Schedule Days
	CreateScheduleDay(scheduleDay *models.ScheduleDay) error
	GetScheduleDays(scheduleID uuid.UUID) ([]*models.ScheduleDay, error)
	UpdateScheduleDay(scheduleDay *models.ScheduleDay) error
	DeleteScheduleDay(id uuid.UUID) error
	DeleteScheduleDays(scheduleID uuid.UUID) error

	// Appointments
	CreateAppointment(appointment *models.Appointment) error
	GetAppointmentByID(id uuid.UUID) (*models.Appointment, error)

	GetAvailableSlots(doctorID uuid.UUID, startDate, endDate time.Time) ([]*models.Appointment, error)
	GetDoctorAppointments(doctorID uuid.UUID) ([]*models.Appointment, error)
	GetPatientAppointments(patientID uuid.UUID) ([]*models.Appointment, error)
	UpdateAppointment(appointment *models.Appointment) error
	GetDoctorUserID(doctorID uuid.UUID) (*uuid.UUID, error)
	CheckSlotExists(doctorID uuid.UUID, startTime, endTime time.Time) (bool, error)

	// Exceptions
	CreateException(exception *models.ScheduleException) error
	GetDoctorExceptions(doctorID uuid.UUID, startDate, endDate time.Time) ([]*models.ScheduleException, error)
	GetExceptionByID(id uuid.UUID) (*models.ScheduleException, error)
	DeleteException(id uuid.UUID) error

	// Appointment Files
	CreateAppointmentFile(appointmentFile *models.AppointmentFile) error
	GetAppointmentFiles(appointmentID uuid.UUID) ([]*models.AppointmentFile, error)
	GetAppointmentFileByID(id uuid.UUID) (*models.AppointmentFile, error)
	DeleteAppointmentFile(id uuid.UUID) error
	CheckFileAttachedToAppointment(appointmentID, fileID uuid.UUID) (bool, error)
	GetPatientRecordIDByUserID(userID uuid.UUID) (*uuid.UUID, error)
	// Transcription
	GetAppointmentTranscription(appointmentID uuid.UUID) (*models.Appointment, error)
	UpdateAppointmentTranscription(appointmentID uuid.UUID, text *string, lang, source *string, by *uuid.UUID, at time.Time) error
	ClearAppointmentTranscription(appointmentID uuid.UUID) error
}

// appointmentRepository - реализация репозитория
type appointmentRepository struct {
	db *gorm.DB
}

// NewAppointmentRepository - создание нового репозитория
func NewAppointmentRepository(db *gorm.DB) AppointmentRepository {
	return &appointmentRepository{db: db}
}

func (r *appointmentRepository) GetByID(id uuid.UUID) (*models.Appointment, error) {
	var appointment models.Appointment
	if err := r.db.First(&appointment, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &appointment, nil
}

func (r *appointmentRepository) Delete(id uuid.UUID) error {
	return r.db.Delete(&models.Appointment{}, "id = ?", id).Error
}

// DB exposes underlying *gorm.DB for advanced transactions (optional use)
func (r *appointmentRepository) DB() *gorm.DB {
	return r.db
}
func (r *appointmentRepository) DeleteAppointment(appointmentID uuid.UUID) error {
	return r.db.Model(&models.Appointment{}).
		Where("id = ?", appointmentID).
		Updates(map[string]interface{}{
			"status":             "available",
			"patient_id":         nil,
			"title":              "",
			"patient_notes":      "",
			"doctor_notes":       "",
			"booked_at":          nil,
			"updated_at":         time.Now(),
			"health_passport_id": nil,
			"anketa_id":          nil,
		}).Error
}

// === SCHEDULES ===
func (r *appointmentRepository) GetPatientRecordIDByUserID(userID uuid.UUID) (*uuid.UUID, error) {
	var patientIDRaw string

	err := r.db.
		Table("patients").
		Select("id").
		Where("user_id = ?", userID).
		Scan(&patientIDRaw).Error
	if err != nil {
		return nil, err
	}

	if strings.TrimSpace(patientIDRaw) == "" {
		return nil, nil
	}

	patientID, err := uuid.Parse(strings.TrimSpace(patientIDRaw))
	if err != nil {
		return nil, err
	}

	return &patientID, nil
}

// GetDoctorIDByUserID получает doctor.id по doctors.user_id
func (r *appointmentRepository) GetDoctorIDByUserID(userID uuid.UUID) (*uuid.UUID, error) {
	var doctorIDRaw string

	err := r.db.Table("doctors").
		Select("id").
		Where("user_id = ?", userID).
		Scan(&doctorIDRaw).Error

	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}

	if strings.TrimSpace(doctorIDRaw) == "" {
		return nil, nil
	}

	doctorID, err := uuid.Parse(strings.TrimSpace(doctorIDRaw))
	if err != nil {
		return nil, err
	}
	return &doctorID, nil
}

func (r *appointmentRepository) GetAppointmentsInRange(startTime, endTime time.Time) ([]*models.Appointment, error) {
	var appointments []*models.Appointment
	err := r.db.
		Where("start_time < ? AND end_time > ?", endTime, startTime).
		Order("start_time ASC").
		Find(&appointments).Error
	return appointments, err
}

func (r *appointmentRepository) CreateSchedule(schedule *models.DoctorSchedule) error {
	return r.db.Create(schedule).Error
}

func (r *appointmentRepository) GetDoctorSchedules(doctorID uuid.UUID) ([]*models.DoctorSchedule, error) {
	var schedules []*models.DoctorSchedule
	err := r.db.Where("doctor_id = ?", doctorID).
		Order("is_active DESC, created_at DESC").
		Find(&schedules).Error
	return schedules, err
}

func (r *appointmentRepository) GetScheduleByID(id uuid.UUID) (*models.DoctorSchedule, error) {
	var schedule models.DoctorSchedule
	err := r.db.Where("id = ?", id).First(&schedule).Error
	if err != nil {
		return nil, err
	}
	return &schedule, nil
}

func (r *appointmentRepository) UpdateSchedule(schedule *models.DoctorSchedule) error {
	return r.db.Save(schedule).Error
}

func (r *appointmentRepository) DeleteSchedule(id uuid.UUID) error {
	// Удаляем все слоты расписания
	if err := r.DeleteScheduleSlots(id); err != nil {
		return err
	}

	// Удаляем детальные настройки дней
	if err := r.DeleteScheduleDays(id); err != nil {
		return err
	}

	// Затем физически удаляем расписание
	return r.db.Delete(&models.DoctorSchedule{}, "id = ?", id).Error
}

// === SCHEDULE DAYS ===

func (r *appointmentRepository) CreateScheduleDay(scheduleDay *models.ScheduleDay) error {
	return r.db.Create(scheduleDay).Error
}

func (r *appointmentRepository) GetScheduleDays(scheduleID uuid.UUID) ([]*models.ScheduleDay, error) {
	var scheduleDays []*models.ScheduleDay
	err := r.db.Where("schedule_id = ?", scheduleID).
		Order("day_of_week ASC").
		Find(&scheduleDays).Error
	return scheduleDays, err
}

func (r *appointmentRepository) UpdateScheduleDay(scheduleDay *models.ScheduleDay) error {
	return r.db.Save(scheduleDay).Error
}

func (r *appointmentRepository) DeleteScheduleDay(id uuid.UUID) error {
	return r.db.Delete(&models.ScheduleDay{}, "id = ?", id).Error
}

func (r *appointmentRepository) DeleteScheduleDays(scheduleID uuid.UUID) error {
	return r.db.Delete(&models.ScheduleDay{}, "schedule_id = ?", scheduleID).Error
}

// === APPOINTMENTS ===

func (r *appointmentRepository) CreateAppointment(appointment *models.Appointment) error {
	return r.db.Create(appointment).Error
}

func (r *appointmentRepository) GetAppointmentByID(id uuid.UUID) (*models.Appointment, error) {
	var appointment models.Appointment
	err := r.db.Where("id = ?", id).First(&appointment).Error
	if err != nil {
		return nil, err
	}
	return &appointment, nil
}

func (r *appointmentRepository) GetDoctorUserID(doctorID uuid.UUID) (*uuid.UUID, error) {
	var userID uuid.UUID

	err := r.db.Table("doctors").
		Select("user_id").
		Where("id = ?", doctorID).
		Scan(&userID).Error

	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}

	if userID == uuid.Nil {
		return nil, nil
	}
	return &userID, nil
}

func (r *appointmentRepository) GetAvailableSlots(doctorID uuid.UUID, startDate, endDate time.Time) ([]*models.Appointment, error) {
	var appointments []*models.Appointment
	err := r.db.Where("doctor_id = ? AND status = ? AND start_time >= ? AND end_time <= ?",
		doctorID, "available", startDate, endDate).
		Order("start_time ASC").
		Find(&appointments).Error
	return appointments, err
}

func (r *appointmentRepository) GetDoctorAppointments(doctorID uuid.UUID) ([]*models.Appointment, error) {
	var appointments []*models.Appointment
	err := r.db.Where("doctor_id = ?", doctorID).
		Order("start_time ASC").
		Find(&appointments).Error
	return appointments, err
}

func (r *appointmentRepository) GetPatientAppointments(userID uuid.UUID) ([]*models.Appointment, error) {
	var appointments []*models.Appointment

	err := r.db.Table("appointments a").
		Select("a.*").
		Joins("LEFT JOIN patients p ON p.id = a.patient_id OR p.user_id = a.patient_id").
		Where("p.user_id = ? OR a.patient_id = ?", userID, userID).
		Order("a.start_time ASC").
		Scan(&appointments).Error

	return appointments, err
}
func (r *appointmentRepository) UpdateAppointment(appointment *models.Appointment) error {
	return r.db.Save(appointment).Error
}

func (r *appointmentRepository) CheckSlotExists(doctorID uuid.UUID, startTime, endTime time.Time) (bool, error) {
	var count int64
	err := r.db.Model(&models.Appointment{}).
		Where("doctor_id = ? AND ((start_time <= ? AND end_time > ?) OR (start_time < ? AND end_time >= ?) OR (start_time >= ? AND end_time <= ?))",
			doctorID, startTime, startTime, endTime, endTime, startTime, endTime).
		Count(&count).Error
	return count > 0, err
}

// === SLOTS (NEW METHODS) ===

func (r *appointmentRepository) DeleteScheduleSlots(scheduleID uuid.UUID) error {
	return r.db.Where("schedule_id = ?", scheduleID).
		Delete(&models.Appointment{}).Error
}

func (r *appointmentRepository) GetScheduleSlots(scheduleID uuid.UUID, startDate, endDate time.Time) ([]*models.Appointment, error) {
	var slots []*models.Appointment
	err := r.db.Where("schedule_id = ? AND start_time >= ? AND end_time <= ?",
		scheduleID, startDate, endDate).
		Order("start_time ASC").
		Find(&slots).Error
	return slots, err
}

func (r *appointmentRepository) UpdateScheduleAppointmentType(scheduleID uuid.UUID, appointmentType string) error {
	return r.db.Model(&models.Appointment{}).
		Where("schedule_id = ? AND status = ?", scheduleID, "available").
		Update("appointment_type", appointmentType).Error
}

func (r *appointmentRepository) CreateAppointmentsBatch(appointments []*models.Appointment) error {
	if len(appointments) == 0 {
		return nil
	}
	return r.db.CreateInBatches(appointments, 100).Error
}

// === EXCEPTIONS ===

func (r *appointmentRepository) CreateException(exception *models.ScheduleException) error {
	return r.db.Create(exception).Error
}

func (r *appointmentRepository) GetDoctorExceptions(doctorID uuid.UUID, startDate, endDate time.Time) ([]*models.ScheduleException, error) {
	var exceptions []*models.ScheduleException
	err := r.db.Where("doctor_id = ? AND date >= ? AND date <= ?",
		doctorID, startDate, endDate).
		Order("date ASC").
		Find(&exceptions).Error
	return exceptions, err
}

func (r *appointmentRepository) DeleteException(id uuid.UUID) error {
	return r.db.Delete(&models.ScheduleException{}, "id = ?", id).Error
}

func (r *appointmentRepository) GetExceptionByID(id uuid.UUID) (*models.ScheduleException, error) {
	var exception models.ScheduleException
	err := r.db.Where("id = ?", id).First(&exception).Error
	if err != nil {
		return nil, err
	}
	return &exception, nil
}

// === APPOINTMENT FILES ===

func (r *appointmentRepository) CreateAppointmentFile(appointmentFile *models.AppointmentFile) error {
	return r.db.Create(appointmentFile).Error
}

func (r *appointmentRepository) GetAppointmentFiles(appointmentID uuid.UUID) ([]*models.AppointmentFile, error) {
	var files []*models.AppointmentFile
	err := r.db.Where("appointment_id = ?", appointmentID).
		Order("created_at DESC").
		Find(&files).Error
	return files, err
}

func (r *appointmentRepository) GetAppointmentFileByID(id uuid.UUID) (*models.AppointmentFile, error) {
	var file models.AppointmentFile
	err := r.db.Where("id = ?", id).First(&file).Error
	if err != nil {
		return nil, err
	}
	return &file, nil
}

func (r *appointmentRepository) DeleteAppointmentFile(id uuid.UUID) error {
	return r.db.Where("id = ?", id).Delete(&models.AppointmentFile{}).Error
}

func (r *appointmentRepository) CheckFileAttachedToAppointment(appointmentID, fileID uuid.UUID) (bool, error) {
	var count int64
	err := r.db.Model(&models.AppointmentFile{}).
		Where("appointment_id = ? AND file_id = ?", appointmentID, fileID).
		Count(&count).Error
	return count > 0, err
}

// === TRANSCRIPTION ===

func (r *appointmentRepository) GetAppointmentTranscription(appointmentID uuid.UUID) (*models.Appointment, error) {
	var appointment models.Appointment
	if err := r.db.Select("id, transcription_text, transcription_lang, transcription_source, transcribed_at, transcribed_by").
		Where("id = ?", appointmentID).First(&appointment).Error; err != nil {
		return nil, err
	}
	return &appointment, nil
}

func (r *appointmentRepository) UpdateAppointmentTranscription(appointmentID uuid.UUID, text *string, lang, source *string, by *uuid.UUID, at time.Time) error {
	updates := map[string]interface{}{
		"transcription_text":   text,
		"transcription_lang":   lang,
		"transcription_source": source,
		"transcribed_at":       at,
		"transcribed_by":       by,
		"updated_at":           time.Now(),
	}
	return r.db.Model(&models.Appointment{}).Where("id = ?", appointmentID).Updates(updates).Error
}

func (r *appointmentRepository) ClearAppointmentTranscription(appointmentID uuid.UUID) error {
	updates := map[string]interface{}{
		"transcription_text":   nil,
		"transcription_lang":   nil,
		"transcription_source": nil,
		"transcribed_at":       nil,
		"transcribed_by":       nil,
		"updated_at":           time.Now(),
	}
	return r.db.Model(&models.Appointment{}).Where("id = ?", appointmentID).Updates(updates).Error
}
