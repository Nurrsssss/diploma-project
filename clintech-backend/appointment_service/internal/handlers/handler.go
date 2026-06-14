package handlers

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"

	"github.com/printprince/vitalem/appointment_service/internal/models"
	"github.com/printprince/vitalem/appointment_service/internal/service"
	"github.com/printprince/vitalem/logger_service/pkg/logger"
)

// AppointmentHandler - обработчик HTTP запросов
type AppointmentHandler struct {
	service service.AppointmentService
	logger  *logger.Client
}

// NewAppointmentHandler - создание нового обработчика
func NewAppointmentHandler(service service.AppointmentService) *AppointmentHandler {
	return &AppointmentHandler{service: service}
}

// SetLogger - устанавливает логгер для хендлера
func (h *AppointmentHandler) SetLogger(loggerClient *logger.Client) {
	h.logger = loggerClient
}

// logInfo - вспомогательный метод для информационного логирования
func (h *AppointmentHandler) logInfo(message string, metadata map[string]interface{}) {
	if h.logger != nil {
		h.logger.Info(message, metadata)
	}
}

// logError - вспомогательный метод для логирования ошибок
func (h *AppointmentHandler) logError(message string, metadata map[string]interface{}) {
	if h.logger != nil {
		h.logger.Error(message, metadata)
	}
}

// ===== helpers for token extraction =====

func getTokenUUID(c echo.Context) (uuid.UUID, bool) {
	if v, ok := c.Get("user_id").(uuid.UUID); ok {
		return v, true
	}
	// иногда middleware кладет строкой
	if s, ok := c.Get("user_id").(string); ok {
		s = strings.TrimSpace(s)
		if s == "" {
			return uuid.Nil, false
		}
		uid, err := uuid.Parse(s)
		if err != nil {
			return uuid.Nil, false
		}
		return uid, true
	}
	return uuid.Nil, false
}

func getRole(c echo.Context) string {
	role, _ := c.Get("role").(string)
	role = strings.TrimSpace(role)
	return role
}

func getDoctorFromQueryOrBody(c echo.Context, bodyDoctor string) string {
	qDoctor := strings.TrimSpace(c.QueryParam("doctor_user_id"))
	if qDoctor == "" {
		qDoctor = strings.TrimSpace(c.QueryParam("specialist_id"))
	}
	if qDoctor == "" {
		qDoctor = strings.TrimSpace(bodyDoctor)
	}
	return qDoctor
}
func resolveTargetDoctorUUIDForView(role string, rawID string) (uuid.UUID, error) {
	role = strings.TrimSpace(role)
	rawID = strings.TrimSpace(rawID)

	if rawID == "" {
		return uuid.Nil, echo.NewHTTPError(http.StatusBadRequest, "doctor id is required")
	}

	switch role {
	case "doctor", "reception":
		parsed, err := uuid.Parse(rawID)
		if err != nil {
			return uuid.Nil, echo.NewHTTPError(http.StatusBadRequest, "invalid doctor id")
		}
		return parsed, nil
	case "patient":
		parsed, err := uuid.Parse(rawID)
		if err != nil {
			return uuid.Nil, echo.NewHTTPError(http.StatusBadRequest, "invalid doctor id")
		}
		return parsed, nil
	default:
		return uuid.Nil, echo.NewHTTPError(http.StatusForbidden, "Insufficient permissions")
	}
}

// resolveTargetDoctorUUID:
// - doctor работает только со своим user_id из токена
// - reception обязан передать doctor_user_id/specialist_id (target врача)
func resolveTargetDoctorUUID(role string, tokenUserID uuid.UUID, qDoctor string, bodyDoctor string) (uuid.UUID, error) {
	role = strings.TrimSpace(role)

	if role == "doctor" {
		return tokenUserID, nil
	}

	if role == "reception" {
		target := strings.TrimSpace(qDoctor)
		if target == "" {
			target = strings.TrimSpace(bodyDoctor)
		}
		if target == "" {
			return uuid.Nil, echo.NewHTTPError(http.StatusForbidden, "doctor_user_id is required for reception")
		}

		parsed, err := uuid.Parse(target)
		if err != nil {
			return uuid.Nil, echo.NewHTTPError(http.StatusBadRequest, "invalid doctor_user_id")
		}
		return parsed, nil
	}

	return uuid.Nil, echo.NewHTTPError(http.StatusForbidden, "Insufficient permissions")
}

// === SCHEDULE ENDPOINTS ===

