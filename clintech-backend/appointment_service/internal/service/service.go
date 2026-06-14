package service

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"strings"
	"time"

	"context"

	"github.com/dgrijalva/jwt-go"
	"github.com/google/uuid"
	"github.com/printprince/vitalem/appointment_service/internal/models"
	"github.com/printprince/vitalem/appointment_service/internal/repository"
	"github.com/printprince/vitalem/logger_service/pkg/logger"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// AppointmentService - интерфейс сервиса
type AppointmentService interface {
	ResolveDoctorIDByUserID(userID uuid.UUID) (uuid.UUID, error)
	DeleteAppointment(userID uuid.UUID, userRole string, appointmentID uuid.UUID) error // Schedules
	GetScheduleBoard(date, from, to string) ([]*models.AppointmentResponse, error)

	CreateSchedule(doctorID uuid.UUID, req *models.CreateScheduleRequest) (*models.CreateScheduleResponse, error)
	GetDoctorSchedules(doctorID uuid.UUID) ([]*models.ScheduleResponse, error)
	UpdateSchedule(doctorID, scheduleID uuid.UUID, req *models.UpdateScheduleRequest) (*models.ScheduleResponse, error)
	DeleteSchedule(doctorID, scheduleID uuid.UUID) error
	ToggleSchedule(doctorID, scheduleID uuid.UUID, req *models.ToggleScheduleRequest, hasRequestBody bool) (*models.ScheduleResponse, error)
	GenerateSlots(doctorID, scheduleID uuid.UUID, req *models.GenerateSlotsRequest) (*models.GenerateSlotsResponse, error)
	GetGeneratedSlots(doctorID, scheduleID uuid.UUID, startDate, endDate string) (*models.GeneratedSlotsResponse, error)
	GetSlotsWithStatuses(doctorID uuid.UUID, startDate, endDate string) (*models.GeneratedSlotsResponse, error)
	BookAppointmentByDoctor(doctorID, appointmentID, patientUserID uuid.UUID, req *models.BookAppointmentByDoctorRequest) (*models.AppointmentResponse, error)

	// Appointments
	GetAvailableSlots(doctorID uuid.UUID, date string) ([]*models.AvailableSlot, error)
	BookAppointment(patientID, appointmentID uuid.UUID, req *models.BookAppointmentRequest) (*models.AppointmentResponse, error)
	CancelAppointment(patientID, appointmentID uuid.UUID) error
	CancelAppointmentByDoctor(doctorID, appointmentID uuid.UUID) error
	UpdateAppointment(doctorID, appointmentID uuid.UUID, req *models.UpdateAppointmentRequest) (*models.AppointmentResponse, error)
	GetDoctorAppointments(doctorID uuid.UUID) ([]*models.AppointmentResponse, error)
	GetDoctorAppointmentByID(doctorID, appointmentID uuid.UUID) (*models.AppointmentResponse, error)
	GetAppointmentByIDForRole(userID uuid.UUID, userRole string, appointmentID uuid.UUID) (*models.AppointmentResponse, error)

	GetPatientAppointments(patientID uuid.UUID) ([]*models.AppointmentResponse, error)
	GetPatientAppointmentByID(patientID, appointmentID uuid.UUID) (*models.AppointmentResponse, error)
	RescheduleAppointmentForRole(userID uuid.UUID, userRole string, appointmentID, targetSlotID uuid.UUID, reason string) (*models.AppointmentResponse, error)
	CompleteAppointment(doctorID, appointmentID uuid.UUID, req *models.CompleteAppointmentRequest) (*models.AppointmentResponse, error)

	// Exceptions
	AddException(doctorID uuid.UUID, req *models.AddExceptionRequest) (*models.ExceptionResponse, error)
	GetDoctorExceptions(doctorID uuid.UUID, startDate, endDate string) ([]*models.ExceptionResponse, error)
	DeleteException(doctorID uuid.UUID, exceptionID uuid.UUID) error

	// New method for forcing clean slots of schedule
	DeleteScheduleSlots(doctorID, scheduleID uuid.UUID) error

	// Appointment Files
	UploadAppointmentFile(userID uuid.UUID, userRole string, appointmentID uuid.UUID, fileData []byte, fileName, mimeType, fileType, name string) (*models.AppointmentFileResponse, error)
	GetAppointmentFiles(userID uuid.UUID, userRole string, appointmentID uuid.UUID) ([]*models.AppointmentFileResponse, error)
	DeleteAppointmentFile(userID uuid.UUID, userRole string, appointmentID, fileID uuid.UUID) error
	DownloadAppointmentFile(userID uuid.UUID, userRole string, appointmentID, fileID uuid.UUID) ([]byte, string, string, error)
	CheckAppointmentAccess(userID uuid.UUID, userRole string, appointmentID uuid.UUID) (bool, error)
	AddAppointmentFiles(userID uuid.UUID, userRole string, appointmentID uuid.UUID, req *models.AddAppointmentFilesRequest) (*models.AddAppointmentFilesResponse, error)

	// Transcription
	GetAppointmentTranscription(userID uuid.UUID, userRole string, appointmentID uuid.UUID) (*models.AppointmentTranscriptionResponse, error)
	UpdateAppointmentTranscription(userID uuid.UUID, userRole string, appointmentID uuid.UUID, req *models.AppointmentTranscriptionUpdateRequest) (*models.AppointmentTranscriptionResponse, error)
	DeleteAppointmentTranscription(userID uuid.UUID, userRole string, appointmentID uuid.UUID) error
}

// appointmentService - реализация сервиса
type appointmentService struct {
	repo           repository.AppointmentRepository
	logger         *logger.Client
	jwtSecret      string
	messageService MessageService
	httpClient     *http.Client
	identityURL    string

	specialistURL string
}

// NewAppointmentService - создание нового сервиса
func NewAppointmentService(repo repository.AppointmentRepository, loggerClient *logger.Client, jwtSecret string, messageService MessageService) AppointmentService {
	return &appointmentService{
		repo:           repo,
		logger:         loggerClient,
		jwtSecret:      jwtSecret,
		messageService: messageService,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
		identityURL:   "http://identity_service:8801",
		specialistURL: "http://specialist_service:8803",
	}
}

// SetLogger - устанавливает логгер для сервиса (deprecated, используйте NewAppointmentService)
func (s *appointmentService) SetLogger(loggerClient *logger.Client) {
	s.logger = loggerClient
}

// logInfo - вспомогательный метод для информационного логирования
func (s *appointmentService) logInfo(message string, metadata map[string]interface{}) {
	if s.logger != nil {
		s.logger.Info(message, metadata)
	}
}

// logError - вспомогательный метод для логирования ошибок
func (s *appointmentService) logError(message string, metadata map[string]interface{}) {
	if s.logger != nil {
		s.logger.Error(message, metadata)
	}
}
func clinicLoc() *time.Location {
	loc, err := time.LoadLocation("Asia/Almaty")
	if err != nil {
		// fallback на +05:00
		return time.FixedZone("Asia/Almaty", 5*60*60)
	}
	return loc
}

// === SCHEDULES ===
func (s *appointmentService) GetScheduleBoard(date, from, to string) ([]*models.AppointmentResponse, error) {
	loc := clinicLoc()
	start, err := time.ParseInLocation("2006-01-02 15:04", date+" "+from, loc)
	if err != nil {
		return nil, err
	}

	end, err := time.ParseInLocation("2006-01-02 15:04", date+" "+to, loc)
	if err != nil {
		return nil, err
	}

	if !end.After(start) {
		return nil, errors.New("to must be after from")
	}

	appts, err := s.repo.GetAppointmentsInRange(start, end)
	if err != nil {
		return nil, err
	}

	out := make([]*models.AppointmentResponse, 0, len(appts))
	for _, a := range appts {
		out = append(out, s.appointmentToResponse(a))
	}
	return out, nil
}

func (s *appointmentService) CreateSchedule(doctorID uuid.UUID, req *models.CreateScheduleRequest) (*models.CreateScheduleResponse, error) {
	s.logInfo("Creating schedule for doctor", map[string]interface{}{
		"doctorID":        doctorID.String(),
		"scheduleName":    req.Name,
		"slotsStartDate":  req.SlotsStartDate,
		"slotsEndDate":    req.SlotsEndDate,
		"hasDetailedDays": len(req.Days) > 0,
	})

	// При создании нового расписания ВСЕГДА деактивируем все существующие
	// чтобы у врача было только одно активное расписание
	s.logInfo("Deactivating all existing schedules for single active schedule policy", map[string]interface{}{
		"doctorID": doctorID.String(),
	})

	if err := s.deactivateOtherSchedules(doctorID); err != nil {
		s.logError("Failed to deactivate existing schedules", map[string]interface{}{
			"doctorID": doctorID.String(),
			"error":    err.Error(),
		})
		return nil, fmt.Errorf("failed to deactivate existing schedules: %w", err)
	}

	// Определяем рабочие дни и время на основе детального расписания или общих настроек
	var workDays []int
	var startTime, endTime string
	var breakStart, breakEnd *string

	if len(req.Days) > 0 {
		// Используем детальное расписание
		workDays = make([]int, 0, len(req.Days))
		for _, day := range req.Days {
			if day.IsWorkingDay {
				workDays = append(workDays, day.DayOfWeek)
			}
		}

		// Для обратной совместимости используем время первого рабочего дня
		if len(workDays) > 0 {
			firstDay := req.Days[workDays[0]-1] // -1 потому что индексы с 0
			startTime = firstDay.StartTime
			endTime = firstDay.EndTime
			breakStart = firstDay.BreakStart
			breakEnd = firstDay.BreakEnd
		}
	} else {
		// Используем общие настройки (для обратной совместимости)
		workDays = req.WorkDays
		startTime = req.StartTime
		endTime = req.EndTime
		breakStart = req.BreakStart
		breakEnd = req.BreakEnd
	}

	schedule := &models.DoctorSchedule{
		DoctorID:          doctorID,
		Name:              req.Name,
		WorkDays:          workDays,
		StartTime:         startTime,
		EndTime:           endTime,
		BreakStart:        breakStart,
		BreakEnd:          breakEnd,
		SlotDuration:      req.SlotDuration,
		SlotTitle:         req.SlotTitle,
		AppointmentFormat: req.AppointmentFormat,
		IsActive:          true, // Новое расписание всегда активно
	}

	if err := s.repo.CreateSchedule(schedule); err != nil {
		s.logError("Failed to create schedule in repository", map[string]interface{}{
			"doctorID": doctorID.String(),
			"error":    err.Error(),
		})
		return nil, fmt.Errorf("failed to create schedule: %w", err)
	}

	// Создаем детальные настройки для каждого дня недели
	if len(req.Days) > 0 {
		for _, dayReq := range req.Days {
			scheduleDay := &models.ScheduleDay{
				ScheduleID:   schedule.ID,
				DayOfWeek:    dayReq.DayOfWeek,
				StartTime:    dayReq.StartTime,
				EndTime:      dayReq.EndTime,
				BreakStart:   dayReq.BreakStart,
				BreakEnd:     dayReq.BreakEnd,
				IsWorkingDay: dayReq.IsWorkingDay,
			}

			if err := s.repo.CreateScheduleDay(scheduleDay); err != nil {
				s.logError("Failed to create schedule day", map[string]interface{}{
					"scheduleID": schedule.ID.String(),
					"dayOfWeek":  dayReq.DayOfWeek,
					"error":      err.Error(),
				})
				return nil, fmt.Errorf("failed to create schedule day: %w", err)
			}
		}
	}

	s.logInfo("Schedule created successfully", map[string]interface{}{
		"doctorID":   doctorID.String(),
		"scheduleID": schedule.ID.String(),
		"isActive":   schedule.IsActive,
		"workDays":   workDays,
	})

	// ВСЕГДА генерируем слоты при создании расписания
	// Определяем период генерации
	startDate := req.SlotsStartDate
	endDate := req.SlotsEndDate

	if startDate == "" || endDate == "" {
		// Если даты не указаны - генерируем слоты на 1 год вперед (более разумный период)
		now := time.Now()
		startDate = now.Format("2006-01-02")
		endDate = time.Date(now.Year()+1, now.Month(), now.Day(), 0, 0, 0, 0, now.Location()).Format("2006-01-02")
	}

	generateReq := &models.GenerateSlotsRequest{
		StartDate: startDate,
		EndDate:   endDate,
	}

	slotsResponse, err := s.GenerateSlots(doctorID, schedule.ID, generateReq)
	if err != nil {
		return nil, err
	}

	response := &models.CreateScheduleResponse{
		Schedule: s.scheduleToResponseWithDates(schedule, startDate, endDate),
		Slots:    slotsResponse,
	}

	return response, nil
}
func (s *appointmentService) ResolveDoctorIDByUserID(userID uuid.UUID) (uuid.UUID, error) {
	docID, err := s.repo.GetDoctorIDByUserID(userID)
	if err != nil {
		return uuid.Nil, err
	}
	if docID == nil {
		return uuid.Nil, fmt.Errorf("doctor not found")
	}
	return *docID, nil
}

// checkScheduleConflicts проверяет конфликты времени с существующими активными расписаниями
func (s *appointmentService) checkScheduleConflicts(doctorID uuid.UUID, req *models.CreateScheduleRequest) error {
	existingSchedules, err := s.repo.GetDoctorSchedules(doctorID)
	if err != nil {
		return fmt.Errorf("failed to get existing schedules: %w", err)
	}

	startTime, err := time.Parse("15:04", req.StartTime)
	if err != nil {
		return fmt.Errorf("invalid start time format: %w", err)
	}

	endTime, err := time.Parse("15:04", req.EndTime)
	if err != nil {
		return fmt.Errorf("invalid end time format: %w", err)
	}

	for _, existing := range existingSchedules {
		if !existing.IsActive {
			continue // пропускаем неактивные расписания
		}

		existingStart, _ := time.Parse("15:04", existing.StartTime)
		existingEnd, _ := time.Parse("15:04", existing.EndTime)

		// Проверяем пересечение рабочих дней
		if s.hasWorkDayConflict(req.WorkDays, []int(existing.WorkDays)) {
			// Проверяем пересечение времени
			if s.hasTimeConflict(startTime, endTime, existingStart, existingEnd) {
				return fmt.Errorf("schedule conflicts with existing schedule '%s' on overlapping work days and times", existing.Name)
			}
		}
	}

	return nil
}

// hasWorkDayConflict проверяет есть ли пересечения в рабочих днях
func (s *appointmentService) hasWorkDayConflict(workDays1, workDays2 []int) bool {
	dayMap := make(map[int]bool)
	for _, day := range workDays1 {
		dayMap[day] = true
	}

	for _, day := range workDays2 {
		if dayMap[day] {
			return true
		}
	}

	return false
}

// hasTimeConflict проверяет пересекается ли время
func (s *appointmentService) hasTimeConflict(start1, end1, start2, end2 time.Time) bool {
	return start1.Before(end2) && end1.After(start2)
}

