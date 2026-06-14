package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
	"github.com/printprince/vitalem/logger_service/pkg/logger"
	"github.com/printprince/vitalem/patient_service/internal/models"
	"github.com/printprince/vitalem/patient_service/internal/service"
)

// PatientHandlers структура обработчиков для пациентов
type PatientHandlers struct {
	patientService service.PatientService
	logger         *logger.Client
	httpClient     *http.Client
	identityURL    string
}

// NewPatientHandlers создает новый экземпляр обработчиков для пациентов
func NewPatientHandlers(patientService service.PatientService, logger *logger.Client) *PatientHandlers {
	return &PatientHandlers{
		patientService: patientService,
		logger:         logger,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
		identityURL: "http://identity_service:8801",
	}
}

// RegisterPublicRoutes регистрирует публичные маршруты
func (h *PatientHandlers) RegisterPublicRoutes(g *echo.Group) {
	// Маршрут для создания пациента внутренними сервисами
	g.POST("/patients/internal", h.CreatePatientInternal)
}

// RegisterProtectedRoutes регистрирует защищенные маршруты
func (h *PatientHandlers) RegisterProtectedRoutes(g *echo.Group) {
	// Защищенные маршруты для управления профилями пациентов
	patients := g.Group("/patients")
	patients.POST("", h.CreatePatient)
	patients.PUT("/:id", h.UpdatePatient)
	patients.DELETE("/:id", h.DeletePatient)
	patients.GET("/:id", h.GetPatientByID)

	// Маршрут для получения всех пациентов (только для докторов)
	g.GET("/patients", h.GetAllPatients)

	// Маршрут для получения пациента по ID пользователя
	g.GET("/users/:userID/patient", h.GetPatientByUserID)

	// Маршрут для обновления профиля пациента по userID(для второго этапа регистрации)
	g.PUT("/users/:userID/patient", h.UpdatePatientProfile)

	// Тестовый маршрут для проверки токена и роли
	g.GET("/me", h.GetCurrentUserInfo)

	// Диагностический маршрут для поиска пациента по ИИН (только для докторов)
	g.GET("/patients/by-iin/:iin", h.GetPatientByIIN)
}

// CreatePatient обработчик для создания пациента
func (h *PatientHandlers) CreatePatient(c echo.Context) error {
	// Получаем запрос
	var req models.PatientCreateRequest
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

	// Создаем пациента
	patient, err := h.patientService.CreatePatient(c.Request().Context(), &req)
	if err != nil {
		h.logger.Error("Failed to create patient", map[string]interface{}{
			"error": err.Error(),
		})
		return echo.NewHTTPError(http.StatusBadRequest, "Failed to create patient")
	}

	// Возвращаем http ответ
	return c.JSON(http.StatusCreated, patient)
}

// GetPatientByID обработчик для получения пациента по ID
func (h *PatientHandlers) GetPatientByID(c echo.Context) error {
	// Получаем айди с контекста
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		h.logger.Error("Invalid patient ID", map[string]interface{}{
			"error": err.Error(),
			"id":    c.Param("id"),
		})
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid patient ID")
	}

	// Получаем пациента
	patient, err := h.patientService.GetPatientByID(c.Request().Context(), id)
	if err != nil {
		h.logger.Error("Failed to get patient", map[string]interface{}{
			"error": err.Error(),
		})
		return echo.NewHTTPError(http.StatusBadRequest, "Failed to get patient")
	}

	if patient == nil {
		return echo.NewHTTPError(http.StatusNotFound, "Patient not found")
	}

	// Возвращаем пациента
	return c.JSON(http.StatusOK, patient)
}