// CreateSchedule - POST /api/doctor/schedules
func (h *AppointmentHandler) CreateSchedule(c echo.Context) error {
	role := getRole(c)

	tokenUserID, ok := getTokenUUID(c)
	if !ok {
		return c.JSON(http.StatusUnauthorized, models.APIResponse{Success: false, Error: "Invalid user ID in token"})
	}

	var req models.CreateScheduleRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: "Invalid request body"})
	}
	if err := c.Validate(&req); err != nil {
		return c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: err.Error()})
	}

	// doctor id из query/body (если надо)
	qDoctor := strings.TrimSpace(c.QueryParam("doctor_user_id"))
	if qDoctor == "" {
		qDoctor = strings.TrimSpace(c.QueryParam("specialist_id"))
	}
	targetDoctorID, err := resolveTargetDoctorUUID(role, tokenUserID, qDoctor, "")
	if err != nil {
		return err
	}

	resp, serviceErr := h.service.CreateSchedule(targetDoctorID, &req)
	if serviceErr != nil {
		return c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: serviceErr.Error()})
	}

	return c.JSON(http.StatusCreated, models.APIResponse{Success: true, Data: resp})
}

// GetDoctorSchedules - GET /api/doctor/schedules
func (h *AppointmentHandler) GetDoctorSchedules(c echo.Context) error {
	role := getRole(c)

	tokenUserID, ok := getTokenUUID(c)
	if !ok {
		return c.JSON(http.StatusUnauthorized, models.APIResponse{Success: false, Error: "Invalid user ID in token"})
	}
	qDoctor := strings.TrimSpace(c.QueryParam("doctor_user_id"))
	if qDoctor == "" {
		qDoctor = strings.TrimSpace(c.QueryParam("specialist_id"))
	}

	targetDoctorID, err := resolveTargetDoctorUUID(role, tokenUserID, qDoctor, "")
	if err != nil {
		return err
	}

	schedules, serviceErr := h.service.GetDoctorSchedules(targetDoctorID)
	if serviceErr != nil {
		return c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: serviceErr.Error()})
	}

	return c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: schedules})
}

// UpdateSchedule - PUT /api/doctor/schedules/:id
func (h *AppointmentHandler) UpdateSchedule(c echo.Context) error {
	role := getRole(c)

	tokenUserID, ok := getTokenUUID(c)
	if !ok {
		return c.JSON(http.StatusUnauthorized, models.APIResponse{Success: false, Error: "Invalid user ID in token"})
	}

	scheduleID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: "Invalid schedule id"})
	}

	var req models.UpdateScheduleRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: "Invalid request body"})
	}
	if err := c.Validate(&req); err != nil {
		return c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: err.Error()})
	}
	qDoctor := strings.TrimSpace(c.QueryParam("doctor_user_id"))
	if qDoctor == "" {
		qDoctor = strings.TrimSpace(c.QueryParam("specialist_id"))
	}

	targetDoctorID, err := resolveTargetDoctorUUID(role, tokenUserID, qDoctor, "")
	if err != nil {
		return err
	}

	resp, serviceErr := h.service.UpdateSchedule(targetDoctorID, scheduleID, &req)
	if serviceErr != nil {
		return c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: serviceErr.Error()})
	}

	return c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: resp})
}

func (h *AppointmentHandler) DeleteSchedule(c echo.Context) error {
	role := getRole(c)

	tokenUserID, ok := getTokenUUID(c)
	if !ok {
		return c.JSON(http.StatusUnauthorized, models.APIResponse{Success: false, Error: "Invalid user ID in token"})
	}

	scheduleID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: "Invalid schedule id"})
	}
	qDoctor := strings.TrimSpace(c.QueryParam("doctor_user_id"))
	if qDoctor == "" {
		qDoctor = strings.TrimSpace(c.QueryParam("specialist_id"))
	}

	targetDoctorID, err := resolveTargetDoctorUUID(role, tokenUserID, qDoctor, "")
	if err != nil {
		return err
	}

	if serviceErr := h.service.DeleteSchedule(targetDoctorID, scheduleID); serviceErr != nil {
		return c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: serviceErr.Error()})
	}

	return c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: "deleted"})
}

func (h *AppointmentHandler) ToggleSchedule(c echo.Context) error {
	role := getRole(c)

	tokenUserID, ok := getTokenUUID(c)
	if !ok {
		return c.JSON(http.StatusUnauthorized, models.APIResponse{Success: false, Error: "Invalid user ID in token"})
	}

	scheduleID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: "Invalid schedule id"})
	}

	qDoctor := strings.TrimSpace(c.QueryParam("doctor_user_id"))
	if qDoctor == "" {
		qDoctor = strings.TrimSpace(c.QueryParam("specialist_id"))
	}
	targetDoctorID, err := resolveTargetDoctorUUID(role, tokenUserID, qDoctor, "")

	if err != nil {
		return err
	}

	hasBody := c.Request().ContentLength > 0
	var req models.ToggleScheduleRequest
	if hasBody {
		if err := c.Bind(&req); err != nil {
			return c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: "Invalid request body"})
		}
	}

	resp, serviceErr := h.service.ToggleSchedule(targetDoctorID, scheduleID, &req, hasBody)
	if serviceErr != nil {
		return c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: serviceErr.Error()})
	}

	return c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: resp})
}