// deactivateOtherSchedules деактивирует все другие расписания врача (кроме указанного ID, если передан)
func (s *appointmentService) deactivateOtherSchedules(doctorID uuid.UUID, excludeIDs ...uuid.UUID) error {
	schedules, err := s.repo.GetDoctorSchedules(doctorID)
	if err != nil {
		return err
	}

	// Создаем мапу исключений для быстрого поиска
	excludeMap := make(map[uuid.UUID]bool)
	for _, id := range excludeIDs {
		excludeMap[id] = true
	}

	for _, schedule := range schedules {
		// Пропускаем расписания из списка исключений
		if excludeMap[schedule.ID] {
			continue
		}

		if schedule.IsActive {
			schedule.IsActive = false
			if err := s.repo.UpdateSchedule(schedule); err != nil {
				return fmt.Errorf("failed to deactivate schedule %s: %w", schedule.Name, err)
			}
			s.logInfo("Deactivated existing schedule", map[string]interface{}{
				"doctorID":   doctorID.String(),
				"scheduleID": schedule.ID.String(),
				"name":       schedule.Name,
			})
		}
	}

	return nil
}

func (s *appointmentService) GetDoctorSchedules(doctorID uuid.UUID) ([]*models.ScheduleResponse, error) {
	s.logInfo("Getting schedules for doctor", map[string]interface{}{
		"doctorID": doctorID.String(),
	})

	schedules, err := s.repo.GetDoctorSchedules(doctorID)
	if err != nil {
		s.logError("Failed to get schedules from repository", map[string]interface{}{
			"doctorID": doctorID.String(),
			"error":    err.Error(),
		})
		return nil, fmt.Errorf("failed to get schedules: %w", err)
	}

	responses := make([]*models.ScheduleResponse, len(schedules))
	for i, schedule := range schedules {
		responses[i] = s.scheduleToResponse(schedule)
	}

	s.logInfo("Schedules retrieved successfully", map[string]interface{}{
		"doctorID":      doctorID.String(),
		"scheduleCount": len(schedules),
	})

	return responses, nil
}

func (s *appointmentService) GenerateSlots(doctorID, scheduleID uuid.UUID, req *models.GenerateSlotsRequest) (*models.GenerateSlotsResponse, error) {
	s.logInfo("Starting slot generation", map[string]interface{}{
		"doctorID":   doctorID.String(),
		"scheduleID": scheduleID.String(),
		"startDate":  req.StartDate,
		"endDate":    req.EndDate,
	})

	schedule, err := s.repo.GetScheduleByID(scheduleID)
	if err != nil {
		s.logError("Schedule not found", map[string]interface{}{
			"doctorID":   doctorID.String(),
			"scheduleID": scheduleID.String(),
			"error":      err.Error(),
		})
		return nil, fmt.Errorf("schedule not found: %w", err)
	}

	if schedule.DoctorID != doctorID {
		s.logError("Schedule ownership validation failed", map[string]interface{}{
			"doctorID":         doctorID.String(),
			"scheduleID":       scheduleID.String(),
			"scheduleDoctorID": schedule.DoctorID.String(),
		})
		return nil, errors.New("schedule doesn't belong to this doctor")
	}

	if !schedule.IsActive {
		s.logError("Cannot generate slots for inactive schedule", map[string]interface{}{
			"doctorID":   doctorID.String(),
			"scheduleID": scheduleID.String(),
		})
		return nil, errors.New("cannot generate slots for inactive schedule")
	}

	loc, err := time.LoadLocation("Asia/Almaty")
	if err != nil {
		loc = time.FixedZone("Asia/Almaty", 5*60*60)
	}

	startDate, err := time.ParseInLocation("2006-01-02", req.StartDate, loc)
	if err != nil {
		return nil, fmt.Errorf("invalid start date: %w", err)
	}

	endDate, err := time.ParseInLocation("2006-01-02", req.EndDate, loc)
	if err != nil {
		return nil, fmt.Errorf("invalid end date: %w", err)
	}
	if err != nil {
		s.logError("Invalid end date format", map[string]interface{}{
			"doctorID": doctorID.String(),
			"endDate":  req.EndDate,
			"error":    err.Error(),
		})
		return nil, fmt.Errorf("invalid end date: %w", err)
	}

	// Получаем исключения для периода
	exceptions, _ := s.repo.GetDoctorExceptions(doctorID, startDate, endDate)
	exceptionMap := make(map[string]*models.ScheduleException)
	for _, ex := range exceptions {
		dateStr := ex.Date.Format("2006-01-02")
		exceptionMap[dateStr] = ex
	}

	s.logInfo("Retrieved exceptions for period", map[string]interface{}{
		"doctorID":       doctorID.String(),
		"exceptionCount": len(exceptions),
	})

	// Шаг 1: Собираем ВСЕ потенциальные слоты, которые нужно создать
	var allSlotsToCreate []slotToCreate

	for date := startDate; !date.After(endDate); date = date.AddDate(0, 0, 1) {
		dateStr := date.Format("2006-01-02")
		weekday := int(date.Weekday())
		if weekday == 0 {
			weekday = 7 // Воскресенье = 7
		}

		// Проверяем исключения
		if exception, exists := exceptionMap[dateStr]; exists {
			if exception.Type == "day_off" {
				s.logInfo("Skipping day off", map[string]interface{}{
					"doctorID": doctorID.String(),
					"date":     dateStr,
					"reason":   exception.Reason,
				})
				continue // Пропускаем выходной
			}
			// Для кастомных часов используем их вместо обычного расписания
			if exception.Type == "custom_hours" && exception.CustomStartTime != nil && exception.CustomEndTime != nil {
				daySlots := s.generateSlotsForDayCheck(date, *exception.CustomStartTime, *exception.CustomEndTime, nil, nil, schedule)
				allSlotsToCreate = append(allSlotsToCreate, daySlots...)
				continue
			}
		}

		// Проверяем рабочие дни
		isWorkDay := false
		for _, workDay := range schedule.WorkDays {
			if workDay == weekday {
				isWorkDay = true
				break
			}
		}

		if !isWorkDay {
			continue // Пропускаем нерабочие дни
		}

		// Получаем детальные настройки для этого дня недели
		scheduleDays, err := s.repo.GetScheduleDays(scheduleID)
		if err != nil {
			s.logError("Failed to get schedule days", map[string]interface{}{
				"scheduleID": scheduleID.String(),
				"error":      err.Error(),
			})
			// Используем общие настройки расписания как fallback
			daySlots := s.generateSlotsForDayCheck(date, schedule.StartTime, schedule.EndTime, schedule.BreakStart, schedule.BreakEnd, schedule)
			allSlotsToCreate = append(allSlotsToCreate, daySlots...)
			continue
		}

		// Ищем настройки для конкретного дня недели
		var daySettings *models.ScheduleDay
		for _, day := range scheduleDays {
			if day.DayOfWeek == weekday && day.IsWorkingDay {
				daySettings = day
				break
			}
		}

		if daySettings != nil {
			// Используем детальные настройки дня
			daySlots := s.generateSlotsForDayCheck(date, daySettings.StartTime, daySettings.EndTime, daySettings.BreakStart, daySettings.BreakEnd, schedule)
			allSlotsToCreate = append(allSlotsToCreate, daySlots...)
		} else {
			// Используем общие настройки расписания как fallback
			daySlots := s.generateSlotsForDayCheck(date, schedule.StartTime, schedule.EndTime, schedule.BreakStart, schedule.BreakEnd, schedule)
			allSlotsToCreate = append(allSlotsToCreate, daySlots...)
		}
	}

	// Шаг 2: Проверяем ВСЕ слоты на конфликты
	s.logInfo("Checking all slots for conflicts", map[string]interface{}{
		"doctorID":   doctorID.String(),
		"totalSlots": len(allSlotsToCreate),
	})

	for _, slot := range allSlotsToCreate {
		if s.slotExists(schedule.DoctorID, slot.startTime, slot.endTime) {
			s.logError("Slot conflict detected - aborting generation", map[string]interface{}{
				"doctorID":      doctorID.String(),
				"conflictStart": slot.startTime.Format("2006-01-02 15:04:05"),
				"conflictEnd":   slot.endTime.Format("2006-01-02 15:04:05"),
			})
			return nil, fmt.Errorf("cannot generate slots: slot from %s to %s already exists. Please choose a different time period or delete existing slots first",
				slot.startTime.Format("2006-01-02 15:04"), slot.endTime.Format("15:04"))
		}
	}

	// Шаг 3: Если все проверки прошли - создаем ВСЕ слоты
	s.logInfo("No conflicts found - creating all slots", map[string]interface{}{
		"doctorID":          doctorID.String(),
		"totalSlots":        len(allSlotsToCreate),
		"appointmentFormat": schedule.AppointmentFormat,
	})

	// Создаем слоты пакетами для оптимизации
	appointments := make([]*models.Appointment, 0, len(allSlotsToCreate))
	for _, slot := range allSlotsToCreate {
		// Определяем тип записи исходя из формата расписания
		appointmentType := schedule.AppointmentFormat

		appointment := &models.Appointment{
			StartTime:       slot.startTime,
			EndTime:         slot.endTime,
			DoctorID:        schedule.DoctorID,
			Title:           schedule.SlotTitle,
			Status:          "available",
			AppointmentType: appointmentType,
			ScheduleID:      &schedule.ID,
		}
		appointments = append(appointments, appointment)
	}

	// Пакетная вставка всех слотов
	if err := s.repo.CreateAppointmentsBatch(appointments); err != nil {
		s.logError("Failed to create appointment slots batch", map[string]interface{}{
			"doctorID":   schedule.DoctorID.String(),
			"totalSlots": len(appointments),
			"error":      err.Error(),
		})
		return nil, fmt.Errorf("failed to create slots: %w", err)
	}

	totalSlotsCreated := len(appointments)

	s.logInfo("Slot generation completed successfully", map[string]interface{}{
		"doctorID":          doctorID.String(),
		"scheduleID":        scheduleID.String(),
		"totalSlotsCreated": totalSlotsCreated,
	})

	message := fmt.Sprintf("Генерация завершена успешно: создано %d слотов", totalSlotsCreated)

	return &models.GenerateSlotsResponse{
		SlotsCreated: totalSlotsCreated,
		Message:      message,
	}, nil
}

// Структура для хранения информации о слоте, который нужно создать
type slotToCreate struct {
	startTime time.Time
	endTime   time.Time
}

func (s *appointmentService) generateSlotsForDayCheck(
	date time.Time,
	startTime, endTime string,
	breakStart, breakEnd *string,
	schedule *models.DoctorSchedule,
) []slotToCreate {

	// ✅ TZ клиники
	loc, err := time.LoadLocation("Asia/Almaty")
	if err != nil {
		loc = time.FixedZone("Asia/Almaty", 5*60*60)
	}

	var slots []slotToCreate

	// date приходит без TZ-значения — нормализуем в TZ клиники
	dateLocal := time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, loc)

	startLocal, err := time.ParseInLocation("2006-01-02 15:04", dateLocal.Format("2006-01-02")+" "+startTime, loc)
	if err != nil {
		s.logError("Failed to parse start time", map[string]interface{}{
			"doctorID":  schedule.DoctorID.String(),
			"date":      dateLocal.Format("2006-01-02"),
			"startTime": startTime,
			"error":     err.Error(),
		})
		return slots
	}

	endLocal, err := time.ParseInLocation("2006-01-02 15:04", dateLocal.Format("2006-01-02")+" "+endTime, loc)
	if err != nil {
		s.logError("Failed to parse end time", map[string]interface{}{
			"doctorID": schedule.DoctorID.String(),
			"date":     dateLocal.Format("2006-01-02"),
			"endTime":  endTime,
			"error":    err.Error(),
		})
		return slots
	}

	// break
	var breakStartLocal, breakEndLocal *time.Time
	if breakStart != nil && breakEnd != nil {
		bs, err1 := time.ParseInLocation("2006-01-02 15:04", dateLocal.Format("2006-01-02")+" "+*breakStart, loc)
		be, err2 := time.ParseInLocation("2006-01-02 15:04", dateLocal.Format("2006-01-02")+" "+*breakEnd, loc)
		if err1 == nil && err2 == nil {
			breakStartLocal = &bs
			breakEndLocal = &be
		}
	}

	slotDuration := time.Duration(schedule.SlotDuration) * time.Minute
	current := startLocal

	for current.Add(slotDuration).Before(endLocal) || current.Add(slotDuration).Equal(endLocal) {
		slotEnd := current.Add(slotDuration)

		// пересечение с перерывом
		if breakStartLocal != nil && breakEndLocal != nil {
			if current.Before(*breakEndLocal) && slotEnd.After(*breakStartLocal) {
				current = *breakEndLocal
				continue
			}
		}

		// ✅ В БД и дальше по сервисам храним UTC
		slots = append(slots, slotToCreate{
			startTime: current.UTC(),
			endTime:   slotEnd.UTC(),
		})

		current = slotEnd
	}

	return slots
}

// slotExists простая проверка существования слота
func (s *appointmentService) slotExists(doctorID uuid.UUID, startTime, endTime time.Time) bool {
	exists, err := s.repo.CheckSlotExists(doctorID, startTime, endTime)
	if err != nil {
		s.logError("Error checking slot existence", map[string]interface{}{
			"doctorID":  doctorID.String(),
			"startTime": startTime.Format("2006-01-02 15:04:05"),
			"endTime":   endTime.Format("2006-01-02 15:04:05"),
			"error":     err.Error(),
		})
		return true // В случае ошибки считаем что слот существует (безопасно)
	}
	return exists
}

// === APPOINTMENTS ===
func (s *appointmentService) BookAppointment(patientID, appointmentID uuid.UUID, req *models.BookAppointmentRequest) (*models.AppointmentResponse, error) {
	appointment, err := s.repo.GetAppointmentByID(appointmentID)
	if err != nil {
		return nil, fmt.Errorf("appointment not found: %w", err)
	}

	if !appointment.IsAvailable() {
		return nil, errors.New("appointment is not available")
	}

	appointmentType := req.AppointmentType
	if appointmentType == "" {
		// Если тип не указан, выбираем по умолчанию в зависимости от слота
		if appointment.AppointmentType == "both" {
			appointmentType = "offline" // По умолчанию для "both" выбираем offline
		} else {
			appointmentType = appointment.AppointmentType // Используем тип слота
		}
	}

	// Проверяем совместимость запрашиваемого типа со слотом
	if !s.isAppointmentTypeCompatible(appointment.AppointmentType, appointmentType) {
		return nil, fmt.Errorf("appointment type '%s' is not compatible with slot type '%s'", appointmentType, appointment.AppointmentType)
	}

	patientRecordID, err := s.repo.GetPatientRecordIDByUserID(patientID)
	if err != nil {
		return nil, fmt.Errorf("failed to get patient by user id: %w", err)
	}
	if patientRecordID == nil {
		return nil, errors.New("patient not found")
	}

	appointment.Book(*patientRecordID, appointmentType, req.PatientNotes)

	// Устанавливаем anketa_id если передан
	if req.AnketaID != nil {
		appointment.AnketaID = req.AnketaID
	}

	if err := s.repo.UpdateAppointment(appointment); err != nil {
		return nil, fmt.Errorf("failed to book appointment: %w", err)
	}

	// Отправляем событие о бронировании записи
	if s.messageService != nil {
		// Получаем данные пациента
		patientData, err := s.getUserData(patientID)
		if err != nil {
			s.logError("Failed to get patient data", map[string]interface{}{
				"patientID": patientID.String(),
				"error":     err.Error(),
			})
			// Используем базовую информацию из записи
			patientData = &UserData{
				Phone: "77071234567",
			}
		}

		// Получаем данные врача
		doctorData, err := s.getDoctorData(appointment.DoctorID)
		if err != nil {
			s.logError("Failed to get doctor data", map[string]interface{}{
				"doctorID": appointment.DoctorID.String(),
				"error":    err.Error(),
			})
			// Используем базовую информацию
			doctorData = &DoctorData{
				Phone: "77071234568",
			}
		}

		// Формируем имя врача
		doctorName := ""
		if doctorData.FirstName != "" {
			doctorName = doctorData.FirstName
		}
		if doctorData.MiddleName != "" {
			doctorName += " " + doctorData.MiddleName
		}
		if doctorData.LastName != "" {
			doctorName += " " + doctorData.LastName
		}
		if doctorName == "" {
			doctorName = "Врач"
		}

		// Формируем имя пациента (пока без данных профиля)
		patientName := "Пациент"

		event := &models.AppointmentBookedEvent{
			Type:            "appointment_booked",
			AppointmentID:   appointment.ID,
			PatientID:       patientID,
			DoctorID:        appointment.DoctorID,
			PatientPhone:    patientData.Phone,
			DoctorPhone:     doctorData.Phone,
			PatientName:     patientName,
			DoctorName:      doctorName,
			StartTime:       appointment.StartTime,
			EndTime:         appointment.EndTime,
			AppointmentType: appointment.AppointmentType,
			PatientNotes:    appointment.PatientNotes,
		}

		if err := s.messageService.PublishAppointmentBooked(context.Background(), event); err != nil {
			s.logError("Failed to publish appointment booked event", map[string]interface{}{
				"appointmentID": appointmentID.String(),
				"error":         err.Error(),
			})
			// Не возвращаем ошибку, так как основная операция прошла успешно
		} else {
			s.logInfo("Appointment booked event published successfully", map[string]interface{}{
				"appointmentID": appointmentID.String(),
				"patientID":     patientID.String(),
				"doctorID":      appointment.DoctorID.String(),
			})
		}
	}

	return s.appointmentToResponse(appointment), nil
}

