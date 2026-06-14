package handlers

import (
	"net/http"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
	"github.com/printprince/vitalem/logger_service/pkg/logger"
	"github.com/printprince/vitalem/specialist_service/internal/models"
	"github.com/printprince/vitalem/specialist_service/internal/service"
)

type DoctorHandlers struct {
	doctorService service.DoctorService
	logger        *logger.Client
}

func NewDoctorHandlers(doctorService service.DoctorService, logger *logger.Client) *DoctorHandlers {
	return &DoctorHandlers{
		doctorService: doctorService,
		logger:        logger,
	}
}

// RegisterRoutes регистрирует все маршруты для обратной совместимости
func (h *DoctorHandlers) RegisterRoutes(e *echo.Echo) {
	// Публичные маршруты
	h.RegisterPublicRoutes(e.Group(""))

	// Защищенные маршруты
	h.RegisterProtectedRoutes(e.Group("/api"))
}

// RegisterPublicRoutes регистрирует публичные маршруты, не требующие аутентификации
func (h *DoctorHandlers) RegisterPublicRoutes(g *echo.Group) {
	// Публичные маршруты для получения информации о врачах
	doctors := g.Group("/api/doctors")
	doctors.GET("", h.GetAllDoctors)
	doctors.GET("/:id", h.GetDoctorByID)
}
func (h *DoctorHandlers) RegisterProtectedRoutes(g *echo.Group) {
	doctors := g.Group("/doctors")
	doctors.POST("", h.CreateDoctor)
	doctors.PUT("/:id", h.UpdateDoctor)
	doctors.DELETE("/:id", h.DeleteDoctor)
	doctors.GET("/:id", h.GetDoctorByID)

	// новое для ресепшна
	doctors.POST("/reception", h.CreateDoctorByReception)
	doctors.GET("/:id/management", h.GetDoctorManagementByID)
	doctors.PUT("/:id/reception", h.UpdateDoctorByReception)
	doctors.DELETE("/:id/reception", h.DeleteDoctorByReception)

	g.GET("/users/:userID/doctor", h.GetDoctorByUserID)
	g.PUT("/users/:userID/doctor", h.UpdateDoctorProfile)
	g.GET("/me", h.GetCurrentUserInfo)
}

func (h *DoctorHandlers) CreateDoctor(c echo.Context) error {
	// Получаем запрос
	var req models.DoctorCreateRequest
	if err := c.Bind(&req); err != nil {
		h.logger.Error("Invalid request format", map[string]interface{}{
			"error": err.Error(),
		})
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request format")
	}

	// Валидация запроса
	if err := c.Validate(&req); err != nil {
		h.logger.Error("Validation error", map[string]interface{}{
			"error": err.Error(),
		})
		return err
	}

	// Создаем доктора
	doctor, err := h.doctorService.CreateDoctor(c.Request().Context(), &req)
	if err != nil {
		h.logger.Error("Failed to create doctor", map[string]interface{}{
			"error": err.Error(),
		})
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	// Возвращаем http ответ
	return c.JSON(http.StatusCreated, doctor)
}

func (h *DoctorHandlers) GetDoctorByID(c echo.Context) error {
	// Получаем айди с контекста
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		h.logger.Error("Invalid doctor ID", map[string]interface{}{
			"error": err.Error(),
			"id":    c.Param("id"),
		})
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid doctor ID")
	}

	// Получаем доктора
	doctor, err := h.doctorService.GetDoctorByID(c.Request().Context(), id)
	if err != nil {
		h.logger.Error("Failed to get doctor", map[string]interface{}{
			"error": err.Error(),
		})
		return echo.NewHTTPError(http.StatusBadRequest, "Failed to get doctor")
	}

	if doctor == nil {
		return echo.NewHTTPError(http.StatusNotFound, "Doctor not found")
	}

	// Возвращаем доктора
	return c.JSON(http.StatusOK, doctor)
}