// GenerateSlots - POST /api/doctor/schedules/:id/generate-slots
func (h *AppointmentHandler) GenerateSlots(c echo.Context) error {
	role := getRole(c)

	tokenUserID, ok := getTokenUUID(c)
	if !ok {
		return c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Error:   "Invalid user ID in token",
		})
	}

	scheduleID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Error:   "Invalid schedule ID",
		})
	}

	var req models.GenerateSlotsRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Error:   "Invalid request body",
		})
	}
	if err := c.Validate(&req); err != nil {
		return c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Error:   err.Error(),
		})
	}
	qDoctor := strings.TrimSpace(c.QueryParam("doctor_user_id"))
	if qDoctor == "" {
		qDoctor = strings.TrimSpace(c.QueryParam("specialist_id"))
	}

	// важно: генерим слоты для целевого врача
	targetDoctorID, err := resolveTargetDoctorUUID(role, tokenUserID, qDoctor, "")
	if err != nil {
		return err
	}

	response, err := h.service.GenerateSlots(targetDoctorID, scheduleID, &req)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Error:   err.Error(),
		})
	}

	return c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    response,
	})
}

// DeleteScheduleSlots - DELETE /api/doctor/schedules/:id/slots
func (h *AppointmentHandler) DeleteScheduleSlots(c echo.Context) error {
	role := getRole(c)

	tokenUserID, ok := getTokenUUID(c)
	if !ok {
		return c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Error:   "Invalid user ID in token",
		})
	}

	scheduleID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Error:   "Invalid schedule ID",
		})
	}
	qDoctor := strings.TrimSpace(c.QueryParam("doctor_user_id"))
	if qDoctor == "" {
		qDoctor = strings.TrimSpace(c.QueryParam("specialist_id"))
	}

	targetDoctorID, err := resolveTargetDoctorUUID(role, tokenUserID, qDoctor, "")
	if err != nil {
		return err
	}

	if err := h.service.DeleteScheduleSlots(targetDoctorID, scheduleID); err != nil {
		return c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Error:   err.Error(),
		})
	}

	return c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    "Schedule slots deleted successfully",
	})
}

// GetGeneratedSlots - GET /api/doctor/schedules/:id/generated-slots
func (h *AppointmentHandler) GetGeneratedSlots(c echo.Context) error {
	role := getRole(c)

	tokenUserID, ok := getTokenUUID(c)
	if !ok {
		h.logError("Failed to get user ID from context", map[string]interface{}{
			"endpoint": "GetGeneratedSlots",
		})
		return echo.NewHTTPError(http.StatusUnauthorized, "Unauthorized")
	}

	scheduleID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		h.logError("Invalid schedule ID format", map[string]interface{}{
			"endpoint":   "GetGeneratedSlots",
			"scheduleID": c.Param("id"),
			"error":      err.Error(),
		})
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid schedule ID format")
	}

	startDate := c.QueryParam("start_date")
	endDate := c.QueryParam("end_date")
	if startDate == "" || endDate == "" {
		h.logError("Missing required query parameters", map[string]interface{}{
			"endpoint":   "GetGeneratedSlots",
			"scheduleID": scheduleID.String(),
			"startDate":  startDate,
			"endDate":    endDate,
		})
		return echo.NewHTTPError(http.StatusBadRequest, "start_date and end_date parameters are required")
	}
	if len(startDate) != 10 || len(endDate) != 10 {
		h.logError("Invalid date format", map[string]interface{}{
			"endpoint":   "GetGeneratedSlots",
			"scheduleID": scheduleID.String(),
			"startDate":  startDate,
			"endDate":    endDate,
		})
		return echo.NewHTTPError(http.StatusBadRequest, "Date format should be YYYY-MM-DD")
	}
	qDoctor := strings.TrimSpace(c.QueryParam("doctor_user_id"))
	if qDoctor == "" {
		qDoctor = strings.TrimSpace(c.QueryParam("specialist_id"))
	}

	targetDoctorID, err := resolveTargetDoctorUUID(role, tokenUserID, qDoctor, "")
	if err != nil {
		return err
	}

	h.logInfo("Getting generated slots", map[string]interface{}{
		"endpoint":   "GetGeneratedSlots",
		"doctorID":   targetDoctorID.String(),
		"scheduleID": scheduleID.String(),
		"startDate":  startDate,
		"endDate":    endDate,
	})

	response, err := h.service.GetGeneratedSlots(targetDoctorID, scheduleID, startDate, endDate)
	if err != nil {
		h.logError("Failed to get generated slots", map[string]interface{}{
			"endpoint":   "GetGeneratedSlots",
			"doctorID":   targetDoctorID.String(),
			"scheduleID": scheduleID.String(),
			"startDate":  startDate,
			"endDate":    endDate,
			"error":      err.Error(),
		})
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	h.logInfo("Generated slots retrieved successfully", map[string]interface{}{
		"endpoint":       "GetGeneratedSlots",
		"doctorID":       targetDoctorID.String(),
		"scheduleID":     scheduleID.String(),
		"totalSlots":     response.Summary.TotalSlots,
		"availableSlots": response.Summary.AvailableSlots,
		"bookedSlots":    response.Summary.BookedSlots,
	})

	return c.JSON(http.StatusOK, &models.APIResponse{
		Success: true,
		Data:    response,
	})
}