// isAppointmentTypeCompatible проверяет совместимость типа записи со слотом
func (s *appointmentService) isAppointmentTypeCompatible(slotType, requestedType string) bool {
	// Если слот "both", то можно забронировать любой тип
	if slotType == "both" {
		return requestedType == "offline" || requestedType == "online"
	}

	// Для остальных случаев типы должны совпадать
	return slotType == requestedType
}

func (s *appointmentService) CancelAppointment(patientID, appointmentID uuid.UUID) error {
	appointment, err := s.repo.GetAppointmentByID(appointmentID)
	if err != nil {
		return fmt.Errorf("appointment not found: %w", err)
	}

	patientRecordID, err := s.repo.GetPatientRecordIDByUserID(patientID)
	if err != nil {
		return fmt.Errorf("failed to get patient by user id: %w", err)
	}
	if patientRecordID == nil {
		return errors.New("patient not found")
	}

	// Проверяем что запись принадлежит этому пациенту
	if appointment.PatientID == nil || *appointment.PatientID != *patientRecordID {
		return errors.New("appointment doesn't belong to this patient or is not booked")
	}

	// Проверяем что запись можно отменить (не уже отменена и не завершена)

	// Проверяем время отмены - за 12 часов до приема нельзя отменить
	now := time.Now()
	appointmentTime := appointment.StartTime
	timeUntilAppointment := appointmentTime.Sub(now)

	if timeUntilAppointment <= 12*time.Hour {
		return errors.New("cannot cancel appointment less than 12 hours before start time")
	}

	appointment.Cancel()

	if err := s.repo.UpdateAppointment(appointment); err != nil {
		return fmt.Errorf("failed to cancel appointment: %w", err)
	}

	// Отправляем событие об отмене записи
	if s.messageService != nil {
		// Получаем данные пациента
		patientData, err := s.getUserData(patientID)
		if err != nil {
			s.logError("Failed to get patient data", map[string]interface{}{
				"patientID": patientID.String(),
				"error":     err.Error(),
			})
			// Используем базовую информацию из записи
			patientData = &UserData{
				Phone: "77071234567",
			}
		}

		// Получаем данные врача
		doctorData, err := s.getDoctorData(appointment.DoctorID)
		if err != nil {
			s.logError("Failed to get doctor data", map[string]interface{}{
				"doctorID": appointment.DoctorID.String(),
				"error":    err.Error(),
			})
			// Используем базовую информацию
			doctorData = &DoctorData{
				Phone: "77071234568",
			}
		}

		// Формируем имя врача
		doctorName := ""
		if doctorData.FirstName != "" {
			doctorName = doctorData.FirstName
		}
		if doctorData.MiddleName != "" {
			doctorName += " " + doctorData.MiddleName
		}
		if doctorData.LastName != "" {
			doctorName += " " + doctorData.LastName
		}
		if doctorName == "" {
			doctorName = "Врач"
		}

		// Формируем имя пациента (пока без данных профиля)
		patientName := "Пациент"

		event := &models.AppointmentCanceledEvent{
			Type:            "appointment_canceled",
			AppointmentID:   appointment.ID,
			PatientID:       patientID,
			DoctorID:        appointment.DoctorID,
			PatientPhone:    patientData.Phone,
			DoctorPhone:     doctorData.Phone,
			PatientName:     patientName,
			DoctorName:      doctorName,
			StartTime:       appointment.StartTime,
			EndTime:         appointment.EndTime,
			AppointmentType: appointment.AppointmentType,
		}

		if err := s.messageService.PublishAppointmentCanceled(context.Background(), event); err != nil {
			s.logError("Failed to publish appointment canceled event", map[string]interface{}{
				"appointmentID": appointmentID.String(),
				"error":         err.Error(),
			})
		} else {
			s.logInfo("Appointment canceled event published successfully", map[string]interface{}{
				"appointmentID": appointmentID.String(),
				"patientID":     patientID.String(),
				"doctorID":      appointment.DoctorID.String(),
			})
		}
	}

	return nil
}

func (s *appointmentService) CancelAppointmentByDoctor(doctorID, appointmentID uuid.UUID) error {
	appointment, err := s.repo.GetAppointmentByID(appointmentID)
	if err != nil {
		return fmt.Errorf("appointment not found: %w", err)
	}

	var patientIDForEvent *uuid.UUID
	if appointment.PatientID != nil {
		patientIDCopy := *appointment.PatientID
		patientIDForEvent = &patientIDCopy
	}

	appointment.Cancel()
	appointment.Status = "available"

	if err := s.repo.UpdateAppointment(appointment); err != nil {
		return fmt.Errorf("failed to cancel appointment: %w", err)
	}

	if s.messageService != nil && patientIDForEvent != nil {
		patientData, err := s.getUserData(*patientIDForEvent)
		if err != nil {
			s.logError("Failed to get patient data", map[string]interface{}{
				"patientID": patientIDForEvent.String(),
				"error":     err.Error(),
			})
			patientData = &UserData{Phone: "77071234567"}
		}

		doctorData, err := s.getDoctorData(appointment.DoctorID)
		if err != nil {
			s.logError("Failed to get doctor data", map[string]interface{}{
				"doctorID": appointment.DoctorID.String(),
				"error":    err.Error(),
			})
			doctorData = &DoctorData{Phone: "77071234568"}
		}

		doctorName := ""
		if doctorData.FirstName != "" {
			doctorName = doctorData.FirstName
		}
		if doctorData.MiddleName != "" {
			doctorName += " " + doctorData.MiddleName
		}
		if doctorData.LastName != "" {
			doctorName += " " + doctorData.LastName
		}
		if doctorName == "" {
			doctorName = "Врач"
		}

		event := &models.AppointmentCanceledEvent{
			Type:            "appointment_canceled",
			AppointmentID:   appointment.ID,
			PatientID:       *patientIDForEvent,
			DoctorID:        appointment.DoctorID,
			PatientPhone:    patientData.Phone,
			DoctorPhone:     doctorData.Phone,
			PatientName:     "Пациент",
			DoctorName:      doctorName,
			StartTime:       appointment.StartTime,
			EndTime:         appointment.EndTime,
			AppointmentType: appointment.AppointmentType,
			CancelReason:    "Отменено врачом",
		}

		if err := s.messageService.PublishAppointmentCanceled(context.Background(), event); err != nil {
			s.logError("Failed to publish appointment canceled event", map[string]interface{}{
				"appointmentID": appointmentID.String(),
				"error":         err.Error(),
			})
		}
	}

	return nil
}
func (s *appointmentService) UpdateAppointment(doctorID, appointmentID uuid.UUID, req *models.UpdateAppointmentRequest) (*models.AppointmentResponse, error) {
	appointment, err := s.repo.GetAppointmentByID(appointmentID)
	if err != nil {
		return nil, fmt.Errorf("appointment not found: %w", err)
	}

	if appointment.DoctorID != doctorID {
		return nil, errors.New("appointment doesn't belong to this doctor")
	}

	// Обновляем только переданные поля
	if req.DoctorNotes != "" {
		appointment.DoctorNotes = req.DoctorNotes
	}
	if req.HealthPassportID != nil {
		appointment.HealthPassportID = req.HealthPassportID
	}

	appointment.UpdatedAt = time.Now()

	if err := s.repo.UpdateAppointment(appointment); err != nil {
		return nil, fmt.Errorf("failed to update appointment: %w", err)
	}

	return s.appointmentToResponse(appointment), nil
}

func (s *appointmentService) GetDoctorAppointments(doctorID uuid.UUID) ([]*models.AppointmentResponse, error) {
	appointments, err := s.repo.GetDoctorAppointments(doctorID)
	if err != nil {
		return nil, fmt.Errorf("failed to get doctor appointments: %w", err)
	}

	responses := make([]*models.AppointmentResponse, len(appointments))
	for i, appointment := range appointments {
		responses[i] = s.appointmentToResponse(appointment)
	}

	return responses, nil
}

func (s *appointmentService) GetPatientAppointments(patientID uuid.UUID) ([]*models.AppointmentResponse, error) {
	appointments, err := s.repo.GetPatientAppointments(patientID)
	if err != nil {
		return nil, fmt.Errorf("failed to get patient appointments: %w", err)
	}

	responses := make([]*models.AppointmentResponse, len(appointments))
	for i, appointment := range appointments {
		responses[i] = s.appointmentToResponse(appointment)
	}

	return responses, nil
}

// === EXCEPTIONS ===

func (s *appointmentService) AddException(doctorID uuid.UUID, req *models.AddExceptionRequest) (*models.ExceptionResponse, error) {
	date, err := time.Parse("2006-01-02", req.Date)
	if err != nil {
		return nil, fmt.Errorf("invalid date format: %w", err)
	}

	// Normalize type alias
	typeVal := req.Type
	if typeVal == "closed_hours" {
		typeVal = "custom_hours"
	}

	var customStart *string
	if req.CustomStartTime != "" {
		customStart = &req.CustomStartTime
	}

	var customEnd *string
	if req.CustomEndTime != "" {
		customEnd = &req.CustomEndTime
	}

	exception := &models.ScheduleException{
		DoctorID:        doctorID,
		Date:            date,
		Type:            typeVal,
		CustomStartTime: customStart,
		CustomEndTime:   customEnd,
		Reason:          req.Reason,
	}

	if err := s.repo.CreateException(exception); err != nil {
		return nil, fmt.Errorf("failed to create exception: %w", err)
	}

	// Cancel overlapping future appointments and available slots
	appointments, err := s.repo.GetDoctorAppointments(doctorID)
	if err == nil {
		now := time.Now()
		for _, ap := range appointments {
			if !ap.StartTime.After(now) {
				continue
			}
			if overlapsException(ap, exception) && ap.Status != "canceled" {
				wasBooked := ap.Status == "booked" && ap.PatientID != nil
				ap.Cancel()
				_ = s.repo.UpdateAppointment(ap)
				// Publish cancel event only for booked appointments
				if wasBooked && s.messageService != nil {
					// Fetch identities (best-effort)
					patientData, _ := s.getUserData(*ap.PatientID)
					doctorData, _ := s.getDoctorData(ap.DoctorID)
					if patientData == nil {
						patientData = &UserData{Phone: "77071234567"}
					}
					if doctorData == nil {
						doctorData = &DoctorData{Phone: "77071234568"}
					}
					doctorName := "Врач"
					if doctorData.FirstName != "" {
						doctorName = doctorData.FirstName
					}
					if doctorData.MiddleName != "" {
						doctorName += " " + doctorData.MiddleName
					}
					if doctorData.LastName != "" {
						doctorName += " " + doctorData.LastName
					}
					cancelReason := "Закрыто расписание"
					if req.Reason != "" {
						cancelReason += ": " + req.Reason
					}
					event := &models.AppointmentCanceledEvent{
						Type:            "appointment_canceled",
						AppointmentID:   ap.ID,
						PatientID:       *ap.PatientID,
						DoctorID:        ap.DoctorID,
						PatientPhone:    patientData.Phone,
						DoctorPhone:     doctorData.Phone,
						PatientName:     "Пациент",
						DoctorName:      doctorName,
						StartTime:       ap.StartTime,
						EndTime:         ap.EndTime,
						AppointmentType: ap.AppointmentType,
						CancelReason:    cancelReason,
					}
					_ = s.messageService.PublishAppointmentCanceled(context.Background(), event)
				}
			}
		}
	}

	return s.exceptionToResponse(exception), nil
}

func overlapsException(ap *models.Appointment, ex *models.ScheduleException) bool {
	apDate := ap.StartTime.Format("2006-01-02")
	if apDate != ex.Date.Format("2006-01-02") {
		return false
	}
	if ex.Type == "day_off" {
		return true
	}
	if ex.CustomStartTime == nil || ex.CustomEndTime == nil {
		return false
	}
	startStr := ap.StartTime.Format("15:04")
	endStr := ap.EndTime.Format("15:04")
	return !(endStr <= *ex.CustomStartTime || startStr >= *ex.CustomEndTime)
}

func (s *appointmentService) DeleteException(doctorID uuid.UUID, exceptionID uuid.UUID) error {
	// Получаем исключение перед удалением
	exception, err := s.repo.GetExceptionByID(exceptionID)
	if err != nil {
		return fmt.Errorf("failed to get exception: %w", err)
	}

	if exception == nil {
		return fmt.Errorf("exception not found")
	}

	// Проверяем что исключение принадлежит этому врачу
	if exception.DoctorID != doctorID {
		return fmt.Errorf("exception doesn't belong to this doctor")
	}

	// Удаляем исключение
	if err := s.repo.DeleteException(exceptionID); err != nil {
		return fmt.Errorf("failed to delete exception: %w", err)
	}

	// Восстанавливаем отмененные записи в статус available
	appointments, err := s.repo.GetDoctorAppointments(doctorID)
	if err == nil {
		now := time.Now()
		for _, ap := range appointments {
			if !ap.StartTime.After(now) {
				continue // пропускаем прошедшие записи
			}

			// Проверяем что запись была отменена из-за этого исключения
			if ap.Status == "canceled" && overlapsException(ap, exception) {
				// Восстанавливаем в статус available только если нет пациента
				if ap.PatientID == nil {
					ap.Status = "available"
					ap.UpdatedAt = time.Now()
					_ = s.repo.UpdateAppointment(ap)

					s.logInfo("Restored appointment to available status", map[string]interface{}{
						"appointmentID": ap.ID.String(),
						"startTime":     ap.StartTime,
						"exceptionID":   exceptionID,
					})
				}
			}
		}
	}

	return nil
}