// GetPatientByUserID обработчик для получения пациента по ID пользователя
func (h *PatientHandlers) GetPatientByUserID(c echo.Context) error {
	// Получаем айди с контекста
	userID, err := uuid.Parse(c.Param("userID"))
	if err != nil {
		h.logger.Error("Invalid user ID", map[string]interface{}{
			"error": err.Error(),
			"id":    c.Param("userID"),
		})
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid user ID")
	}

	// Получаем пациента
	patient, err := h.patientService.GetPatientByUserID(c.Request().Context(), userID)
	if err != nil {
		h.logger.Error("Failed to get patient by user ID", map[string]interface{}{
			"error":  err.Error(),
			"userID": userID,
		})
		return echo.NewHTTPError(http.StatusBadRequest, "Failed to get patient")
	}

	if patient == nil {
		return echo.NewHTTPError(http.StatusNotFound, "Patient not found for this user")
	}

	// Возвращаем пациента
	return c.JSON(http.StatusOK, patient)
}

// GetAllPatients обработчик для получения всех пациентов
func (h *PatientHandlers) GetAllPatients(c echo.Context) error {
	// Проверяем роль пользователя (должна быть "doctor")
	role, ok := c.Get("role").(string)
	if !ok {
		h.logger.Error("Role not found in context", map[string]interface{}{
			"endpoint": "GetAllPatients",
		})
		return echo.NewHTTPError(http.StatusUnauthorized, "Role not found in token")
	}

	if role != "doctor" && role != "reception" {
		h.logger.Error("Unauthorized access to patients list", map[string]interface{}{
			"role":     role,
			"endpoint": "GetAllPatients",
		})
		return echo.NewHTTPError(http.StatusForbidden, "Only doctors can access the patients list")
	}

	patients, err := h.patientService.GetAllPatients(c.Request().Context())
	if err != nil {
		h.logger.Error("Failed to get all patients", map[string]interface{}{
			"error":    err.Error(),
			"endpoint": "GetAllPatients",
		})
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to get patients")
	}

	h.logger.Info("Successfully retrieved patients list", map[string]interface{}{
		"count":    len(patients),
		"endpoint": "GetAllPatients",
	})

	return c.JSON(http.StatusOK, map[string]interface{}{
		"total_patients": len(patients),
		"patients":       patients,
	})
}

// UpdatePatient обработчик для обновления пациента
func (h *PatientHandlers) UpdatePatient(c echo.Context) error {
	fmt.Printf("🔍 UpdatePatient called! Method: %s, URI: %s, ID: %s\n",
		c.Request().Method, c.Request().RequestURI, c.Param("id"))

	h.logger.Info("UpdatePatient called", map[string]interface{}{
		"method": c.Request().Method,
		"uri":    c.Request().RequestURI,
		"id":     c.Param("id"),
	})

	// Получаем id
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		h.logger.Error("Invalid patient ID", map[string]interface{}{
			"error": err.Error(),
			"id":    c.Param("id"),
		})
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid patient ID")
	}

	// Получаем запрос
	var req models.PatientCreateRequest
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

	// Обновляем пациента
	patient, err := h.patientService.UpdatePatient(c.Request().Context(), id, &req)
	if err != nil {
		h.logger.Error("Failed to update patient", map[string]interface{}{
			"error": err.Error(),
			"id":    c.Param("id"),
		})
		return echo.NewHTTPError(http.StatusBadRequest, "Failed to update patient")
	}

	if patient == nil {
		return echo.NewHTTPError(http.StatusNotFound, "Patient not found")
	}

	// Возвращаем http ответ
	return c.JSON(http.StatusOK, patient)
}