// ВАЖНО: clinicLoc() уже должна возвращать Asia/Almaty
func clinicLocation() *time.Location {
	// Asia/Almaty фиксированно для клиники
	loc, err := time.LoadLocation("Asia/Almaty")
	if err != nil {
		return time.FixedZone("Asia/Almaty", 5*60*60)
	}
	return loc
}

func parseClinicDate(dateStr string) (time.Time, error) {
	// ожидаем YYYY-MM-DD
	loc := clinicLocation()
	d, err := time.ParseInLocation("2006-01-02", dateStr, loc)
	if err != nil {
		return time.Time{}, err
	}
	// нормализуем в полночь TZ клиники
	return time.Date(d.Year(), d.Month(), d.Day(), 0, 0, 0, 0, loc), nil
}

func normalizeAppointmentsToClinicTZ(appts []*models.Appointment) {
	loc := clinicLocation()
	for _, a := range appts {
		if a == nil {
			continue
		}
		// ВАЖНО: названия полей должны совпасть с твоей моделью Appointment
		// Обычно это StartTime / EndTime
		a.StartTime = a.StartTime.In(loc)
		a.EndTime = a.EndTime.In(loc)
	}
}

func normalizeAvailableSlotsToClinicTZ(slots []*models.AvailableSlot) {
	loc, err := time.LoadLocation("Asia/Almaty")
	if err != nil {
		loc = time.FixedZone("Asia/Almaty", 5*60*60)
	}

	for _, s := range slots {
		if s == nil {
			continue
		}

		// поменяй названия полей на реальные из твоей структуры
		s.StartTime = s.StartTime.In(loc)
		s.EndTime = s.EndTime.In(loc)
	}
}
func (h *AppointmentHandler) GetAvailableSlots(c echo.Context) error {
	role := getRole(c)

	_, ok := getTokenUUID(c)
	if !ok {
		return c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Error:   "Invalid user ID in token",
		})
	}

	// id в пути = выбранный врач
	rawID := strings.TrimSpace(c.Param("id"))
	if rawID == "" {
		return c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Error:   "doctor id is required",
		})
	}

	// Для ПРОСМОТРА расписания doctor/reception должны видеть выбранного врача,
	// а не только врача из токена.
	targetDoctorID, err := resolveTargetDoctorUUIDForView(role, rawID)
	if err != nil {
		if httpErr, ok := err.(*echo.HTTPError); ok {
			msg, _ := httpErr.Message.(string)
			if msg == "" {
				msg = "Invalid doctor ID"
			}
			return c.JSON(httpErr.Code, models.APIResponse{
				Success: false,
				Error:   msg,
			})
		}

		return c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Error:   "Invalid doctor ID",
		})
	}

	// даты: либо date, либо start_date + end_date
	date := strings.TrimSpace(c.QueryParam("date"))
	startDate := strings.TrimSpace(c.QueryParam("start_date"))
	endDate := strings.TrimSpace(c.QueryParam("end_date"))

	if date != "" {
		startDate, endDate = date, date
	}

	if startDate == "" || endDate == "" {
		return c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Error:   "date or start_date and end_date are required",
		})
	}
	if len(startDate) != 10 || len(endDate) != 10 {
		return c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Error:   "Date format should be YYYY-MM-DD",
		})
	}

	// флаги
	includeBooked := c.QueryParam("include_booked") == "1"
	includeCancelled := c.QueryParam("include_cancelled") == "1"
	includeAll := c.QueryParam("include_all") == "1" || c.QueryParam("all") == "1" || includeBooked || includeCancelled

	// includeAll -> отдаём статусы (available + booked/blocked/cancelled)
	if includeAll {
		resp, err := h.service.GetSlotsWithStatuses(targetDoctorID, startDate, endDate)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, models.APIResponse{
				Success: false,
				Error:   err.Error(),
			})
		}

		return c.JSON(http.StatusOK, models.APIResponse{
			Success: true,
			Data:    resp,
		})
	}

	// Только available
	slots, err := h.service.GetAvailableSlots(targetDoctorID, startDate)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Error:   err.Error(),
		})
	}

	normalizeAvailableSlotsToClinicTZ(slots)

	return c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    slots,
	})
}

// BookAppointment - POST /api/appointments/:id/book
func (h *AppointmentHandler) BookAppointment(c echo.Context) error {
	userID, ok := getTokenUUID(c)
	if !ok {
		return c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Error:   "Invalid user ID in token",
		})
	}

	role := getRole(c)
	if role != "patient" {
		return c.JSON(http.StatusForbidden, models.APIResponse{
			Success: false,
			Error:   "Only patients can book appointments",
		})
	}

	appointmentID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Error:   "Invalid appointment ID",
		})
	}

	var req models.BookAppointmentRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Error:   "Invalid request body",
		})
	}
	if err := c.Validate(&req); err != nil {
		return c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Error:   err.Error(),
		})
	}

	appointment, err := h.service.BookAppointment(userID, appointmentID, &req)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Error:   err.Error(),
		})
	}

	return c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    appointment,
	})
}