func (s *appointmentService) GetDoctorExceptions(doctorID uuid.UUID, startDate, endDate string) ([]*models.ExceptionResponse, error) {
	start, err := time.Parse("2006-01-02", startDate)
	if err != nil {
		return nil, fmt.Errorf("invalid start date: %w", err)
	}

	end, err := time.Parse("2006-01-02", endDate)
	if err != nil {
		return nil, fmt.Errorf("invalid end date: %w", err)
	}

	exceptions, err := s.repo.GetDoctorExceptions(doctorID, start, end)
	if err != nil {
		return nil, fmt.Errorf("failed to get exceptions: %w", err)
	}

	responses := make([]*models.ExceptionResponse, len(exceptions))
	for i, exception := range exceptions {
		responses[i] = s.exceptionToResponse(exception)
	}

	return responses, nil
}

// === HELPER METHODS ===
func (s *appointmentService) scheduleToResponse(schedule *models.DoctorSchedule) *models.ScheduleResponse {
	scheduleDays, err := s.repo.GetScheduleDays(schedule.ID)

	// ✅ Источник правды: work_days из doctor_schedules
	workDays := schedule.WorkDays
	if workDays == nil {
		workDays = []int{}
	}

	// Мапа для быстрого contains
	wdSet := map[int]bool{}
	for _, d := range workDays {
		wdSet[d] = true
	}

	if err != nil {
		// если не смогли достать days — возвращаем хотя бы корректный work_days
		return &models.ScheduleResponse{
			ID:                schedule.ID,
			DoctorID:          schedule.DoctorID,
			Name:              schedule.Name,
			WorkDays:          workDays, // ✅
			StartTime:         schedule.StartTime,
			EndTime:           schedule.EndTime,
			BreakStart:        schedule.BreakStart,
			BreakEnd:          schedule.BreakEnd,
			SlotDuration:      schedule.SlotDuration,
			SlotTitle:         schedule.SlotTitle,
			AppointmentFormat: schedule.AppointmentFormat,
			IsActive:          schedule.IsActive,
			CreatedAt:         schedule.CreatedAt,
			UpdatedAt:         schedule.UpdatedAt,
		}
	}

	// ✅ конвертим дни, но is_working_day пересчитываем по work_days
	days := make([]models.ScheduleDayRequest, len(scheduleDays))
	for i, day := range scheduleDays {
		days[i] = models.ScheduleDayRequest{
			DayOfWeek:    day.DayOfWeek,
			StartTime:    day.StartTime,
			EndTime:      day.EndTime,
			BreakStart:   day.BreakStart,
			BreakEnd:     day.BreakEnd,
			IsWorkingDay: wdSet[day.DayOfWeek], // ✅ ВАЖНО
		}
	}

	return &models.ScheduleResponse{
		ID:                schedule.ID,
		DoctorID:          schedule.DoctorID,
		Name:              schedule.Name,
		WorkDays:          workDays, // ✅ ВАЖНО: отдаём реальный work_days
		StartTime:         schedule.StartTime,
		EndTime:           schedule.EndTime,
		BreakStart:        schedule.BreakStart,
		BreakEnd:          schedule.BreakEnd,
		SlotDuration:      schedule.SlotDuration,
		SlotTitle:         schedule.SlotTitle,
		AppointmentFormat: schedule.AppointmentFormat,
		IsActive:          schedule.IsActive,
		Days:              days,
		CreatedAt:         schedule.CreatedAt,
		UpdatedAt:         schedule.UpdatedAt,
	}
}

// scheduleToResponseWithDates - расширенная версия с датами генерации слотов
func (s *appointmentService) scheduleToResponseWithDates(schedule *models.DoctorSchedule, slotsStartDate, slotsEndDate string) *models.ScheduleResponse {
	scheduleDays, err := s.repo.GetScheduleDays(schedule.ID)
	if err != nil {
		workDays := schedule.WorkDays
		if workDays == nil {
			workDays = []int{}
		}

		return &models.ScheduleResponse{
			ID:                schedule.ID,
			DoctorID:          schedule.DoctorID,
			Name:              schedule.Name,
			WorkDays:          workDays,
			StartTime:         schedule.StartTime,
			EndTime:           schedule.EndTime,
			BreakStart:        schedule.BreakStart,
			BreakEnd:          schedule.BreakEnd,
			SlotDuration:      schedule.SlotDuration,
			SlotTitle:         schedule.SlotTitle,
			AppointmentFormat: schedule.AppointmentFormat,
			IsActive:          schedule.IsActive,
			SlotsStartDate:    slotsStartDate,
			SlotsEndDate:      slotsEndDate,
			CreatedAt:         schedule.CreatedAt,
			UpdatedAt:         schedule.UpdatedAt,
		}
	}

	days := make([]models.ScheduleDayRequest, len(scheduleDays))
	wd := make([]int, 0, len(scheduleDays))

	for i, day := range scheduleDays {
		days[i] = models.ScheduleDayRequest{
			DayOfWeek:    day.DayOfWeek,
			StartTime:    day.StartTime,
			EndTime:      day.EndTime,
			BreakStart:   day.BreakStart,
			BreakEnd:     day.BreakEnd,
			IsWorkingDay: day.IsWorkingDay,
		}
		if day.IsWorkingDay {
			wd = append(wd, day.DayOfWeek)
		}
	}

	if wd == nil {
		wd = []int{}
	}

	return &models.ScheduleResponse{
		ID:                schedule.ID,
		DoctorID:          schedule.DoctorID,
		Name:              schedule.Name,
		WorkDays:          wd, // ✅ из days
		StartTime:         schedule.StartTime,
		EndTime:           schedule.EndTime,
		BreakStart:        schedule.BreakStart,
		BreakEnd:          schedule.BreakEnd,
		SlotDuration:      schedule.SlotDuration,
		SlotTitle:         schedule.SlotTitle,
		AppointmentFormat: schedule.AppointmentFormat,
		IsActive:          schedule.IsActive,
		Days:              days,
		SlotsStartDate:    slotsStartDate,
		SlotsEndDate:      slotsEndDate,
		CreatedAt:         schedule.CreatedAt,
		UpdatedAt:         schedule.UpdatedAt,
	}
}

// scheduleToResponseWithDates - расширенная версия с датами генерации слотов

func (s *appointmentService) appointmentToResponse(appointment *models.Appointment) *models.AppointmentResponse {
	// ВАЖНО: appointment.DoctorID содержит user_id врача, а не doctor_id из таблицы doctors
	// Поэтому мы можем использовать его напрямую как doctor_user_id
	// Но для проверки и получения дополнительных данных делаем запрос к specialist_service
	var doctorUserID *uuid.UUID

	// appointment.DoctorID уже является user_id, используем его напрямую
	doctorUserID = &appointment.DoctorID

	// Опционально: проверяем, что врач существует через запрос к specialist_service
	// Используем эндпоинт /api/users/{user_id}/doctor вместо /api/doctors/{doctor_id}
	doctorData, err := s.getDoctorByUserID(appointment.DoctorID)
	if err != nil {
		s.logError("Failed to verify doctor by user_id from specialist_service", map[string]interface{}{
			"userID": appointment.DoctorID.String(),
			"error":  err.Error(),
		})
		// Не возвращаем ошибку, просто используем appointment.DoctorID как doctor_user_id
	} else if doctorData != nil {
		s.logInfo("Doctor verified successfully from specialist_service", map[string]interface{}{
			"userID":   appointment.DoctorID.String(),
			"doctorID": doctorData.ID.String(),
		})
	}

	return &models.AppointmentResponse{
		ID:               appointment.ID,
		StartTime:        appointment.StartTime,
		EndTime:          appointment.EndTime,
		DoctorID:         appointment.DoctorID,
		DoctorUserID:     doctorUserID,
		PatientID:        appointment.PatientID,
		Title:            appointment.Title,
		Status:           appointment.Status,
		AppointmentType:  appointment.AppointmentType,
		MeetingLink:      appointment.MeetingLink,
		MeetingID:        appointment.MeetingID,
		PatientNotes:     appointment.PatientNotes,
		DoctorNotes:      appointment.DoctorNotes,
		AnketaID:         appointment.AnketaID,
		HealthPassportID: appointment.HealthPassportID,
		CreatedAt:        appointment.CreatedAt,
		UpdatedAt:        appointment.UpdatedAt,
	}
}

func (s *appointmentService) exceptionToResponse(exception *models.ScheduleException) *models.ExceptionResponse {
	return &models.ExceptionResponse{
		ID:              exception.ID,
		DoctorID:        exception.DoctorID,
		Date:            exception.Date,
		Type:            exception.Type,
		CustomStartTime: exception.CustomStartTime,
		CustomEndTime:   exception.CustomEndTime,
		Reason:          exception.Reason,
		CreatedAt:       exception.CreatedAt,
	}
}

func (s *appointmentService) UpdateSchedule(doctorID, scheduleID uuid.UUID, req *models.UpdateScheduleRequest) (*models.ScheduleResponse, error) {
	schedule, err := s.repo.GetScheduleByID(scheduleID)
	if err != nil {
		return nil, fmt.Errorf("schedule not found: %w", err)
	}

	if schedule.DoctorID != doctorID {
		return nil, errors.New("schedule doesn't belong to this doctor")
	}

	s.logInfo("Starting schedule update", map[string]interface{}{
		"doctorID":     doctorID.String(),
		"scheduleID":   scheduleID.String(),
		"scheduleName": schedule.Name,
		"isActive":     schedule.IsActive,
	})

	// Обновляем только переданные поля
	if req.Name != nil {
		schedule.Name = *req.Name
	}
	if req.WorkDays != nil {
		schedule.WorkDays = *req.WorkDays
	}
	if req.StartTime != nil {
		schedule.StartTime = *req.StartTime
	}
	if req.EndTime != nil {
		schedule.EndTime = *req.EndTime
	}
	if req.BreakStart != nil {
		schedule.BreakStart = req.BreakStart
	}
	if req.BreakEnd != nil {
		schedule.BreakEnd = req.BreakEnd
	}
	if req.SlotDuration != nil {
		schedule.SlotDuration = 15
	}
	if req.SlotTitle != nil {
		schedule.SlotTitle = *req.SlotTitle
	}
	if req.AppointmentFormat != nil {
		schedule.AppointmentFormat = *req.AppointmentFormat
	}

	// Обрабатываем детальные настройки дней
	if req.Days != nil {
		s.logInfo("Updating detailed schedule days", map[string]interface{}{
			"doctorID":   doctorID.String(),
			"scheduleID": scheduleID.String(),
			"daysCount":  len(*req.Days),
		})

		// Удаляем старые детальные настройки
		if err := s.repo.DeleteScheduleDays(scheduleID); err != nil {
			s.logError("Failed to delete old schedule days", map[string]interface{}{
				"doctorID":   doctorID.String(),
				"scheduleID": scheduleID.String(),
				"error":      err.Error(),
			})
			return nil, fmt.Errorf("failed to delete old schedule days: %w", err)
		}

		// Создаем новые детальные настройки
		for _, dayReq := range *req.Days {
			scheduleDay := &models.ScheduleDay{
				ScheduleID:   scheduleID,
				DayOfWeek:    dayReq.DayOfWeek,
				StartTime:    dayReq.StartTime,
				EndTime:      dayReq.EndTime,
				BreakStart:   dayReq.BreakStart,
				BreakEnd:     dayReq.BreakEnd,
				IsWorkingDay: dayReq.IsWorkingDay,
			}

			if err := s.repo.CreateScheduleDay(scheduleDay); err != nil {
				s.logError("Failed to create schedule day", map[string]interface{}{
					"doctorID":   doctorID.String(),
					"scheduleID": scheduleID.String(),
					"dayOfWeek":  dayReq.DayOfWeek,
					"error":      err.Error(),
				})
				return nil, fmt.Errorf("failed to create schedule day: %w", err)
			}
		}

		// Обновляем общие поля расписания на основе детальных настроек
		workDays := make([]int, 0, len(*req.Days))
		for _, day := range *req.Days {
			if day.IsWorkingDay {
				workDays = append(workDays, day.DayOfWeek)
			}
		}
		schedule.WorkDays = workDays

		// Для обратной совместимости используем время первого рабочего дня
		if len(workDays) > 0 {
			firstDay := (*req.Days)[workDays[0]-1] // -1 потому что индексы с 0
			schedule.StartTime = firstDay.StartTime
			schedule.EndTime = firstDay.EndTime
			schedule.BreakStart = firstDay.BreakStart
			schedule.BreakEnd = firstDay.BreakEnd
		}

		s.logInfo("Detailed schedule days updated successfully", map[string]interface{}{
			"doctorID":   doctorID.String(),
			"scheduleID": scheduleID.String(),
			"workDays":   workDays,
		})
	}

	// Сохраняем обновленное расписание
	if err := s.repo.UpdateSchedule(schedule); err != nil {
		return nil, fmt.Errorf("failed to update schedule: %w", err)
	}

	s.logInfo("Schedule updated successfully", map[string]interface{}{
		"doctorID":   doctorID.String(),
		"scheduleID": scheduleID.String(),
		"isActive":   schedule.IsActive,
	})

	// ГАРАНТИРОВАННОЕ ПЕРЕСОЗДАНИЕ СЛОТОВ для активного расписания
	if schedule.IsActive {
		s.logInfo("Schedule is active - regenerating all slots", map[string]interface{}{
			"doctorID":   doctorID.String(),
			"scheduleID": scheduleID.String(),
		})

		// Удаляем ВСЕ существующие слоты расписания
		if err := s.repo.DeleteScheduleSlots(scheduleID); err != nil {
			s.logError("Failed to delete existing slots for regeneration", map[string]interface{}{
				"doctorID":   doctorID.String(),
				"scheduleID": scheduleID.String(),
				"error":      err.Error(),
			})
			return nil, fmt.Errorf("failed to delete existing slots: %w", err)
		}

		s.logInfo("Existing slots deleted, regenerating new slots", map[string]interface{}{
			"doctorID":   doctorID.String(),
			"scheduleID": scheduleID.String(),
		})

		// Определяем период для генерации
		startDate := ""
		endDate := ""

		// Используем переданные даты если они есть
		if req.SlotsStartDate != nil && req.SlotsEndDate != nil {
			startDate = *req.SlotsStartDate
			endDate = *req.SlotsEndDate
			s.logInfo("Using provided dates for slot generation", map[string]interface{}{
				"doctorID":   doctorID.String(),
				"scheduleID": scheduleID.String(),
				"startDate":  startDate,
				"endDate":    endDate,
			})
		} else {
			// Если даты не указаны - генерируем слоты на 1 год вперед
			now := time.Now()
			startDate = now.Format("2006-01-02")
			endDate = time.Date(now.Year()+1, now.Month(), now.Day(), 0, 0, 0, 0, now.Location()).Format("2006-01-02")
			s.logInfo("Using default dates (1 year forward) for slot generation", map[string]interface{}{
				"doctorID":   doctorID.String(),
				"scheduleID": scheduleID.String(),
				"startDate":  startDate,
				"endDate":    endDate,
			})
		}

		generateReq := &models.GenerateSlotsRequest{
			StartDate: startDate,
			EndDate:   endDate,
		}

		slotsResponse, err := s.GenerateSlots(doctorID, scheduleID, generateReq)
		if err != nil {
			s.logError("Failed to regenerate slots after schedule update", map[string]interface{}{
				"doctorID":   doctorID.String(),
				"scheduleID": scheduleID.String(),
				"error":      err.Error(),
			})
			// Возвращаем ошибку, но расписание уже обновлено
			return nil, fmt.Errorf("schedule updated but failed to regenerate slots: %w", err)
		}

		s.logInfo("Slots regenerated successfully after schedule update", map[string]interface{}{
			"doctorID":     doctorID.String(),
			"scheduleID":   scheduleID.String(),
			"slotsCreated": slotsResponse.SlotsCreated,
		})

		// Возвращаем ответ с датами генерации слотов
		return s.scheduleToResponseWithDates(schedule, startDate, endDate), nil
	}

	// Для неактивного расписания просто возвращаем обновленное расписание
	return s.scheduleToResponse(schedule), nil
}