func (h *DoctorHandlers) GetDoctorByUserID(c echo.Context) error {
	// Получаем айди с контекста
	userID, err := uuid.Parse(c.Param("userID"))
	if err != nil {
		h.logger.Error("Invalid user ID", map[string]interface{}{
			"error": err.Error(),
			"id":    c.Param("userID"),
		})
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid user ID")
	}

	// Получаем доктора
	doctor, err := h.doctorService.GetDoctorByUserID(c.Request().Context(), userID)
	if err != nil {
		h.logger.Error("Failed to get doctor by user ID", map[string]interface{}{
			"error":  err.Error(),
			"userID": userID,
		})
		return echo.NewHTTPError(http.StatusBadRequest, "Failed to get doctor")
	}

	if doctor == nil {
		return echo.NewHTTPError(http.StatusNotFound, "Doctor not found for this user")
	}

	// Возвращаем доктора
	return c.JSON(http.StatusOK, doctor)
}

func (h *DoctorHandlers) GetAllDoctors(c echo.Context) error {
	// Получаем параметр фильтрации по специальности (роли)
	role := c.QueryParam("role") // ?role=Кардиолог

	doctors, err := h.doctorService.GetAllDoctors(c.Request().Context())
	if err != nil {
		h.logger.Error("Failed to get all doctors", map[string]interface{}{
			"error": err.Error(),
		})
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to get doctors")
	}

	// Если указана роль/специальность, фильтруем результаты
	if role != "" {
		var filteredDoctors []*models.DoctorResponse
		for _, doctor := range doctors {
			// Проверяем, есть ли указанная роль в массиве ролей врача
			for _, doctorRole := range doctor.Roles {
				if doctorRole == role {
					filteredDoctors = append(filteredDoctors, doctor)
					break // Найдена роль, добавляем врача и переходим к следующему
				}
			}
		}
		return c.JSON(http.StatusOK, map[string]interface{}{
			"role":          role,
			"total_doctors": len(filteredDoctors),
			"doctors":       filteredDoctors,
		})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"total_doctors": len(doctors),
		"doctors":       doctors,
	})
}

func (h *DoctorHandlers) UpdateDoctor(c echo.Context) error {
	// Получаем id
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		h.logger.Error("Invalid doctor ID", map[string]interface{}{
			"error": err.Error(),
			"id":    c.Param("id"),
		})
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid doctor ID")
	}

	// Получаем запрос
	var req models.DoctorCreateRequest
	if err := c.Bind(&req); err != nil {
		h.logger.Error("Invalid request format", map[string]interface{}{
			"error": err.Error(),
		})
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request format")
	}

	// Валидация запроса
	if err := c.Validate(&req); err != nil {
		h.logger.Error("Validation error", map[string]interface{}{
			"error": err.Error(),
		})
		return err
	}

	// Обновляем доктора
	doctor, err := h.doctorService.UpdateDoctor(c.Request().Context(), id, &req)
	if err != nil {
		h.logger.Error("Failed to update doctor", map[string]interface{}{
			"error": err.Error(),
			"id":    c.Param("id"),
		})
		return echo.NewHTTPError(http.StatusBadRequest, "Failed to update doctor")
	}

	if doctor == nil {
		return echo.NewHTTPError(http.StatusNotFound, "Doctor not found")
	}

	// Возвращаем http ответ
	return c.JSON(http.StatusOK, doctor)
}

// UpdateDoctorProfile обработчик для обновления профиля врача (второй этап регистрации)
func (h *DoctorHandlers) UpdateDoctorProfile(c echo.Context) error {
	// Получаем user ID из URL
	userID, err := uuid.Parse(c.Param("userID"))
	if err != nil {
		h.logger.Error("Invalid user ID", map[string]interface{}{
			"error": err.Error(),
			"id":    c.Param("userID"),
		})
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid user ID")
	}

	// Получаем данные профиля из запроса
	var req models.DoctorUpdateRequest
	if err := c.Bind(&req); err != nil {
		h.logger.Error("Invalid request format", map[string]interface{}{
			"error": err.Error(),
		})
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request format")
	}

	// Валидация запроса
	if err := c.Validate(&req); err != nil {
		h.logger.Error("Validation error", map[string]interface{}{
			"error": err.Error(),
		})
		return err
	}

	// Конвертируем в DoctorCreateRequest для сервиса
	createReq := &models.DoctorCreateRequest{
		UserID:       userID,
		FirstName:    req.FirstName,
		MiddleName:   req.MiddleName,
		LastName:     req.LastName,
		Description:  req.Description,
		Email:        req.Email,
		AvatarURL:    req.AvatarURL,
		Roles:        req.Roles,
		Price:        req.Price,
		Education:    req.Education,
		Certificates: req.Certificates,
	}

	// Обновляем или создаем профиль врача
	doctor, err := h.doctorService.UpdateDoctorProfile(c.Request().Context(), userID, createReq)
	if err != nil {
		h.logger.Error("Failed to update doctor profile", map[string]interface{}{
			"error":  err.Error(),
			"userID": userID,
		})
		return echo.NewHTTPError(http.StatusBadRequest, "Failed to update doctor profile")
	}

	// Возвращаем обновленный профиль
	return c.JSON(http.StatusOK, doctor)
}