// CancelAppointment - POST /api/patient/appointments/:id/cancel
func (h *AppointmentHandler) CancelAppointment(c echo.Context) error {
	userID, ok := getTokenUUID(c)
	if !ok {
		return c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Error:   "Invalid user ID in token",
		})
	}

	appointmentID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Error:   "Invalid appointment ID",
		})
	}

	if err := h.service.CancelAppointment(userID, appointmentID); err != nil {
		return c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Error:   err.Error(),
		})
	}

	return c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    "Appointment canceled successfully",
	})
}

// CancelAppointmentByDoctor - POST /api/doctor/appointments/:id/cancel-by-doctor
func (h *AppointmentHandler) CancelAppointmentByDoctor(c echo.Context) error {
	doctorID, ok := getTokenUUID(c)
	if !ok {
		return c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Error:   "Invalid user ID in token",
		})
	}

	role := getRole(c)
	if role != "doctor" && role != "reception" {
		return c.JSON(http.StatusForbidden, models.APIResponse{
			Success: false,
			Error:   "Only doctors can cancel appointments",
		})
	}

	appointmentID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Error:   "Invalid appointment ID",
		})
	}

	if err := h.service.CancelAppointmentByDoctor(doctorID, appointmentID); err != nil {
		return c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Error:   err.Error(),
		})
	}

	return c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    "Appointment canceled successfully",
	})
}

// UpdateAppointment - PUT /api/doctor/appointments/:id
func (h *AppointmentHandler) UpdateAppointment(c echo.Context) error {
	userID, ok := getTokenUUID(c)
	if !ok {
		return c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Error:   "Invalid user ID in token",
		})
	}

	appointmentID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Error:   "Invalid appointment ID",
		})
	}

	var req models.UpdateAppointmentRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Error:   "Invalid request body",
		})
	}
	if err := c.Validate(&req); err != nil {
		return c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Error:   err.Error(),
		})
	}

	appointment, err := h.service.UpdateAppointment(userID, appointmentID, &req)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Error:   err.Error(),
		})
	}

	return c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    appointment,
	})
}

// GetDoctorAppointments - GET /api/doctor/appointments
func (h *AppointmentHandler) GetDoctorAppointments(c echo.Context) error {
	userID, ok := getTokenUUID(c)
	if !ok {
		return c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Error:   "Invalid user ID in token",
		})
	}

	appointments, err := h.service.GetDoctorAppointments(userID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Error:   err.Error(),
		})
	}

	return c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    appointments,
	})
}

// GetDoctorAppointmentByID - GET /api/doctor/appointments/:id
func (h *AppointmentHandler) GetDoctorAppointmentByID(c echo.Context) error {
	userID, ok := getTokenUUID(c)
	if !ok {
		h.logError("Invalid user ID in token", map[string]interface{}{
			"endpoint": "GetDoctorAppointmentByID",
		})
		return c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Error:   "Invalid user ID in token",
		})
	}

	userRole := getRole(c)
	if userRole == "" {
		userRole = "doctor"
	}

	appointmentID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		h.logError("Invalid appointment ID", map[string]interface{}{
			"endpoint":      "GetDoctorAppointmentByID",
			"userID":        userID.String(),
			"appointmentID": c.Param("id"),
			"error":         err.Error(),
		})
		return c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Error:   "Invalid appointment ID",
		})
	}

	h.logInfo("Getting appointment by ID", map[string]interface{}{
		"endpoint":      "GetDoctorAppointmentByID",
		"userID":        userID.String(),
		"userRole":      userRole,
		"appointmentID": appointmentID.String(),
	})

	appointment, err := h.service.GetAppointmentByIDForRole(userID, userRole, appointmentID)
	if err != nil {
		h.logError("Failed to get appointment", map[string]interface{}{
			"endpoint":      "GetDoctorAppointmentByID",
			"userID":        userID.String(),
			"userRole":      userRole,
			"appointmentID": appointmentID.String(),
			"error":         err.Error(),
		})

		if err.Error() == "appointment doesn't belong to this doctor" ||
			err.Error() == "appointment doesn't belong to this patient" ||
			err.Error() == "forbidden" {
			return c.JSON(http.StatusForbidden, models.APIResponse{
				Success: false,
				Error:   err.Error(),
			})
		}

		return c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Error:   err.Error(),
		})
	}

	h.logInfo("Appointment retrieved successfully", map[string]interface{}{
		"endpoint":      "GetDoctorAppointmentByID",
		"userID":        userID.String(),
		"userRole":      userRole,
		"appointmentID": appointmentID.String(),
		"status":        appointment.Status,
	})

	return c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    appointment,
	})
}
func (h *AppointmentHandler) DeleteAppointment(c echo.Context) error {
	userID, ok := getTokenUUID(c)
	if !ok {
		h.logError("Invalid user ID in token", map[string]interface{}{
			"endpoint": "DeleteAppointment",
		})
		return c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Error:   "Invalid user ID in token",
		})
	}

	appointmentIDStr := c.Param("id")
	appointmentID, err := uuid.Parse(appointmentIDStr)
	if err != nil {
		h.logError("Invalid appointment ID", map[string]interface{}{
			"endpoint":      "DeleteAppointment",
			"userID":        userID.String(),
			"appointmentID": appointmentIDStr,
			"error":         err.Error(),
		})
		return c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Error:   "Invalid appointment ID",
		})
	}

	// ВАЖНО:
	// здесь нужно вызвать ТУ ЖЕ зависимость, которую ты уже используешь
	// в CancelAppointment / RescheduleAppointment.
	// Например:
	// err = h.<твое_реальное_поле>.DeleteAppointment(appointmentID, userID)

	if err != nil {
		h.logError("Failed to delete appointment", map[string]interface{}{
			"endpoint":      "DeleteAppointment",
			"userID":        userID.String(),
			"appointmentID": appointmentID.String(),
			"error":         err.Error(),
		})
		return c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Error:   err.Error(),
		})
	}

	return c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
	})
}
func (h *AppointmentHandler) GetAppointmentByIDForRole(c echo.Context) error {
	userID, ok := getTokenUUID(c)
	if !ok {
		return c.JSON(http.StatusUnauthorized, models.APIResponse{Success: false, Error: "Invalid user ID in token"})
	}
	role := getRole(c)

	appointmentID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: "Invalid appointment ID"})
	}

	appt, err := h.service.GetAppointmentByIDForRole(userID, role, appointmentID)
	if err != nil {
		return c.JSON(http.StatusForbidden, models.APIResponse{Success: false, Error: err.Error()})
	}

	return c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: appt})
}