func (s *appointmentService) DeleteSchedule(doctorID, scheduleID uuid.UUID) error {
	schedule, err := s.repo.GetScheduleByID(scheduleID)
	if err != nil {
		return fmt.Errorf("schedule not found: %w", err)
	}

	if schedule.DoctorID != doctorID {
		return errors.New("schedule doesn't belong to this doctor")
	}

	s.logInfo("Starting schedule deletion", map[string]interface{}{
		"doctorID":   doctorID.String(),
		"scheduleID": scheduleID.String(),
		"name":       schedule.Name,
	})

	if err := s.repo.DeleteSchedule(scheduleID); err != nil {
		s.logError("Failed to delete schedule", map[string]interface{}{
			"doctorID":   doctorID.String(),
			"scheduleID": scheduleID.String(),
			"error":      err.Error(),
		})
		return fmt.Errorf("failed to delete schedule: %w", err)
	}

	s.logInfo("Schedule and available slots deleted successfully", map[string]interface{}{
		"doctorID":   doctorID.String(),
		"scheduleID": scheduleID.String(),
		"note":       "Booked appointments are preserved for history",
	})

	return nil
}

func (s *appointmentService) ToggleSchedule(doctorID, scheduleID uuid.UUID, req *models.ToggleScheduleRequest, hasRequestBody bool) (*models.ScheduleResponse, error) {
	schedule, err := s.repo.GetScheduleByID(scheduleID)
	if err != nil {
		return nil, fmt.Errorf("schedule not found: %w", err)
	}

	if schedule.DoctorID != doctorID {
		return nil, errors.New("schedule doesn't belong to this doctor")
	}

	// Определяем желаемое состояние
	var targetIsActive bool
	var actionType string

	if hasRequestBody {
		// Если есть тело запроса - используем переданное значение
		targetIsActive = req.IsActive
		if req.IsActive && !schedule.IsActive {
			actionType = "ACTIVATING_BY_REQUEST"
		} else if !req.IsActive && schedule.IsActive {
			actionType = "DEACTIVATING_BY_REQUEST"
		} else if req.IsActive && schedule.IsActive {
			actionType = "ALREADY_ACTIVE_BY_REQUEST"
		} else {
			actionType = "ALREADY_INACTIVE_BY_REQUEST"
		}
	} else {
		// Если нет тела запроса - переключаем на противоположное
		targetIsActive = !schedule.IsActive
		if targetIsActive {
			actionType = "AUTO_ACTIVATING"
		} else {
			actionType = "AUTO_DEACTIVATING"
		}
	}

	// Детальное логирование для отладки
	s.logInfo("ToggleSchedule request received", map[string]interface{}{
		"doctorID":          doctorID.String(),
		"scheduleID":        scheduleID.String(),
		"scheduleName":      schedule.Name,
		"currentIsActive":   schedule.IsActive,
		"hasRequestBody":    hasRequestBody,
		"requestedIsActive": req.IsActive,
		"targetIsActive":    targetIsActive,
		"actionType":        actionType,
	})

	// Если активируем расписание - деактивируем все остальные
	if targetIsActive && !schedule.IsActive {
		s.logInfo("Activating schedule - deactivating all other schedules", map[string]interface{}{
			"doctorID":   doctorID.String(),
			"scheduleID": scheduleID.String(),
			"name":       schedule.Name,
		})

		// Деактивируем все другие активные расписания
		if err := s.deactivateOtherSchedules(doctorID, scheduleID); err != nil {
			s.logError("Failed to deactivate other schedules", map[string]interface{}{
				"doctorID":   doctorID.String(),
				"scheduleID": scheduleID.String(),
				"error":      err.Error(),
			})
			return nil, fmt.Errorf("failed to deactivate other schedules: %w", err)
		}
	}

	schedule.IsActive = targetIsActive

	if err := s.repo.UpdateSchedule(schedule); err != nil {
		return nil, fmt.Errorf("failed to toggle schedule: %w", err)
	}

	s.logInfo("Schedule toggled successfully", map[string]interface{}{
		"doctorID":      doctorID.String(),
		"scheduleID":    scheduleID.String(),
		"finalIsActive": schedule.IsActive,
		"operation": func() string {
			if schedule.IsActive {
				return "ACTIVATED"
			} else {
				return "DEACTIVATED"
			}
		}(),
	})

	return s.scheduleToResponse(schedule), nil
}

// checkScheduleConflictsForExisting проверяет конфликты для существующего расписания
func (s *appointmentService) checkScheduleConflictsForExisting(doctorID uuid.UUID, schedule *models.DoctorSchedule) error {
	existingSchedules, err := s.repo.GetDoctorSchedules(doctorID)
	if err != nil {
		return fmt.Errorf("failed to get existing schedules: %w", err)
	}

	startTime, err := time.Parse("15:04", schedule.StartTime)
	if err != nil {
		return fmt.Errorf("invalid start time format: %w", err)
	}

	endTime, err := time.Parse("15:04", schedule.EndTime)
	if err != nil {
		return fmt.Errorf("invalid end time format: %w", err)
	}

	for _, existing := range existingSchedules {
		// Пропускаем само расписание и неактивные расписания
		if existing.ID == schedule.ID || !existing.IsActive {
			continue
		}

		existingStart, _ := time.Parse("15:04", existing.StartTime)
		existingEnd, _ := time.Parse("15:04", existing.EndTime)

		// Проверяем пересечение рабочих дней
		if s.hasWorkDayConflict([]int(schedule.WorkDays), []int(existing.WorkDays)) {
			// Проверяем пересечение времени
			if s.hasTimeConflict(startTime, endTime, existingStart, existingEnd) {
				return fmt.Errorf("schedule conflicts with active schedule '%s' on overlapping work days and times", existing.Name)
			}
		}
	}

	return nil
}

// New method for forcing clean slots of schedule
func (s *appointmentService) DeleteScheduleSlots(doctorID, scheduleID uuid.UUID) error {
	schedule, err := s.repo.GetScheduleByID(scheduleID)
	if err != nil {
		return fmt.Errorf("schedule not found: %w", err)
	}

	if schedule.DoctorID != doctorID {
		return errors.New("schedule doesn't belong to this doctor")
	}

	if err := s.repo.DeleteScheduleSlots(scheduleID); err != nil {
		return fmt.Errorf("failed to delete schedule slots: %w", err)
	}

	return nil
}

func (s *appointmentService) GetGeneratedSlots(doctorID, scheduleID uuid.UUID, startDate, endDate string) (*models.GeneratedSlotsResponse, error) {
	s.logInfo("Getting generated slots", map[string]interface{}{
		"doctorID":   doctorID.String(),
		"scheduleID": scheduleID.String(),
		"startDate":  startDate,
		"endDate":    endDate,
	})

	// Проверяем расписание и права доступа
	schedule, err := s.repo.GetScheduleByID(scheduleID)
	if err != nil {
		s.logError("Schedule not found", map[string]interface{}{
			"doctorID":   doctorID.String(),
			"scheduleID": scheduleID.String(),
			"error":      err.Error(),
		})
		return nil, fmt.Errorf("schedule not found: %w", err)
	}

	if schedule.DoctorID != doctorID {
		s.logError("Schedule ownership validation failed", map[string]interface{}{
			"doctorID":         doctorID.String(),
			"scheduleID":       scheduleID.String(),
			"scheduleDoctorID": schedule.DoctorID.String(),
		})
		return nil, errors.New("schedule doesn't belong to this doctor")
	}

	// Парсим даты
	start, err := time.Parse("2006-01-02", startDate)
	if err != nil {
		s.logError("Invalid start date format", map[string]interface{}{
			"doctorID":  doctorID.String(),
			"startDate": startDate,
			"error":     err.Error(),
		})
		return nil, fmt.Errorf("invalid start date: %w", err)
	}

	end, err := time.Parse("2006-01-02", endDate)
	if err != nil {
		s.logError("Invalid end date format", map[string]interface{}{
			"doctorID": doctorID.String(),
			"endDate":  endDate,
			"error":    err.Error(),
		})
		return nil, fmt.Errorf("invalid end date: %w", err)
	}

	// Добавляем время к концу дня для правильного поиска
	endWithTime := end.Add(23*time.Hour + 59*time.Minute + 59*time.Second)

	// Получаем все слоты для расписания в заданном периоде
	appointments, err := s.repo.GetScheduleSlots(scheduleID, start, endWithTime)
	if err != nil {
		s.logError("Failed to get schedule slots from repository", map[string]interface{}{
			"doctorID":   doctorID.String(),
			"scheduleID": scheduleID.String(),
			"error":      err.Error(),
		})
		return nil, fmt.Errorf("failed to get schedule slots: %w", err)
	}

	// Преобразуем слоты в детальную информацию
	slots := make([]models.GeneratedSlotDetail, len(appointments))
	var availableCount, bookedCount, canceledCount int

	for i, appointment := range appointments {
		duration := int(appointment.EndTime.Sub(appointment.StartTime).Minutes())

		var bookedAt *time.Time
		if appointment.Status == "booked" && !appointment.UpdatedAt.IsZero() {
			bookedAt = &appointment.UpdatedAt
		}

		slots[i] = models.GeneratedSlotDetail{
			ID:              appointment.ID,
			StartTime:       appointment.StartTime,
			EndTime:         appointment.EndTime,
			Duration:        duration,
			Status:          appointment.Status,
			AppointmentType: appointment.AppointmentType,
			Title:           appointment.Title,
			PatientID:       appointment.PatientID,
			PatientNotes:    appointment.PatientNotes,
			BookedAt:        bookedAt,
		}

		// Подсчет статистики
		switch appointment.Status {
		case "available":
			availableCount++
		case "booked":
			bookedCount++
		case "canceled":
			canceledCount++
		}
	}

	// Подготавливаем метаданные расписания
	scheduleMetadata := models.ScheduleMetadata{
		ID:                schedule.ID,
		Name:              schedule.Name,
		WorkDays:          []int(schedule.WorkDays),
		StartTime:         schedule.StartTime,
		EndTime:           schedule.EndTime,
		BreakStart:        schedule.BreakStart,
		BreakEnd:          schedule.BreakEnd,
		SlotDuration:      schedule.SlotDuration,
		SlotTitle:         schedule.SlotTitle,
		AppointmentFormat: schedule.AppointmentFormat,
		IsActive:          schedule.IsActive,
	}

	// Подсчитываем количество дней
	days := int(end.Sub(start).Hours()/24) + 1

	// Подготавливаем период
	period := models.Period{
		StartDate: startDate,
		EndDate:   endDate,
		Days:      days,
	}

	// Подготавливаем сводку
	summary := models.SlotsSummary{
		TotalSlots:     len(slots),
		AvailableSlots: availableCount,
		BookedSlots:    bookedCount,
		CanceledSlots:  canceledCount,
	}

	s.logInfo("Generated slots retrieved successfully", map[string]interface{}{
		"doctorID":       doctorID.String(),
		"scheduleID":     scheduleID.String(),
		"totalSlots":     len(slots),
		"availableSlots": availableCount,
		"bookedSlots":    bookedCount,
		"canceledSlots":  canceledCount,
	})

	return &models.GeneratedSlotsResponse{
		Schedule: scheduleMetadata,
		Period:   period,
		Slots:    slots,
		Summary:  summary,
	}, nil
}

func (s *appointmentService) GetDoctorAppointmentByID(doctorID, appointmentID uuid.UUID) (*models.AppointmentResponse, error) {
	appointment, err := s.repo.GetAppointmentByID(appointmentID)
	if err != nil {
		return nil, fmt.Errorf("appointment not found: %w", err)
	}

	if appointment.DoctorID != doctorID {
		return nil, errors.New("appointment doesn't belong to this doctor")
	}

	return s.appointmentToResponse(appointment), nil
}
func (s *appointmentService) GetAppointmentByIDForRole(userID uuid.UUID, userRole string, appointmentID uuid.UUID) (*models.AppointmentResponse, error) {
	appointment, err := s.repo.GetAppointmentByID(appointmentID)
	if err != nil {
		return nil, fmt.Errorf("appointment not found: %w", err)
	}

	// reception может смотреть любые записи
	if userRole == "reception" {
		return s.appointmentToResponse(appointment), nil
	}

	// doctor может смотреть любые записи
	if userRole == "doctor" {
		return s.appointmentToResponse(appointment), nil
	}

	// patient — только свои
	if userRole == "patient" {
		patientRecordID, err := s.repo.GetPatientRecordIDByUserID(userID)
		if err != nil {
			return nil, fmt.Errorf("failed to get patient by user id: %w", err)
		}
		if patientRecordID == nil {
			return nil, errors.New("patient not found")
		}

		if appointment.PatientID == nil || *appointment.PatientID != *patientRecordID {
			return nil, errors.New("appointment doesn't belong to this patient")
		}
		return s.appointmentToResponse(appointment), nil
	}

	return nil, errors.New("forbidden")
}
func (s *appointmentService) GetPatientAppointmentByID(userID, appointmentID uuid.UUID) (*models.AppointmentResponse, error) {
	appointment, err := s.repo.GetAppointmentByID(appointmentID)
	if err != nil {
		return nil, fmt.Errorf("appointment not found: %w", err)
	}

	patientRecordID, err := s.repo.GetPatientRecordIDByUserID(userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get patient by user id: %w", err)
	}
	if patientRecordID == nil {
		return nil, errors.New("patient not found")
	}

	if appointment.PatientID == nil || *appointment.PatientID != *patientRecordID {
		return nil, errors.New("appointment doesn't belong to this patient")
	}

	return s.appointmentToResponse(appointment), nil
}