// UpdatePatientProfile обработчик для обновления профиля пациента (для второго этапа регистрации)
func (h *PatientHandlers) UpdatePatientProfile(c echo.Context) error {
	fmt.Printf("🔍 UpdatePatientProfile called! Method: %s, URI: %s, UserID: %s\n",
		c.Request().Method, c.Request().RequestURI, c.Param("userID"))

	h.logger.Info("UpdatePatientProfile called", map[string]interface{}{
		"method": c.Request().Method,
		"uri":    c.Request().RequestURI,
		"userID": c.Param("userID"),
	})

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
	var req models.PatientUpdateRequest
	if err := c.Bind(&req); err != nil {
		h.logger.Error("Invalid request format", map[string]interface{}{
			"error": err.Error(),
		})
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request format")
	}

	// Отладочный лог - что пришло в запросе
	fmt.Printf("📱 Request data: Phone='%s', Email='%s', FirstName='%s', LastName='%s'\n",
		req.Phone, req.Email, req.FirstName, req.LastName)

	h.logger.Info("UpdatePatientProfile request received", map[string]interface{}{
		"userID":    userID,
		"phone":     req.Phone,
		"email":     req.Email,
		"firstName": req.FirstName,
		"lastName":  req.LastName,
	})

	// Для обновления профиля НЕ проводим строгую валидацию (убираем c.Validate)
	// Позволяем частичные обновления

	// Конвертируем в PatientCreateRequest для сервиса
	createReq := &models.PatientCreateRequest{
		UserID:       userID,
		FirstName:    req.FirstName,
		MiddleName:   req.MiddleName,
		LastName:     req.LastName,
		Email:        req.Email,
		Address:      req.Address,
		AvatarURL:    req.AvatarURL,
		IIN:          req.IIN,
		DateOfBirth:  req.DateOfBirth,
		Gender:       req.Gender,
		Height:       req.Height,
		Weight:       req.Weight,
		PhysActivity: req.PhysActivity,
		Diagnoses:    req.Diagnoses,
		Allergens:    req.Allergens,
		Diet:         req.Diet,
	}

	// Обновляем или создаем профиль пациента
	patient, err := h.patientService.UpdatePatientProfile(c.Request().Context(), userID, createReq)
	if err != nil {
		h.logger.Error("Failed to update patient profile", map[string]interface{}{
			"error":  err.Error(),
			"userID": userID,
		})

		// Проверяем на конкретные ошибки для более понятных сообщений
		if err.Error() == "ИИН уже используется другим пациентом" {
			return echo.NewHTTPError(http.StatusConflict, map[string]interface{}{
				"error": "Данный ИИН уже зарегистрирован в системе",
				"code":  "DUPLICATE_IIN",
			})
		}

		return echo.NewHTTPError(http.StatusBadRequest, "Не удалось обновить профиль пациента")
	}

	// Если в запросе есть телефон, обновляем его в identity_service
	if req.Phone != "" {
		if err := h.updatePhone(userID, req.Phone); err != nil {
			h.logger.Error("Failed to update phone in identity_service", map[string]interface{}{
				"error":  err.Error(),
				"userID": userID,
				"phone":  req.Phone,
			})
			// Не возвращаем ошибку, так как профиль уже обновлен
			// Просто логируем проблему
		} else {
			h.logger.Info("Phone updated in identity_service", map[string]interface{}{
				"userID": userID,
				"phone":  req.Phone,
			})
		}
	}

	// Возвращаем обновленный профиль
	return c.JSON(http.StatusOK, patient)
}

// DeletePatient обработчик для удаления пациента
func (h *PatientHandlers) DeletePatient(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		h.logger.Error("Invalid patient ID", map[string]interface{}{
			"error": err.Error(),
			"id":    c.Param("id"),
		})
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid patient ID")
	}

	if err := h.patientService.DeletePatient(c.Request().Context(), id); err != nil {
		h.logger.Error("Failed to delete patient", map[string]interface{}{
			"error": err.Error(),
			"id":    c.Param("id"),
		})
		return echo.NewHTTPError(http.StatusBadRequest, "Failed to delete patient")
	}

	return c.NoContent(http.StatusNoContent)
}