// GetPatientAppointments - GET /api/patient/appointments
func (h *AppointmentHandler) GetPatientAppointments(c echo.Context) error {
	userID, ok := getTokenUUID(c)
	if !ok {
		return c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Error:   "Invalid user ID in token",
		})
	}

	appointments, err := h.service.GetPatientAppointments(userID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Error:   err.Error(),
		})
	}

	return c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    appointments,
	})
}

// GetPatientAppointmentByID - GET /api/patient/appointments/:id
func (h *AppointmentHandler) GetPatientAppointmentByID(c echo.Context) error {
	userID, ok := getTokenUUID(c)
	if !ok {
		h.logError("Invalid user ID in token", map[string]interface{}{
			"endpoint": "GetPatientAppointmentByID",
		})
		return c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Error:   "Invalid user ID in token",
		})
	}

	appointmentID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		h.logError("Invalid appointment ID", map[string]interface{}{
			"endpoint":      "GetPatientAppointmentByID",
			"userID":        userID.String(),
			"appointmentID": c.Param("id"),
			"error":         err.Error(),
		})
		return c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Error:   "Invalid appointment ID",
		})
	}

	h.logInfo("Getting appointment by ID", map[string]interface{}{
		"endpoint":      "GetPatientAppointmentByID",
		"userID":        userID.String(),
		"appointmentID": appointmentID.String(),
	})

	appointment, err := h.service.GetPatientAppointmentByID(userID, appointmentID)
	if err != nil {
		h.logError("Failed to get appointment", map[string]interface{}{
			"endpoint":      "GetPatientAppointmentByID",
			"userID":        userID.String(),
			"appointmentID": appointmentID.String(),
			"error":         err.Error(),
		})
		return c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Error:   err.Error(),
		})
	}

	h.logInfo("Appointment retrieved successfully", map[string]interface{}{
		"endpoint":      "GetPatientAppointmentByID",
		"userID":        userID.String(),
		"appointmentID": appointmentID.String(),
		"status":        appointment.Status,
	})

	return c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    appointment,
	})
}

// === EXCEPTION ENDPOINTS ===