// UploadAppointmentFile загружает файл к записи
func (s *appointmentService) UploadAppointmentFile(userID uuid.UUID, userRole string, appointmentID uuid.UUID, fileData []byte, fileName, mimeType, fileType, name string) (*models.AppointmentFileResponse, error) {
	// 1. Проверяем права доступа к записи
	hasAccess, err := s.CheckAppointmentAccess(userID, userRole, appointmentID)
	if err != nil {
		return nil, fmt.Errorf("failed to check appointment access: %w", err)
	}
	if !hasAccess {
		return nil, errors.New("no access to this appointment")
	}

	// 2. Нормализация типа файла (убираем лишние пробелы)
	if fileType != "" {
		fileType = strings.TrimSpace(fileType)
		if len(fileType) > 50 {
			fileType = fileType[:50]
		}
	}

	// 3. Загружаем файл в FileServer
	fileID, err := s.uploadToFileServer(userID, fileData, fileName, mimeType, name)
	if err != nil {
		return nil, fmt.Errorf("failed to upload to file server: %w", err)
	}

	uploadedBy := strings.TrimSpace(userRole)
	if uploadedBy == "reception" {
		uploadedBy = "doctor"
	}

	appointmentFile := &models.AppointmentFile{
		AppointmentID: appointmentID,
		FileID:        *fileID,
		FileType:      fileType,
		UploadedBy:    uploadedBy,
	}

	err = s.repo.CreateAppointmentFile(appointmentFile)
	if err != nil {
		// Если не удалось создать связь, пытаемся удалить файл из FileServer
		s.deleteFromFileServer(*fileID)
		return nil, fmt.Errorf("failed to create appointment file: %w", err)
	}

	// 5. Возвращаем ответ с информацией о файле
	return s.buildAppointmentFileResponse(appointmentFile, fileName, fileName, mimeType, int64(len(fileData)))
}

// GetAppointmentFiles получает список файлов записи
func (s *appointmentService) GetAppointmentFiles(userID uuid.UUID, userRole string, appointmentID uuid.UUID) ([]*models.AppointmentFileResponse, error) {
	// 1. Проверяем права доступа к записи
	hasAccess, err := s.CheckAppointmentAccess(userID, userRole, appointmentID)
	if err != nil {
		return nil, fmt.Errorf("failed to check appointment access: %w", err)
	}
	if !hasAccess {
		return nil, errors.New("no access to this appointment")
	}

	// 2. Получаем файлы записи
	appointmentFiles, err := s.repo.GetAppointmentFiles(appointmentID)
	if err != nil {
		return nil, fmt.Errorf("failed to get appointment files: %w", err)
	}

	// 3. Обогащаем информацией из FileServer
	var responses []*models.AppointmentFileResponse
	for _, appointmentFile := range appointmentFiles {
		fileInfo, err := s.getFileInfoFromFileServer(appointmentFile.FileID)
		if err != nil {
			// Если файл не найден в FileServer, пропускаем его
			continue
		}

		response, err := s.buildAppointmentFileResponse(appointmentFile, fileInfo.Name, fileInfo.OriginalName, fileInfo.MimeType, fileInfo.Size)
		if err != nil {
			continue
		}
		responses = append(responses, response)
	}

	return responses, nil
}

// DeleteAppointmentFile удаляет файл записи
func (s *appointmentService) DeleteAppointmentFile(userID uuid.UUID, userRole string, appointmentID, fileID uuid.UUID) error {
	// 1. Проверяем права доступа к записи
	hasAccess, err := s.CheckAppointmentAccess(userID, userRole, appointmentID)
	if err != nil {
		return fmt.Errorf("failed to check appointment access: %w", err)
	}
	if !hasAccess {
		return errors.New("no access to this appointment")
	}

	// 2. Получаем информацию о файле записи
	appointmentFile, err := s.repo.GetAppointmentFileByID(fileID)
	if err != nil {
		return fmt.Errorf("appointment file not found: %w", err)
	}

	// 3. Проверяем, что файл принадлежит этой записи
	if appointmentFile.AppointmentID != appointmentID {
		return errors.New("file doesn't belong to this appointment")
	}

	// 4. Удаляем из FileServer
	err = s.deleteFromFileServer(appointmentFile.FileID)
	if err != nil {
		// Логируем ошибку, но продолжаем удаление связи
		s.logger.Error("Failed to delete file from FileServer", map[string]interface{}{
			"file_id": appointmentFile.FileID,
			"error":   err.Error(),
		})
	}

	// 5. Удаляем связь
	err = s.repo.DeleteAppointmentFile(fileID)
	if err != nil {
		return fmt.Errorf("failed to delete appointment file: %w", err)
	}

	return nil
}

// DownloadAppointmentFile скачивает файл записи
func (s *appointmentService) DownloadAppointmentFile(userID uuid.UUID, userRole string, appointmentID, fileID uuid.UUID) ([]byte, string, string, error) {
	// 1. Проверяем права доступа к записи
	hasAccess, err := s.CheckAppointmentAccess(userID, userRole, appointmentID)
	if err != nil {
		return nil, "", "", fmt.Errorf("failed to check appointment access: %w", err)
	}
	if !hasAccess {
		return nil, "", "", errors.New("no access to this appointment")
	}

	// 2. Получаем информацию о файле записи
	appointmentFile, err := s.repo.GetAppointmentFileByID(fileID)
	if err != nil {
		return nil, "", "", fmt.Errorf("appointment file not found: %w", err)
	}

	// 3. Проверяем, что файл принадлежит этой записи
	if appointmentFile.AppointmentID != appointmentID {
		return nil, "", "", errors.New("file doesn't belong to this appointment")
	}

	// 4. Скачиваем файл из FileServer
	fileData, fileName, mimeType, err := s.downloadFromFileServer(appointmentFile.FileID)
	if err != nil {
		return nil, "", "", fmt.Errorf("failed to download from file server: %w", err)
	}

	return fileData, fileName, mimeType, nil
}

// CheckAppointmentAccess проверяет права доступа к записи
// CheckAppointmentAccess проверяет права доступа к записи
func (s *appointmentService) CheckAppointmentAccess(userID uuid.UUID, userRole string, appointmentID uuid.UUID) (bool, error) {
	appointment, err := s.repo.GetAppointmentByID(appointmentID)
	if err != nil {
		return false, fmt.Errorf("appointment not found: %w", err)
	}

	switch strings.TrimSpace(userRole) {
	case "reception":
		return true, nil

	case "doctor":
		return appointment.DoctorID == userID, nil

	case "patient":
		patientRecordID, err := s.repo.GetPatientRecordIDByUserID(userID)
		if err != nil {
			return false, fmt.Errorf("failed to get patient by user id: %w", err)
		}
		if patientRecordID == nil {
			return false, errors.New("patient not found")
		}
		return appointment.PatientID != nil && *appointment.PatientID == *patientRecordID, nil

	default:
		return false, errors.New("invalid user role")
	}
}

// AddAppointmentFiles добавляет существующие файлы к записи
func (s *appointmentService) AddAppointmentFiles(userID uuid.UUID, userRole string, appointmentID uuid.UUID, req *models.AddAppointmentFilesRequest) (*models.AddAppointmentFilesResponse, error) {
	// 1. Проверяем права доступа к записи
	hasAccess, err := s.CheckAppointmentAccess(userID, userRole, appointmentID)
	if err != nil {
		return nil, fmt.Errorf("failed to check appointment access: %w", err)
	}
	if !hasAccess {
		return nil, errors.New("no access to this appointment")
	}

	// 2. Проверяем, что пользователь - врач (только врачи могут добавлять файлы)
	if userRole != "doctor" {
		return nil, errors.New("only doctors can add files to appointments")
	}

	var addedFiles []*models.AppointmentFileResponse
	var errors []string

	// 3. Обрабатываем каждый файл
	for _, fileID := range req.FileIDs {
		// Проверяем, не привязан ли уже файл к этой записи
		isAttached, err := s.repo.CheckFileAttachedToAppointment(appointmentID, fileID)
		if err != nil {
			errors = append(errors, fmt.Sprintf("Failed to check file %s: %s", fileID, err.Error()))
			continue
		}
		if isAttached {
			errors = append(errors, fmt.Sprintf("File %s is already attached to this appointment", fileID))
			continue
		}

		// Получаем информацию о файле из FileServer
		fileInfo, err := s.getFileInfoFromFileServer(fileID)
		if err != nil {
			errors = append(errors, fmt.Sprintf("Failed to get file info for %s: %s", fileID, err.Error()))
			continue
		}

		// Создаем связь файла с записью
		uploadedBy := strings.TrimSpace(userRole)
		if uploadedBy == "reception" {
			uploadedBy = "doctor"
		}

		appointmentFile := &models.AppointmentFile{
			AppointmentID: appointmentID,
			FileID:        fileID,
			FileType:      "",
			UploadedBy:    uploadedBy,
		}

		err = s.repo.CreateAppointmentFile(appointmentFile)
		if err != nil {
			errors = append(errors, fmt.Sprintf("Failed to create appointment file for %s: %s", fileID, err.Error()))
			continue
		}

		// Строим ответ
		response, err := s.buildAppointmentFileResponse(appointmentFile, fileInfo.Name, fileInfo.OriginalName, fileInfo.MimeType, fileInfo.Size)
		if err != nil {
			errors = append(errors, fmt.Sprintf("Failed to build response for %s: %s", fileID, err.Error()))
			continue
		}

		addedFiles = append(addedFiles, response)
	}

	return &models.AddAppointmentFilesResponse{
		AddedFiles: addedFiles,
		Errors:     errors,
	}, nil
}

// === HELPER METHODS FOR FILESERVER INTEGRATION ===

// FileServerResponse represents FileServer API response
type FileServerResponse struct {
	ID           uuid.UUID `json:"id"`
	Name         string    `json:"name"`
	OriginalName string    `json:"original_name"`
	MimeType     string    `json:"mime_type"`
	Size         int64     `json:"size"`
}

// uploadToFileServer uploads file to FileServer service
func (s *appointmentService) uploadToFileServer(userID uuid.UUID, fileData []byte, fileName, mimeType, name string) (*uuid.UUID, error) {
	// Создаем multipart form для отправки файла
	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)

	// Добавляем файл
	part, err := writer.CreateFormFile("file", fileName)
	if err != nil {
		return nil, err
	}
	_, err = part.Write(fileData)
	if err != nil {
		return nil, err
	}

	// Добавляем имя файла если указано
	if name != "" {
		err = writer.WriteField("name", name)
		if err != nil {
			return nil, err
		}
	}

	err = writer.Close()
	if err != nil {
		return nil, err
	}

	// Создаем HTTP запрос
	req, err := http.NewRequest("POST", "http://fileserver_service:8087/files", &buf)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Content-Type", writer.FormDataContentType())
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", s.generateInternalJWT(userID, "patient"))) // Temporary token

	// Выполняем запрос
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		return nil, fmt.Errorf("FileServer returned status %d", resp.StatusCode)
	}

	// Парсим ответ
	var fileResponses []FileServerResponse
	err = json.NewDecoder(resp.Body).Decode(&fileResponses)
	if err != nil {
		return nil, err
	}

	if len(fileResponses) == 0 {
		return nil, errors.New("no files uploaded")
	}

	return &fileResponses[0].ID, nil
}

// getFileInfoFromFileServer получает информацию о файле из FileServer
func (s *appointmentService) getFileInfoFromFileServer(fileID uuid.UUID) (*FileServerResponse, error) {
	req, err := http.NewRequest("GET", fmt.Sprintf("http://fileserver_service:8087/files/%s", fileID), nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", s.generateInternalJWT(uuid.New(), "system")))

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("FileServer returned status %d", resp.StatusCode)
	}

	var fileInfo FileServerResponse
	err = json.NewDecoder(resp.Body).Decode(&fileInfo)
	if err != nil {
		return nil, err
	}

	return &fileInfo, nil
}

// downloadFromFileServer скачивает файл из FileServer
func (s *appointmentService) downloadFromFileServer(fileID uuid.UUID) ([]byte, string, string, error) {
	req, err := http.NewRequest("GET", fmt.Sprintf("http://fileserver_service:8087/files/%s/download", fileID), nil)
	if err != nil {
		return nil, "", "", err
	}

	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", s.generateInternalJWT(uuid.New(), "system")))

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, "", "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, "", "", fmt.Errorf("FileServer returned status %d", resp.StatusCode)
	}

	// Читаем содержимое файла
	fileData, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, "", "", err
	}

	// Извлекаем имя файла и тип из заголовков
	fileName := "download"
	if cd := resp.Header.Get("Content-Disposition"); cd != "" {
		// Простая обработка Content-Disposition для получения имени файла
		// В продакшене нужна более надежная обработка
		fileName = cd
	}

	mimeType := resp.Header.Get("Content-Type")

	return fileData, fileName, mimeType, nil
}

// deleteFromFileServer удаляет файл из FileServer
func (s *appointmentService) deleteFromFileServer(fileID uuid.UUID) error {
	req, err := http.NewRequest("DELETE", fmt.Sprintf("http://fileserver_service:8087/files/%s", fileID), nil)
	if err != nil {
		return err
	}

	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", s.generateInternalJWT(uuid.New(), "system")))

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusNoContent {
		return fmt.Errorf("FileServer returned status %d", resp.StatusCode)
	}

	return nil
}

// generateInternalJWT generates a JWT token for internal service communication
func (s *appointmentService) generateInternalJWT(userID uuid.UUID, role string) string {
	if s.jwtSecret == "" {
		// Fallback для тестирования
		return "internal-service-token"
	}

	claims := jwt.MapClaims{
		"user_id":      userID.String(),
		"role":         role,
		"is_reception": role == "reception", // <- ДОБАВИЛИ
		"exp":          time.Now().Add(time.Hour).Unix(),
		"iat":          time.Now().Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(s.jwtSecret))
	if err != nil {
		// лучше вернуть пустую строку/логировать, но пока оставим как есть
		return ""
	}
	return signed
}

// buildAppointmentFileResponse создает ответ с информацией о файле записи
func (s *appointmentService) buildAppointmentFileResponse(appointmentFile *models.AppointmentFile, fileName, originalName, mimeType string, size int64) (*models.AppointmentFileResponse, error) {
	return &models.AppointmentFileResponse{
		ID:            appointmentFile.ID,
		AppointmentID: appointmentFile.AppointmentID,
		FileID:        appointmentFile.FileID,
		FileType:      appointmentFile.FileType,
		UploadedBy:    appointmentFile.UploadedBy,
		CreatedAt:     appointmentFile.CreatedAt,
		FileName:      fileName,
		OriginalName:  originalName,
		MimeType:      mimeType,
		Size:          size,
	}, nil
}