func (h *DoctorHandlers) DeleteDoctor(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		h.logger.Error("Invalid doctor ID", map[string]interface{}{
			"error": err.Error(),
			"id":    c.Param("id"),
		})
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid doctor ID")
	}

	if err := h.doctorService.DeleteDoctor(c.Request().Context(), id); err != nil {
		h.logger.Error("Failed to delete doctor", map[string]interface{}{
			"error": err.Error(),
			"id":    c.Param("id"),
		})
		return echo.NewHTTPError(http.StatusBadRequest, "Failed to delete doctor")
	}

	return c.NoContent(http.StatusNoContent)
}

// GetCurrentUserInfo возвращает информацию о текущем пользователе из JWT токена
func (h *DoctorHandlers) GetCurrentUserInfo(c echo.Context) error {
	userID, ok := c.Get("user_id").(uuid.UUID)
	if !ok {
		return echo.NewHTTPError(http.StatusInternalServerError, "User ID not found in context")
	}

	role, ok := c.Get("role").(string)
	if !ok {
		return echo.NewHTTPError(http.StatusInternalServerError, "Role not found in context")
	}

	email, _ := c.Get("email").(string)
	phone, _ := c.Get("phone").(string)

	return c.JSON(http.StatusOK, map[string]interface{}{
		"user_id": userID,
		"role":    role,
		"email":   email,
		"phone":   phone,
	})
}

func (h *DoctorHandlers) CreateDoctorByReception(c echo.Context) error {
	var req models.ReceptionDoctorUpsertRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request format")
	}
	if err := c.Validate(&req); err != nil {
		return err
	}

	doctor, err := h.doctorService.CreateDoctorByReception(c.Request().Context(), &req)
	if err != nil {
		h.logger.Error("Failed to create doctor by reception", map[string]interface{}{
			"error": err.Error(),
		})
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	return c.JSON(http.StatusCreated, doctor)
}
func (h *DoctorHandlers) GetDoctorManagementByID(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid doctor ID")
	}

	doctor, err := h.doctorService.GetDoctorManagementByID(c.Request().Context(), id)
	if err != nil {
		h.logger.Error("Failed to get doctor management profile", map[string]interface{}{
			"error": err.Error(),
			"id":    id,
		})
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	if doctor == nil {
		return echo.NewHTTPError(http.StatusNotFound, "Doctor not found")
	}

	return c.JSON(http.StatusOK, doctor)
}

func (h *DoctorHandlers) UpdateDoctorByReception(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid doctor ID")
	}

	var req models.ReceptionDoctorUpsertRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request format")
	}
	if err := c.Validate(&req); err != nil {
		return err
	}

	doctor, err := h.doctorService.UpdateDoctorByReception(c.Request().Context(), id, &req)
	if err != nil {
		h.logger.Error("Failed to update doctor by reception", map[string]interface{}{
			"error": err.Error(),
			"id":    id,
		})
		return echo.NewHTTPError(http.StatusBadRequest, "Failed to update doctor")
	}

	if doctor == nil {
		return echo.NewHTTPError(http.StatusNotFound, "Doctor not found")
	}

	return c.JSON(http.StatusOK, doctor)
}

func (h *DoctorHandlers) DeleteDoctorByReception(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid doctor ID")
	}

	if err := h.doctorService.DeleteDoctorByReception(c.Request().Context(), id); err != nil {
		h.logger.Error("Failed to delete doctor by reception", map[string]interface{}{
			"error": err.Error(),
			"id":    id,
		})
		return echo.NewHTTPError(http.StatusBadRequest, "Failed to delete doctor")
	}

	return c.NoContent(http.StatusNoContent)
}