// AddException - POST /appointments/exceptions
func (h *AppointmentHandler) AddException(c echo.Context) error {
	role := getRole(c)

	// token user id может быть string/uuid.UUID — нормализуем в string
	tokenUUID, ok := getTokenUUID(c)
	if !ok {
		return c.JSON(http.StatusUnauthorized, models.APIResponse{Success: false, Error: "Invalid user ID in token"})
	}
	tokenUserID := tokenUUID.String()

	var req models.AddExceptionRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: "Invalid request body"})
	}
	if err := c.Validate(&req); err != nil {
		return c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: err.Error()})
	}

	if req.Type == "closed_hours" {
		req.Type = "custom_hours"
	}

	bodyDoctor := req.DoctorUserID
	if bodyDoctor == "" {
		bodyDoctor = req.SpecialistID
	}
	targetDoctorUserID, err := resolveTargetDoctorUserID(role, tokenUserID, getDoctorFromQueryOrBody(c, ""), bodyDoctor)
	if err != nil {
		return c.JSON(http.StatusForbidden, models.APIResponse{Success: false, Error: "Insufficient permissions"})
	}

	req.DoctorUserID = targetDoctorUserID
	req.SpecialistID = targetDoctorUserID

	doctorUUID, err := uuid.Parse(targetDoctorUserID)
	if err != nil {
		return c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: "Invalid doctor_user_id"})
	}

	// Диапазон дат
	if req.Start != "" && req.End != "" {
		start, err := time.Parse("2006-01-02", req.Start)
		if err != nil {
			return c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: "invalid start"})
		}
		end, err := time.Parse("2006-01-02", req.End)
		if err != nil {
			return c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: "invalid end"})
		}
		if end.Before(start) {
			return c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: "end before start"})
		}

		var created []models.ExceptionResponse
		for d := start; !d.After(end); d = d.AddDate(0, 0, 1) {
			payload := &models.AddExceptionRequest{
				DoctorUserID:    targetDoctorUserID,
				SpecialistID:    targetDoctorUserID,
				Date:            d.Format("2006-01-02"),
				Type:            req.Type,
				CustomStartTime: req.CustomStartTime,
				CustomEndTime:   req.CustomEndTime,
				Reason:          req.Reason,
			}

			exc, err := h.service.AddException(doctorUUID, payload)
			if err != nil {
				return c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
			}
			created = append(created, *exc)
		}
		return c.JSON(http.StatusCreated, models.APIResponse{Success: true, Data: created})
	}

	// Одиночная дата
	if req.Date == "" {
		return c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: "date or start/end required"})
	}

	exception, err := h.service.AddException(doctorUUID, &req)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
	}
	return c.JSON(http.StatusCreated, models.APIResponse{Success: true, Data: exception})
}

func (h *AppointmentHandler) GetDoctorExceptions(c echo.Context) error {
	role := getRole(c)

	tokenUUID, ok := getTokenUUID(c)
	if !ok {
		return c.JSON(http.StatusUnauthorized, models.APIResponse{Success: false, Error: "Invalid user ID in token"})
	}
	tokenUserID := tokenUUID.String()

	startDate := c.QueryParam("start_date")
	endDate := c.QueryParam("end_date")
	if startDate == "" || endDate == "" {
		return c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: "start_date and end_date parameters are required"})
	}

	qDoctor := getDoctorFromQueryOrBody(c, "")
	targetDoctorUserID, err := resolveTargetDoctorUserID(role, tokenUserID, qDoctor, "")
	if err != nil {
		return c.JSON(http.StatusForbidden, models.APIResponse{Success: false, Error: "Insufficient permissions"})
	}

	doctorUUID, err := uuid.Parse(targetDoctorUserID)
	if err != nil {
		return c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: "Invalid doctor_user_id"})
	}

	exceptions, err := h.service.GetDoctorExceptions(doctorUUID, startDate, endDate)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
	}
	return c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: exceptions})
}

// DeleteException - DELETE /appointments/exceptions/:id
func (h *AppointmentHandler) DeleteException(c echo.Context) error {
	userID, ok := getTokenUUID(c)
	if !ok {
		return c.JSON(http.StatusUnauthorized, models.APIResponse{Success: false, Error: "Invalid user ID in token"})
	}
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: "invalid id"})
	}
	if err := h.service.DeleteException(userID, id); err != nil {
		return c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
	}
	return c.JSON(http.StatusOK, models.APIResponse{Success: true})
}

// === HEALTH CHECK ===

// HealthCheck - GET /health
func (h *AppointmentHandler) HealthCheck(c echo.Context) error {
	return c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    "Appointment Service is running",
	})
}

// resolveTargetDoctorUserID:
// - doctor работает только со своим user_id из токена
// - reception обязан передать doctor_user_id/specialist_id (target врача)
func resolveTargetDoctorUserID(role string, tokenUserID string, fromQuery string, fromBody string) (string, error) {
	role = strings.TrimSpace(role)
	tokenUserID = strings.TrimSpace(tokenUserID)

	if role == "doctor" {
		if tokenUserID == "" {
			return "", fmt.Errorf("empty token user_id")
		}
		return tokenUserID, nil
	}

	if role == "reception" {
		id := strings.TrimSpace(fromQuery)
		if id == "" {
			id = strings.TrimSpace(fromBody)
		}
		if id == "" {
			return "", fmt.Errorf("doctor_user_id (or specialist_id) is required for reception")
		}
		return id, nil
	}

	return "", fmt.Errorf("insufficient permissions")
}