// getUserData получает данные пользователя из identity_service
func (s *appointmentService) getUserData(userID uuid.UUID) (*UserData, error) {
	url := fmt.Sprintf("%s/auth/user/%s", s.identityURL, userID.String())

	resp, err := s.httpClient.Get(url)
	if err != nil {
		return nil, fmt.Errorf("failed to get user data: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("identity service returned status %d", resp.StatusCode)
	}

	var userData UserData
	if err := json.NewDecoder(resp.Body).Decode(&userData); err != nil {
		return nil, fmt.Errorf("failed to decode user data: %w", err)
	}

	return &userData, nil
}

// getDoctorData получает данные врача из specialist_service по doctor_id (из таблицы doctors)
func (s *appointmentService) getDoctorData(doctorID uuid.UUID) (*DoctorData, error) {
	url := fmt.Sprintf("%s/api/doctors/%s", s.specialistURL, doctorID.String())

	resp, err := s.httpClient.Get(url)
	if err != nil {
		return nil, fmt.Errorf("failed to get doctor data: %w", err)
	}
	defer resp.Body.Close()

	// Читаем тело ответа для логирования и парсинга
	bodyBytes, readErr := io.ReadAll(resp.Body)
	if readErr != nil {
		s.logError("Failed to read response body", map[string]interface{}{
			"url":   url,
			"error": readErr.Error(),
		})
		return nil, fmt.Errorf("failed to read response body: %w", readErr)
	}

	if resp.StatusCode != http.StatusOK {
		s.logError("Specialist service returned non-OK status", map[string]interface{}{
			"url":        url,
			"statusCode": resp.StatusCode,
			"body":       string(bodyBytes),
		})
		return nil, fmt.Errorf("specialist service returned status %d", resp.StatusCode)
	}

	var doctorData DoctorData
	if err := json.Unmarshal(bodyBytes, &doctorData); err != nil {
		s.logError("Failed to decode doctor data", map[string]interface{}{
			"url":   url,
			"error": err.Error(),
			"body":  string(bodyBytes),
		})
		return nil, fmt.Errorf("failed to decode doctor data: %w", err)
	}

	s.logInfo("Doctor data retrieved successfully", map[string]interface{}{
		"doctorID": doctorID.String(),
		"userID":   doctorData.UserID.String(),
	})

	return &doctorData, nil
}

// getDoctorByUserID получает данные врача из specialist_service по user_id
// Использует эндпоинт /api/users/{user_id}/doctor
func (s *appointmentService) getDoctorByUserID(userID uuid.UUID) (*DoctorData, error) {
	url := fmt.Sprintf("%s/api/users/%s/doctor", s.specialistURL, userID.String())

	resp, err := s.httpClient.Get(url)
	if err != nil {
		return nil, fmt.Errorf("failed to get doctor by user_id: %w", err)
	}
	defer resp.Body.Close()

	// Читаем тело ответа для логирования и парсинга
	bodyBytes, readErr := io.ReadAll(resp.Body)
	if readErr != nil {
		s.logError("Failed to read response body", map[string]interface{}{
			"url":   url,
			"error": readErr.Error(),
		})
		return nil, fmt.Errorf("failed to read response body: %w", readErr)
	}

	if resp.StatusCode != http.StatusOK {
		s.logError("Specialist service returned non-OK status", map[string]interface{}{
			"url":        url,
			"statusCode": resp.StatusCode,
			"body":       string(bodyBytes),
		})
		return nil, fmt.Errorf("specialist service returned status %d", resp.StatusCode)
	}

	var doctorData DoctorData
	if err := json.Unmarshal(bodyBytes, &doctorData); err != nil {
		s.logError("Failed to decode doctor data", map[string]interface{}{
			"url":   url,
			"error": err.Error(),
			"body":  string(bodyBytes),
		})
		return nil, fmt.Errorf("failed to decode doctor data: %w", err)
	}

	s.logInfo("Doctor data retrieved successfully by user_id", map[string]interface{}{
		"userID":   userID.String(),
		"doctorID": doctorData.ID.String(),
	})

	return &doctorData, nil
}

// UserData - структура для данных пользователя
type UserData struct {
	ID    string `json:"id"`
	Email string `json:"email"`
	Phone string `json:"phone"`
	Role  string `json:"role"`
}

// DoctorData - структура для данных врача (соответствует DoctorResponse из specialist_service)
type DoctorData struct {
	ID           uuid.UUID `json:"id"`
	UserID       uuid.UUID `json:"user_id"`
	FirstName    string    `json:"first_name"`
	MiddleName   string    `json:"middle_name"`
	LastName     string    `json:"last_name"`
	Description  string    `json:"description"`
	Email        *string   `json:"email"`
	Phone        string    `json:"phone"`
	AvatarURL    string    `json:"avatar_url"`
	Roles        []string  `json:"roles"`
	Price        float64   `json:"price"`
	Education    []string  `json:"education"`
	Certificates []string  `json:"certificates"`
}

func (s *appointmentService) RescheduleAppointmentForRole(userID uuid.UUID, userRole string, appointmentID, targetSlotID uuid.UUID, reason string) (*models.AppointmentResponse, error) {
	// Загружаем текущий приём
	current, err := s.repo.GetAppointmentByID(appointmentID)
	if err != nil {
		return nil, fmt.Errorf("appointment not found: %w", err)
	}

	// Права на перенос:
	// doctor -> только свой
	// reception -> любой
	switch userRole {
	case "doctor":
		if current.DoctorID != userID {
			return nil, errors.New("appointment doesn't belong to this doctor")
		}
	case "reception":
		// ресепшн может переносить любой приём
	default:
		return nil, errors.New("forbidden")
	}

	if current.Status != "booked" || current.PatientID == nil {
		return nil, errors.New("only booked appointments can be rescheduled")
	}
	if !current.StartTime.After(time.Now()) {
		return nil, errors.New("cannot reschedule past appointments")
	}

	// Загружаем целевой слот
	target, err := s.repo.GetAppointmentByID(targetSlotID)
	if err != nil {
		return nil, fmt.Errorf("target slot not found: %w", err)
	}

	// Целевой слот должен принадлежать тому же врачу, что и текущий приём
	if target.DoctorID != current.DoctorID {
		return nil, errors.New("target slot belongs to another doctor")
	}
	if !target.IsAvailable() {
		return nil, errors.New("target slot is not available")
	}
	if !target.StartTime.After(time.Now()) {
		return nil, errors.New("target slot must be in the future")
	}

	// Идемпотентность
	if current.StartTime.Equal(target.StartTime) && current.EndTime.Equal(target.EndTime) {
		return s.appointmentToResponse(current), nil
	}

	oldStart := current.StartTime
	oldEnd := current.EndTime

	newStart := target.StartTime
	newEnd := target.EndTime

	tempStart := newStart.Add(1 * time.Second)
	tempEnd := newEnd.Add(1 * time.Second)

	currentDoctorID := current.DoctorID

	// current переносим на target
	current.StartTime = newStart
	current.EndTime = newEnd
	if target.ScheduleID != nil {
		current.ScheduleID = target.ScheduleID
	}

	// target временно смещаем, потом освобождаем на старое время current
	origTargetScheduleID := target.ScheduleID
	target.StartTime = tempStart
	target.EndTime = tempEnd
	target.Status = "available"
	target.PatientID = nil
	target.PatientNotes = ""
	target.MeetingID = nil
	target.MeetingLink = nil

	db, ok := s.repo.(interface{ DB() *gorm.DB })
	if !ok {
		if err := s.repo.UpdateAppointment(target); err != nil {
			return nil, err
		}
		if err := s.repo.UpdateAppointment(current); err != nil {
			return nil, err
		}

		target.StartTime = oldStart
		target.EndTime = oldEnd
		target.ScheduleID = origTargetScheduleID
		if err := s.repo.UpdateAppointment(target); err != nil {
			return nil, err
		}
	} else {
		gormDB := db.DB()
		err = gormDB.Transaction(func(tx *gorm.DB) error {
			if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&models.Appointment{}, "id = ?", current.ID).Error; err != nil {
				return err
			}
			if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&models.Appointment{}, "id = ?", target.ID).Error; err != nil {
				return err
			}

			// 1) target -> temp
			if err := tx.Save(target).Error; err != nil {
				return err
			}
			// 2) current -> new
			if err := tx.Save(current).Error; err != nil {
				return err
			}
			// 3) target -> old
			target.StartTime = oldStart
			target.EndTime = oldEnd
			target.ScheduleID = origTargetScheduleID
			if err := tx.Save(target).Error; err != nil {
				return err
			}
			return nil
		})
		if err != nil {
			return nil, err
		}
	}

	// Событие о переносе
	if s.messageService != nil {
		patientData, _ := s.getUserData(*current.PatientID)
		doctorData, _ := s.getDoctorData(currentDoctorID)

		doctorName := ""
		if doctorData != nil {
			if doctorData.FirstName != "" {
				doctorName = doctorData.FirstName
			}
			if doctorData.MiddleName != "" {
				doctorName += " " + doctorData.MiddleName
			}
			if doctorData.LastName != "" {
				doctorName += " " + doctorData.LastName
			}
			if doctorName == "" {
				doctorName = "Врач"
			}
		}

		patientName := "Пациент"
		if patientData == nil {
			patientData = &UserData{Phone: "77071234567"}
		}
		if doctorData == nil {
			doctorData = &DoctorData{Phone: "77071234568"}
		}

		event := &models.AppointmentRescheduledEvent{
			Type:            "appointment_rescheduled",
			AppointmentID:   current.ID,
			PatientID:       *current.PatientID,
			DoctorID:        currentDoctorID,
			PatientPhone:    patientData.Phone,
			DoctorPhone:     doctorData.Phone,
			PatientName:     patientName,
			DoctorName:      doctorName,
			OldStartTime:    oldStart,
			OldEndTime:      oldEnd,
			NewStartTime:    current.StartTime,
			NewEndTime:      current.EndTime,
			AppointmentType: current.AppointmentType,
			Reason:          reason,
		}
		_ = s.messageService.PublishAppointmentRescheduled(context.Background(), event)
	}

	return s.appointmentToResponse(current), nil
}
func (s *appointmentService) CompleteAppointment(doctorID, appointmentID uuid.UUID, req *models.CompleteAppointmentRequest) (*models.AppointmentResponse, error) {
	appointment, err := s.repo.GetAppointmentByID(appointmentID)
	if err != nil {
		return nil, fmt.Errorf("appointment not found: %w", err)
	}

	if appointment.DoctorID != doctorID {
		return nil, errors.New("appointment doesn't belong to this doctor")
	}

	if appointment.Status != "booked" || appointment.PatientID == nil {
		return nil, errors.New("only booked appointments can be completed")
	}

	// Завершаем запись
	appointment.Complete(req.DoctorNotes)

	// Обновляем дополнительные поля если переданы
	if req.HealthPassportID != nil {
		appointment.HealthPassportID = req.HealthPassportID
	}

	if err := s.repo.UpdateAppointment(appointment); err != nil {
		return nil, fmt.Errorf("failed to complete appointment: %w", err)
	}

	// Отправляем событие о завершении записи
	if s.messageService != nil {
		patientData, _ := s.getUserData(*appointment.PatientID)
		doctorData, _ := s.getDoctorData(doctorID)
		doctorName := "Врач"
		if doctorData != nil {
			if doctorData.FirstName != "" {
				doctorName = doctorData.FirstName
			}
			if doctorData.MiddleName != "" {
				doctorName += " " + doctorData.MiddleName
			}
			if doctorData.LastName != "" {
				doctorName += " " + doctorData.LastName
			}
		}
		patientName := "Пациент"
		if patientData == nil {
			patientData = &UserData{Phone: "77071234567"}
		}
		if doctorData == nil {
			doctorData = &DoctorData{Phone: "77071234568"}
		}

		event := &models.AppointmentCompletedEvent{
			Type:            "appointment_completed",
			AppointmentID:   appointment.ID,
			PatientID:       *appointment.PatientID,
			DoctorID:        doctorID,
			PatientPhone:    patientData.Phone,
			DoctorPhone:     doctorData.Phone,
			PatientName:     patientName,
			DoctorName:      doctorName,
			StartTime:       appointment.StartTime,
			EndTime:         appointment.EndTime,
			AppointmentType: appointment.AppointmentType,
			CompletedReason: req.CompletedReason,
		}
		_ = s.messageService.PublishAppointmentCompleted(context.Background(), event)
	}

	return s.appointmentToResponse(appointment), nil
}

// Transcription
func (s *appointmentService) GetAppointmentTranscription(userID uuid.UUID, userRole string, appointmentID uuid.UUID) (*models.AppointmentTranscriptionResponse, error) {
	// Проверка доступа (doctor or patient)
	hasAccess, err := s.CheckAppointmentAccess(userID, userRole, appointmentID)
	if err != nil {
		return nil, fmt.Errorf("failed to check appointment access: %w", err)
	}
	if !hasAccess {
		return nil, errors.New("no access to this appointment")
	}

	appt, err := s.repo.GetAppointmentTranscription(appointmentID)
	if err != nil {
		return nil, fmt.Errorf("failed to get transcription: %w", err)
	}

	resp := &models.AppointmentTranscriptionResponse{
		AppointmentID: appointmentID,
		Text:          appt.TranscriptionText,
		Lang:          appt.TranscriptionLang,
		Source:        appt.TranscriptionSource,
		TranscribedAt: appt.TranscribedAt,
		TranscribedBy: appt.TranscribedBy,
	}
	return resp, nil
}

func (s *appointmentService) UpdateAppointmentTranscription(userID uuid.UUID, userRole string, appointmentID uuid.UUID, req *models.AppointmentTranscriptionUpdateRequest) (*models.AppointmentTranscriptionResponse, error) {
	// Только врач может обновлять
	hasAccess, err := s.CheckAppointmentAccess(userID, userRole, appointmentID)
	if err != nil {
		return nil, fmt.Errorf("failed to check appointment access: %w", err)
	}
	if !hasAccess || userRole != "doctor" {
		return nil, errors.New("only doctor can update transcription")
	}

	text := strings.TrimSpace(req.Text)
	if len(text) == 0 {
		return nil, errors.New("text is required")
	}
	if len(text) > 100000 {
		text = text[:100000]
	}

	now := time.Now()
	by := userID
	var langPtr *string = nil
	var sourcePtr *string = nil
	if req.Lang != nil {
		lang := strings.TrimSpace(*req.Lang)
		if lang != "" {
			langPtr = &lang
		}
	}
	if req.Source != nil {
		src := strings.TrimSpace(*req.Source)
		if src != "" {
			sourcePtr = &src
		}
	}

	if err := s.repo.UpdateAppointmentTranscription(appointmentID, &text, langPtr, sourcePtr, &by, now); err != nil {
		return nil, fmt.Errorf("failed to update transcription: %w", err)
	}

	return &models.AppointmentTranscriptionResponse{
		AppointmentID: appointmentID,
		Text:          &text,
		Lang:          langPtr,
		Source:        sourcePtr,
		TranscribedAt: &now,
		TranscribedBy: &by,
	}, nil
}
func (s *appointmentService) DeleteAppointment(userID uuid.UUID, userRole string, appointmentID uuid.UUID) error {
	appointment, err := s.repo.GetAppointmentByID(appointmentID)
	if err != nil {
		return err
	}

	if appointment.EndTime.After(time.Now()) {
		return fmt.Errorf("only past appointments can be deleted")
	}

	// reception может удалить любой прошедший приём
	if userRole == "reception" {
		return s.repo.DeleteAppointment(appointmentID)
	}

	// только doctor и reception вообще могут удалять
	if userRole != "doctor" {
		return fmt.Errorf("forbidden")
	}

	// doctor может удалить только свой приём
	doctorUserID, err := s.repo.GetDoctorUserID(appointment.DoctorID)
	if err != nil {
		return err
	}
	if doctorUserID == nil {
		return fmt.Errorf("doctor user not found")
	}

	if *doctorUserID != userID {
		return fmt.Errorf("forbidden")
	}

	return s.repo.DeleteAppointment(appointmentID)
}
func (s *appointmentService) DeleteAppointmentTranscription(userID uuid.UUID, userRole string, appointmentID uuid.UUID) error {
	// Только врач может удалять
	hasAccess, err := s.CheckAppointmentAccess(userID, userRole, appointmentID)
	if err != nil {
		return fmt.Errorf("failed to check appointment access: %w", err)
	}
	if !hasAccess || userRole != "doctor" {
		return errors.New("only doctor can delete transcription")
	}

	if err := s.repo.ClearAppointmentTranscription(appointmentID); err != nil {
		return fmt.Errorf("failed to clear transcription: %w", err)
	}
	return nil
}