// GetCurrentUserInfo возвращает информацию о текущем пользователе из JWT токена
func (h *PatientHandlers) GetCurrentUserInfo(c echo.Context) error {
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

// updatePhone обновляет телефон пользователя в identity_service
func (h *PatientHandlers) updatePhone(userID uuid.UUID, phone string) error {
	fmt.Printf("📞 updatePhone called: userID=%s, phone=%s\n", userID, phone)

	url := fmt.Sprintf("%s/auth/internal/phone/%s", h.identityURL, userID.String())
	fmt.Printf("🌐 Calling URL: %s\n", url)

	// Создаем запрос для обновления телефона
	requestBody := map[string]string{
		"phone": phone,
	}

	jsonData, err := json.Marshal(requestBody)
	if err != nil {
		return fmt.Errorf("failed to marshal request: %w", err)
	}

	// Создаем HTTP запрос
	req, err := http.NewRequest("PUT", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	// Для внутренних сервисов используем специальный заголовок
	req.Header.Set("X-Internal-Service", "patient_service")
	req.Header.Set("X-User-ID", userID.String())
	// Добавляем JWT токен для авторизации
	req.Header.Set("Authorization", "Bearer internal-service-token")

	// Отправляем запрос
	resp, err := h.httpClient.Do(req)
	if err != nil {
		fmt.Printf("❌ HTTP request failed: %v\n", err)
		return fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	fmt.Printf("📡 HTTP response status: %d\n", resp.StatusCode)

	if resp.StatusCode != http.StatusOK {
		// Читаем тело ответа для отладки
		body, _ := io.ReadAll(resp.Body)
		fmt.Printf("❌ Identity service error: %s\n", string(body))
		return fmt.Errorf("identity service returned status %d", resp.StatusCode)
	}

	fmt.Printf("✅ Phone updated successfully in identity_service\n")
	return nil
}

// CreatePatientInternal обработчик для создания пациента внутренними сервисами
// Проверяет заголовок X-Internal-Service и создает пациента без JWT авторизации
func (h *PatientHandlers) CreatePatientInternal(c echo.Context) error {
	// Проверяем, что запрос от внутреннего сервиса
	internalService := c.Request().Header.Get("X-Internal-Service")
	if internalService == "" {
		h.logger.Error("Missing X-Internal-Service header", map[string]interface{}{
			"endpoint": "CreatePatientInternal",
		})
		return echo.NewHTTPError(http.StatusForbidden, "Access denied: internal service header missing")
	}

	var req models.PatientCreateRequest
	if err := c.Bind(&req); err != nil {
		h.logger.Error("Invalid request format for internal patient creation", map[string]interface{}{
			"error": err.Error(),
		})
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request format")
	}

	if err := c.Validate(&req); err != nil {
		h.logger.Error("Validation error for internal patient creation", map[string]interface{}{
			"error": err.Error(),
		})
		return err
	}

	patient, err := h.patientService.CreatePatient(c.Request().Context(), &req)
	if err != nil {
		h.logger.Error("Failed to create patient internally", map[string]interface{}{
			"error": err.Error(),
		})
		// Проверяем на конкретные ошибки для более понятных сообщений
		if err.Error() == "ИИН уже используется другим пациентом" {
			return echo.NewHTTPError(http.StatusConflict, map[string]interface{}{
				"error": "Данный ИИН уже зарегистрирован в системе",
				"code":  "DUPLICATE_IIN",
			})
		}
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to create patient internally")
	}

	h.logger.Info("Patient created internally", map[string]interface{}{
		"patient_id": patient.ID,
		"user_id":    patient.UserID,
	})

	return c.JSON(http.StatusCreated, patient)
}

// GetPatientByIIN обработчик для поиска пациента по ИИН (для диагностики)
func (h *PatientHandlers) GetPatientByIIN(c echo.Context) error {
	// Проверяем роль пользователя (должна быть "doctor")
	role, ok := c.Get("role").(string)
	if !ok {
		h.logger.Error("Role not found in context", map[string]interface{}{
			"endpoint": "GetPatientByIIN",
		})
		return echo.NewHTTPError(http.StatusUnauthorized, "Role not found in token")
	}

	if role != "doctor" && role != "reception" {
		h.logger.Error("Unauthorized access to patient search by IIN", map[string]interface{}{
			"role":     role,
			"endpoint": "GetPatientByIIN",
		})
		return echo.NewHTTPError(http.StatusForbidden, "Only doctors can search patients by IIN")
	}

	iin := c.Param("iin")
	if iin == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "IIN is required")
	}

	patient, err := h.patientService.GetPatientByIIN(c.Request().Context(), iin)
	if err != nil {
		h.logger.Error("Failed to get patient by IIN", map[string]interface{}{
			"error": err.Error(),
			"iin":   iin,
		})
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to search patient")
	}

	if patient == nil {
		return echo.NewHTTPError(http.StatusNotFound, "Patient with this IIN not found")
	}

	return c.JSON(http.StatusOK, patient)
}