// RescheduleAppointment - POST /appointments/:id/reschedule
func (h *AppointmentHandler) RescheduleAppointment(c echo.Context) error {
	userID, ok := getTokenUUID(c)
	if !ok {
		h.logError("Invalid user ID in token", map[string]interface{}{
			"endpoint": "RescheduleAppointment",
		})
		return c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Error:   "Invalid user ID in token",
		})
	}

	role := getRole(c)

	appointmentIDStr := c.Param("id")
	appointmentID, err := uuid.Parse(appointmentIDStr)
	if err != nil {
		h.logError("Invalid appointment ID", map[string]interface{}{
			"endpoint":      "RescheduleAppointment",
			"userID":        userID.String(),
			"appointmentID": appointmentIDStr,
			"error":         err.Error(),
		})
		return c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Error:   "Invalid appointment ID",
		})
	}

	var req models.RescheduleAppointmentRequest
	if err := c.Bind(&req); err != nil {
		h.logError("Invalid request body", map[string]interface{}{
			"endpoint":      "RescheduleAppointment",
			"userID":        userID.String(),
			"appointmentID": appointmentID.String(),
			"error":         err.Error(),
		})
		return c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Error:   "Invalid request body",
		})
	}
	if err := c.Validate(&req); err != nil {
		h.logError("Validation error", map[string]interface{}{
			"endpoint":      "RescheduleAppointment",
			"userID":        userID.String(),
			"appointmentID": appointmentID.String(),
			"error":         err.Error(),
		})
		return c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Error:   err.Error(),
		})
	}

	h.logInfo("Rescheduling appointment", map[string]interface{}{
		"endpoint":      "RescheduleAppointment",
		"userID":        userID.String(),
		"role":          role,
		"appointmentID": appointmentID.String(),
		"targetSlotID":  req.TargetSlotID.String(),
	})

	response, err := h.service.RescheduleAppointmentForRole(userID, role, appointmentID, req.TargetSlotID, req.Reason)
	if err != nil {
		h.logError("Failed to reschedule appointment", map[string]interface{}{
			"endpoint":      "RescheduleAppointment",
			"userID":        userID.String(),
			"role":          role,
			"appointmentID": appointmentID.String(),
			"error":         err.Error(),
		})

		return c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Error:   err.Error(),
		})
	}

	return c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    response,
	})
}

// CompleteAppointment - POST /appointments/:id/complete
func (h *AppointmentHandler) CompleteAppointment(c echo.Context) error {
	userID, ok := getTokenUUID(c)
	if !ok {
		h.logError("Invalid user ID in token", map[string]interface{}{
			"endpoint": "CompleteAppointment",
		})
		return c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Error:   "Invalid user ID in token",
		})
	}

	appointmentIDStr := c.Param("id")
	appointmentID, err := uuid.Parse(appointmentIDStr)
	if err != nil {
		h.logError("Invalid appointment ID", map[string]interface{}{
			"endpoint":      "CompleteAppointment",
			"userID":        userID.String(),
			"appointmentID": appointmentIDStr,
			"error":         err.Error(),
		})
		return c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Error:   "Invalid appointment ID",
		})
	}

	var req models.CompleteAppointmentRequest
	if err := c.Bind(&req); err != nil {
		h.logError("Invalid request body", map[string]interface{}{
			"endpoint":      "CompleteAppointment",
			"userID":        userID.String(),
			"appointmentID": appointmentID.String(),
			"error":         err.Error(),
		})
		return c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Error:   "Invalid request body",
		})
	}
	if err := c.Validate(&req); err != nil {
		h.logError("Validation error", map[string]interface{}{
			"endpoint":      "CompleteAppointment",
			"userID":        userID.String(),
			"appointmentID": appointmentID.String(),
			"error":         err.Error(),
		})
		return c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Error:   err.Error(),
		})
	}

	h.logInfo("Completing appointment", map[string]interface{}{
		"endpoint":      "CompleteAppointment",
		"userID":        userID.String(),
		"appointmentID": appointmentID.String(),
	})

	response, err := h.service.CompleteAppointment(userID, appointmentID, &req)
	if err != nil {
		h.logError("Failed to complete appointment", map[string]interface{}{
			"endpoint":      "CompleteAppointment",
			"userID":        userID.String(),
			"appointmentID": appointmentID.String(),
			"error":         err.Error(),
		})
		return c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Error:   err.Error(),
		})
	}

	return c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    response,
	})
}

func (h *AppointmentHandler) BookAppointmentByDoctor(c echo.Context) error {
	doctorID, ok := getTokenUUID(c)
	if !ok {
		return c.JSON(http.StatusUnauthorized, models.APIResponse{Success: false, Error: "Invalid user ID in token"})
	}
	role := getRole(c)
	if role != "doctor" && role != "reception" {
		return c.JSON(http.StatusForbidden, models.APIResponse{Success: false, Error: "Only doctors can book appointments for patients"})
	}

	appointmentID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: "Invalid appointment ID"})
	}

	var req models.BookAppointmentByDoctorRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: "Invalid request body"})
	}
	if err := c.Validate(&req); err != nil {
		return c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: err.Error()})
	}

	resp, err := h.service.BookAppointmentByDoctor(doctorID, appointmentID, req.PatientID, &req)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
	}
	return c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: resp})
}