// GetSlotsWithStatuses возвращает ВСЕ слоты врача за период (и свободные, и занятые, и отменённые)
func (s *appointmentService) GetAvailableSlots(doctorID uuid.UUID, date string) ([]*models.AvailableSlot, error) {
	// TZ клиники
	loc, err := time.LoadLocation("Asia/Almaty")
	if err != nil {
		// fallback
		loc = time.FixedZone("Asia/Almaty", 6*60*60)
	}

	// Парсим дату как локальную дату (Алматы), строим границы суток [startLocal, endLocal)
	startLocal, err := time.ParseInLocation("2006-01-02", date, loc)
	if err != nil {
		return nil, fmt.Errorf("invalid date format: %w", err)
	}
	endLocal := startLocal.AddDate(0, 0, 1)

	// В БД timestamptz -> безопасно сравнивать в UTC
	startUTC := startLocal.UTC()
	endUTC := endLocal.UTC()

	// ЛОГ границ (очень полезно на время диагностики)
	s.logInfo("GetAvailableSlots range computed", map[string]interface{}{
		"doctorID":   doctorID.String(),
		"date":       date,
		"startLocal": startLocal.Format(time.RFC3339),
		"endLocal":   endLocal.Format(time.RFC3339),
		"startUTC":   startUTC.Format(time.RFC3339),
		"endUTC":     endUTC.Format(time.RFC3339),
	})

	// ВАЖНО: репозиторий должен фильтровать так: start_time >= startUTC AND start_time < endUTC
	appointments, err := s.repo.GetAvailableSlots(doctorID, startUTC, endUTC)
	if err != nil {
		return nil, fmt.Errorf("failed to get available slots: %w", err)
	}

	slots := make([]*models.AvailableSlot, 0, len(appointments))
	for _, appointment := range appointments {
		duration := int(appointment.EndTime.Sub(appointment.StartTime).Minutes())

		slots = append(slots, &models.AvailableSlot{
			ID:              appointment.ID,
			StartTime:       appointment.StartTime,
			EndTime:         appointment.EndTime,
			Duration:        duration,
			Title:           appointment.Title,
			AppointmentType: appointment.AppointmentType,
		})
	}

	// ЛОГ результата
	if len(slots) > 0 {
		// пример первых 2 слотов
		max := 2
		if len(slots) < max {
			max = len(slots)
		}
		examples := make([]map[string]string, 0, max)
		for i := 0; i < max; i++ {
			examples = append(examples, map[string]string{
				"id":        slots[i].ID.String(),
				"startTime": slots[i].StartTime.Format(time.RFC3339),
				"endTime":   slots[i].EndTime.Format(time.RFC3339),
			})
		}

		s.logInfo("GetAvailableSlots result", map[string]interface{}{
			"doctorID": doctorID.String(),
			"date":     date,
			"count":    len(slots),
			"examples": examples,
		})
	} else {
		s.logInfo("GetAvailableSlots result empty", map[string]interface{}{
			"doctorID": doctorID.String(),
			"date":     date,
			"count":    0,
		})
	}

	return slots, nil
}
func (s *appointmentService) GetSlotsWithStatuses(doctorID uuid.UUID, startDate, endDate string) (*models.GeneratedSlotsResponse, error) {
	loc, err := time.LoadLocation("Asia/Almaty")
	if err != nil {
		loc = time.FixedZone("Asia/Almaty", 6*60*60)
	}

	startLocal, err := time.ParseInLocation("2006-01-02", startDate, loc)
	if err != nil {
		return nil, fmt.Errorf("invalid start date: %w", err)
	}

	endLocalDay, err := time.ParseInLocation("2006-01-02", endDate, loc)
	if err != nil {
		return nil, fmt.Errorf("invalid end date: %w", err)
	}

	endLocal := endLocalDay.Add(24*time.Hour - time.Nanosecond)

	startUTC := startLocal.In(time.UTC)
	endUTC := endLocal.In(time.UTC)

	// ⚠️ лучше заменить на repo.GetAppointmentsInRangeByDoctor(doctorID, startUTC, endUTC)
	appts, err := s.repo.GetDoctorAppointments(doctorID)
	if err != nil {
		return nil, fmt.Errorf("failed to get doctor appointments: %w", err)
	}

	// ✅ всегда НЕ nil
	slots := make([]models.GeneratedSlotDetail, 0, 256)
	var availableCount, bookedCount, cancelledCount, blockedCount int

	for _, a := range appts {
		if a.StartTime.Before(startUTC) || a.StartTime.After(endUTC) {
			continue
		}

		duration := int(a.EndTime.Sub(a.StartTime).Minutes())

		var bookedAt *time.Time
		if (a.Status == "booked" || a.Status == "blocked") && !a.UpdatedAt.IsZero() {
			bookedAt = &a.UpdatedAt
		}

		// ✅ нормализуем статус под фронт
		status := strings.ToLower(strings.TrimSpace(a.Status))
		if status == "canceled" {
			status = "cancelled"
		}

		slot := models.GeneratedSlotDetail{
			ID:              a.ID,
			StartTime:       a.StartTime,
			EndTime:         a.EndTime,
			Duration:        duration,
			Status:          status,
			AppointmentType: a.AppointmentType,
			Title:           a.Title,

			DoctorID:      a.DoctorID,
			PatientID:     a.PatientID,
			PatientNotes:  a.PatientNotes,
			BookedAt:      bookedAt,
			CabinetNumber: a.CabinetNumber, // ✅ если тип совпадает

			Channel:   a.Channel,
			ServiceID: a.ServiceID,
		}

		// cabinet_number у тебя int/nullable — подставь аккуратно
		if a.CabinetNumber != nil {
			cn := int(*a.CabinetNumber)
			slot.CabinetNumber = &cn
		}

		slots = append(slots, slot)

		switch status {
		case "available":
			availableCount++
		case "booked":
			bookedCount++
		case "blocked":
			blockedCount++
		case "cancelled":
			cancelledCount++
		}
	}

	// meta как у тебя (оставляю)
	meta := models.ScheduleMetadata{
		ID:                uuid.Nil,
		Name:              "Doctor slots (all schedules)",
		WorkDays:          []int{},
		StartTime:         "",
		EndTime:           "",
		BreakStart:        nil,
		BreakEnd:          nil,
		SlotDuration:      0,
		SlotTitle:         "",
		AppointmentFormat: "both",
		IsActive:          true,
	}

	if schedules, err := s.repo.GetDoctorSchedules(doctorID); err == nil && len(schedules) > 0 {
		var active *models.DoctorSchedule
		for _, sc := range schedules {
			if sc.IsActive {
				active = sc
				break
			}
		}
		if active != nil {
			meta = models.ScheduleMetadata{
				ID:                active.ID,
				Name:              active.Name,
				WorkDays:          []int(active.WorkDays),
				StartTime:         active.StartTime,
				EndTime:           active.EndTime,
				BreakStart:        active.BreakStart,
				BreakEnd:          active.BreakEnd,
				SlotDuration:      active.SlotDuration,
				SlotTitle:         active.SlotTitle,
				AppointmentFormat: active.AppointmentFormat,
				IsActive:          active.IsActive,
			}
		}
	}

	period := models.Period{
		StartDate: startDate,
		EndDate:   endDate,
		Days:      int(endLocalDay.Sub(startLocal).Hours()/24) + 1,
	}

	summary := models.SlotsSummary{
		TotalSlots:     len(slots),
		AvailableSlots: availableCount,
		BookedSlots:    bookedCount,
		CanceledSlots:  cancelledCount, // если поле называется CanceledSlots — ок, просто там теперь cancelled
		// лучше добавить BlockedSlots в summary модель (если хочешь)
	}

	s.logInfo("Doctor slots with statuses retrieved", map[string]interface{}{
		"doctorID":  doctorID.String(),
		"startDate": startDate,
		"endDate":   endDate,
		"total":     len(slots),
		"available": availableCount,
		"booked":    bookedCount,
		"blocked":   blockedCount,
		"cancelled": cancelledCount,
	})

	return &models.GeneratedSlotsResponse{
		Schedule: meta,
		Period:   period,
		Slots:    slots, // ✅ теперь это всегда [] а не null
		Summary:  summary,
	}, nil
}
func (s *appointmentService) publishBookedEventBestEffort(
	appointmentID uuid.UUID,
	patientUserID uuid.UUID,
	appointment *models.Appointment,
) {
	if s.messageService == nil || appointment == nil {
		return
	}
	patientData, err := s.getUserData(patientUserID)
	if err != nil {
		s.logError("Failed to get patient data", map[string]interface{}{
			"patientID": patientUserID.String(),
			"error":     err.Error(),
		})
		patientData = &UserData{Phone: "77071234567"}
	}

	// Врач
	doctorData, err := s.getDoctorData(appointment.DoctorID)
	if err != nil {
		s.logError("Failed to get doctor data", map[string]interface{}{
			"doctorID": appointment.DoctorID.String(),
			"error":    err.Error(),
		})
		doctorData = &DoctorData{Phone: "77071234568"}
	}

	// ФИО врача
	doctorName := ""
	if doctorData != nil {
		if doctorData.FirstName != "" {
			doctorName = doctorData.FirstName
		}
		if doctorData.MiddleName != "" {
			if doctorName != "" {
				doctorName += " "
			}
			doctorName += doctorData.MiddleName
		}
		if doctorData.LastName != "" {
			if doctorName != "" {
				doctorName += " "
			}
			doctorName += doctorData.LastName
		}
	}
	if doctorName == "" {
		doctorName = "Врач"
	}

	patientName := "Пациент"

	event := &models.AppointmentBookedEvent{
		Type:            "appointment_booked",
		AppointmentID:   appointment.ID,
		PatientID:       patientUserID,
		DoctorID:        appointment.DoctorID,
		PatientPhone:    patientData.Phone,
		DoctorPhone:     doctorData.Phone,
		PatientName:     patientName,
		DoctorName:      doctorName,
		StartTime:       appointment.StartTime,
		EndTime:         appointment.EndTime,
		AppointmentType: appointment.AppointmentType,
		PatientNotes:    appointment.PatientNotes,
	}

	if err := s.messageService.PublishAppointmentBooked(context.Background(), event); err != nil {
		s.logError("Failed to publish appointment booked event", map[string]interface{}{
			"appointmentID": appointmentID.String(),
			"error":         err.Error(),
		})
	} else {
		s.logInfo("Appointment booked event published successfully", map[string]interface{}{
			"appointmentID": appointmentID.String(),
			"patientID":     patientUserID.String(),
			"doctorID":      appointment.DoctorID.String(),
		})
	}
}

func (s *appointmentService) BookAppointmentByDoctor(
	doctorID, appointmentID, patientUserID uuid.UUID,
	req *models.BookAppointmentByDoctorRequest,
) (*models.AppointmentResponse, error) {
	blocks := req.Blocks
	if blocks <= 0 {
		blocks = 1
	}

	dbProvider, ok := s.repo.(interface{ DB() *gorm.DB })
	if !ok {
		return nil, errors.New("repository does not support transactions")
	}

	appointment, err := s.repo.GetAppointmentByID(appointmentID)
	if err != nil {
		return nil, fmt.Errorf("appointment not found: %w", err)
	}

	if req.CabinetNumber != nil {
		appointment.CabinetNumber = req.CabinetNumber
	}
	if req.Channel != nil {
		ch := strings.ToLower(strings.TrimSpace(*req.Channel))
		if ch != "" {
			appointment.Channel = &ch
		}
	}
	if req.ServiceID != nil {
		sid := strings.TrimSpace(*req.ServiceID)
		if sid != "" {
			appointment.ServiceID = &sid
		}
	}

	// 2) Проверка доступности
	if !appointment.IsAvailable() {
		return nil, errors.New("appointment is not available")
	}

	// 3) Определяем тип приёма (учитываем slotType 'both')
	requestedType := strings.ToLower(strings.TrimSpace(req.AppointmentType))
	if requestedType == "" {
		if appointment.AppointmentType == "both" {
			requestedType = "offline" // по умолчанию
		} else {
			requestedType = appointment.AppointmentType
		}
	}

	// Совместимость запрошенного типа с типом слота
	if !s.isAppointmentTypeCompatible(appointment.AppointmentType, requestedType) {
		return nil, fmt.Errorf(
			"appointment type '%s' is not compatible with slot type '%s'",
			requestedType, appointment.AppointmentType,
		)
	}

	// 4) needMinutes (если нет — бронируем только один слот)
	needMinutes := 0
	if req.DurationMinutes != nil && *req.DurationMinutes > 0 {
		needMinutes = *req.DurationMinutes
	}

	// если не передали duration — старое поведение
	if needMinutes <= 0 {
		appointment.Book(patientUserID, requestedType, req.PatientNotes)
		if req.AnketaID != nil {
			appointment.AnketaID = req.AnketaID
		}

		if err := s.repo.UpdateAppointment(appointment); err != nil {
			return nil, fmt.Errorf("failed to book appointment: %w", err)
		}

		s.publishBookedEventBestEffort(appointmentID, patientUserID, appointment)
		return s.appointmentToResponse(appointment), nil
	}

	// ✅ НОВОЕ: бронирование диапазона по длительности услуги
	start := appointment.StartTime
	end := start.Add(time.Duration(needMinutes) * time.Minute)

	var bookedBase *models.Appointment

	// Одна транзакция, внутри только ошибки
	txErr := dbProvider.DB().Transaction(func(tx *gorm.DB) error {

		// Лочим слоты врача в диапазоне
		var slots []*models.Appointment
		if err := tx.
			Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("doctor_id = ? AND start_time >= ? AND end_time <= ?", appointment.DoctorID, start, end).
			Order("start_time ASC").
			Find(&slots).Error; err != nil {
			return err
		}

		if len(slots) == 0 {
			return fmt.Errorf("no slots in range")
		}

		// Проверяем непрерывность и доступность
		cur := start
		for _, sl := range slots {
			if !sl.IsAvailable() {
				return fmt.Errorf("some slot is not available")
			}
			if !sl.StartTime.Equal(cur) {
				return fmt.Errorf("slots are not contiguous")
			}
			cur = sl.EndTime
		}
		if cur.Before(end) {
			return fmt.Errorf("not enough free time for requested duration")
		}

		// 1-й слот — booked
		slots[0].CabinetNumber = appointment.CabinetNumber
		slots[0].Channel = appointment.Channel
		slots[0].ServiceID = appointment.ServiceID

		slots[0].Book(patientUserID, requestedType, req.PatientNotes)
		if req.AnketaID != nil {
			slots[0].AnketaID = req.AnketaID
		}

		if err := tx.Save(slots[0]).Error; err != nil {
			return err
		}

		// остальные — blocked
		for i := 1; i < len(slots); i++ {
			slots[i].Status = "blocked"
			slots[i].PatientID = &patientUserID

			slots[i].CabinetNumber = appointment.CabinetNumber
			slots[i].Channel = appointment.Channel
			slots[i].ServiceID = appointment.ServiceID

			if strings.TrimSpace(slots[i].Title) == "" {
				slots[i].Title = "Занято (продолжение)"
			}

			if err := tx.Save(slots[i]).Error; err != nil {
				return err
			}
		}

		bookedBase = slots[0]
		return nil
	})

	if txErr != nil {
		return nil, fmt.Errorf("failed to book appointment range: %w", txErr)
	}

	// событие после транзакции
	s.publishBookedEventBestEffort(appointmentID, patientUserID, bookedBase)

	return s.appointmentToResponse(bookedBase), nil
}
