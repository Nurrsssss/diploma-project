package handlers

import (
	"net/http"
	"strings"

	"github.com/printprince/vitalem/identity_service/internal/service"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
	"github.com/printprince/vitalem/logger_service/pkg/logger"
	"github.com/printprince/vitalem/utils/middleware"
)

type RegisterPatientByDoctorResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Data    struct {
		UserID     string `json:"user_id"`
		PatientID  string `json:"patient_id"`
		Phone      string `json:"phone"`
		FirstName  string `json:"first_name"`
		LastName   string `json:"last_name"`
		MiddleName string `json:"middle_name,omitempty"`
		Email      string `json:"email,omitempty"`
		CreatedAt  string `json:"created_at"`
	} `json:"data"`
}

type AuthHandler struct {
	authService *service.AuthService
	logger      *logger.Client
}

func NewAuthHandler(authService *service.AuthService, logger *logger.Client) *AuthHandler {
	return &AuthHandler{
		authService: authService,
		logger:      logger,
	}
}

type loginRequest struct {
	Phone    string `json:"phone" validate:"required"`
	Password string `json:"password" validate:"required,min=6"`
}

type registerRequest struct {
	Email    string `json:"email" validate:"omitempty,email"`
	Password string `json:"password" validate:"required,min=6"`
	Role     string `json:"role" validate:"required,oneof=patient doctor"`
	Phone    string `json:"phone" validate:"required"`
}

type updatePhoneRequest struct {
	Phone string `json:"phone" validate:"required"`
}

type authResponse struct {
	Token string `json:"token"`
}

type registerPatientByDoctorRequest struct {
	Phone        string   `json:"phone" validate:"required"`
	Password     string   `json:"password" validate:"required,min=8"`
	FirstName    string   `json:"first_name" validate:"required"`
	LastName     string   `json:"last_name" validate:"required"`
	MiddleName   string   `json:"middle_name,omitempty"`
	IIN          string   `json:"iin,omitempty" validate:"omitempty,len=12"`
	DateOfBirth  string   `json:"date_of_birth,omitempty"`
	Email        string   `json:"email,omitempty" validate:"omitempty,email"`
	Address      string   `json:"address,omitempty"`
	Gender       string   `json:"gender,omitempty" validate:"omitempty,oneof=male female other"`
	Height       float64  `json:"height,omitempty" validate:"omitempty,gte=50,lte=250"`
	Weight       float64  `json:"weight,omitempty" validate:"omitempty,gte=20,lte=300"`
	PhysActivity string   `json:"phys_activity,omitempty"`
	Diagnoses    []string `json:"diagnoses,omitempty"`
	Allergens    []string `json:"allergens,omitempty"`
	Diet         []string `json:"diet,omitempty"`
}

func normalizePhone(raw string) string {
	var b strings.Builder
	for _, r := range raw {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	return b.String()
}

func (h *AuthHandler) Login(c echo.Context) error {
	// Создаем запрос на вход
	var req loginRequest
	if err := c.Bind(&req); err != nil {
		if h.logger != nil {
			h.logger.Error("Invalid login request format", map[string]interface{}{
				"error": err.Error(),
			})
		}
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request format")
	}

	req.Phone = normalizePhone(req.Phone)

	// Пробуем залогиниться
	token, err := h.authService.LoginByPhone(req.Phone, req.Password)
	if err != nil {
		if h.logger != nil {
			h.logger.Error("Login failed", map[string]interface{}{
				"phone": req.Phone,
				"error": err.Error(),
			})
		}

		if err.Error() == "Invalid phone" || err.Error() == "Invalid password" {
			return echo.NewHTTPError(http.StatusUnauthorized, "Invalid phone or password")
		}
		return echo.NewHTTPError(http.StatusInternalServerError, "Internal server error")
	}

	if h.logger != nil {
		h.logger.Info("User logged in", map[string]interface{}{
			"phone": req.Phone,
		})
	}

	// Возвращаем токен в ответе
	return c.JSON(http.StatusOK, authResponse{Token: token})
}

func (h *AuthHandler) Register(c echo.Context) error {
	// Создаем запрос на регистрацию
	var req registerRequest
	if err := c.Bind(&req); err != nil {
		if h.logger != nil {
			h.logger.Error("Invalid register request format", map[string]interface{}{
				"error": err.Error(),
			})
		}
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request format")
	}

	// Пробуем зарегистрироваться
	err := h.authService.Register(req.Email, req.Password, req.Role, req.Phone)
	if err != nil {
		if h.logger != nil {
			h.logger.Error("Registration failed", map[string]interface{}{
				"phone": req.Phone,
				"role":  req.Role,
				"error": err.Error(),
			})
		}

		if err.Error() == "User with this phone already exists" || err.Error() == "User with this email already exists" {
			return echo.NewHTTPError(http.StatusBadRequest, err.Error())
		}
		return echo.NewHTTPError(http.StatusInternalServerError, "Internal server error")
	}

	if h.logger != nil {
		h.logger.Info("User registered", map[string]interface{}{
			"phone": req.Phone,
			"role":  req.Role,
		})
	}

	// Возвращаем ответ с успешной регистрацией
	return c.JSON(http.StatusCreated, map[string]string{"message": "User created successfully"})
}

func (h *AuthHandler) ValidateToken(c echo.Context) error {
	// Обрезаем префикс Bearer
	authHeader := c.Request().Header.Get("Authorization")
	if !strings.HasPrefix(authHeader, "Bearer ") {
		return echo.NewHTTPError(http.StatusUnauthorized, "Missing or invalid Authorization header")
	}
	token := strings.TrimPrefix(authHeader, "Bearer ")

	claims, err := h.authService.ValidateToken(token)
	if err != nil {
		if h.logger != nil {
			h.logger.Error("Token validation failed", map[string]interface{}{
				"error": err.Error(),
			})
		}
		return echo.NewHTTPError(http.StatusUnauthorized, "Invalid or expired token")
	}

	return c.JSON(http.StatusOK, claims)
}

func (h *AuthHandler) GetUser(c echo.Context) error {
	userID := c.Param("user_id")
	if userID == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "User ID is required")
	}
	// Валидация формата UUID
	if _, err := uuid.Parse(userID); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid user ID format")
	}

	user, err := h.authService.GetUser(userID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to get user")
	}

	if user == nil {
		return echo.NewHTTPError(http.StatusNotFound, "User not found")
	}

	// Возвращаем минимальную информацию (в основном для получения phone)
	email := ""
	if user.Email != nil {
		email = *user.Email
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"user_id": user.ID,
		"role":    user.Role,
		"phone":   user.Phone,
		"email":   email,
	})
}

func (h *AuthHandler) UpdatePhone(c echo.Context) error {
	userID := c.Get("user_id")

	// Проверяем, является ли это запросом от внутреннего сервиса
	internalService := c.Request().Header.Get("X-Internal-Service")
	if internalService != "" {
		// Для внутренних сервисов берем userID из заголовка
		userIDStr := c.Request().Header.Get("X-User-ID")
		if userIDStr == "" {
			return echo.NewHTTPError(http.StatusBadRequest, "X-User-ID header required for internal services")
		}
		userID = userIDStr
	}

	var req updatePhoneRequest
	if err := c.Bind(&req); err != nil {
		if h.logger != nil {
			h.logger.Error("Invalid update phone request format", map[string]interface{}{
				"error": err.Error(),
			})
		}
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request format")
	}

	// Обновляем телефон пользователя
	err := h.authService.UpdatePhone(userID.(string), req.Phone)
	if err != nil {
		if h.logger != nil {
			h.logger.Error("Failed to update phone", map[string]interface{}{
				"user_id": userID,
				"phone":   req.Phone,
				"error":   err.Error(),
			})
		}
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to update phone")
	}

	if h.logger != nil {
		h.logger.Info("Phone updated", map[string]interface{}{
			"user_id": userID,
			"phone":   req.Phone,
		})
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "Phone updated successfully"})
}

// UpdatePhoneInternal - обновление телефона пользователя (для внутренних сервисов)
func (h *AuthHandler) UpdatePhoneInternal(c echo.Context) error {
	userID := c.Param("userID")
	if userID == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "User ID is required")
	}

	var req updatePhoneRequest
	if err := c.Bind(&req); err != nil {
		if h.logger != nil {
			h.logger.Error("Invalid update phone request format", map[string]interface{}{
				"error": err.Error(),
			})
		}
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request format")
	}

	// Обновляем телефон пользователя
	err := h.authService.UpdatePhone(userID, req.Phone)
	if err != nil {
		if h.logger != nil {
			h.logger.Error("Failed to update phone", map[string]interface{}{
				"user_id": userID,
				"phone":   req.Phone,
				"error":   err.Error(),
			})
		}
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to update phone")
	}

	if h.logger != nil {
		h.logger.Info("Phone updated by internal service", map[string]interface{}{
			"user_id": userID,
			"phone":   req.Phone,
		})
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "Phone updated successfully"})
}

func (h *AuthHandler) GetUserByID(c echo.Context) error {
	userID := c.Param("id")
	if userID == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "User ID is required")
	}
	if _, err := uuid.Parse(userID); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid user ID format")
	}

	user, err := h.authService.GetUser(userID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to get user")
	}
	if user == nil {
		return echo.NewHTTPError(http.StatusNotFound, "User not found")
	}
	email := ""
	if user.Email != nil {
		email = *user.Email
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"user_id": user.ID,
		"role":    user.Role,
		"phone":   user.Phone,
		"email":   email,
	})
}

func (h *AuthHandler) RegisterPatientByDoctor(c echo.Context) error {
	// Проверяем роль пользователя - врачи и ресепшн могут создавать пациентов
	role, ok := c.Get("role").(string)
	if !ok || (role != "doctor" && role != "reception") {
		if h.logger != nil {
			h.logger.Error("Unauthorized access to register patient by doctor", map[string]interface{}{
				"role": role,
			})
		}
		return echo.NewHTTPError(http.StatusForbidden, "Only doctors and reception can create patients")
	}

	// Создаем запрос на регистрацию пациента
	var req registerPatientByDoctorRequest
	if err := c.Bind(&req); err != nil {
		if h.logger != nil {
			h.logger.Error("Invalid register patient by doctor request format", map[string]interface{}{
				"error": err.Error(),
			})
		}
		return echo.NewHTTPError(http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"error":   "INVALID_REQUEST",
			"message": "Неверный формат запроса: " + err.Error(),
		})
	}

	// Валидация запроса
	if err := c.Validate(&req); err != nil {
		if h.logger != nil {
			h.logger.Error("Validation error for register patient by doctor", map[string]interface{}{
				"error": err.Error(),
			})
		}
		return echo.NewHTTPError(http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"error":   "VALIDATION_ERROR",
			"message": "Ошибка валидации: " + err.Error(),
		})
	}

	normalizedPhone := req.Phone
	if h.authService != nil {
		normalizedPhone = normalizePhone(req.Phone)
	}

	// Дополнительная валидация телефона
	if len(normalizedPhone) != 11 || !strings.HasPrefix(normalizedPhone, "7") {
		if h.logger != nil {
			h.logger.Error("Invalid phone format", map[string]interface{}{
				"phone": req.Phone,
				"normalized_phone": normalizedPhone,
			})
		}
		return echo.NewHTTPError(http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"error":   "INVALID_PHONE",
			"message": "Номер телефона должен содержать 11 цифр и начинаться с 7",
		})
	}

	// Регистрируем пациента через сервис
	serviceReq := &service.RegisterPatientByDoctorRequest{
		Phone:        normalizedPhone,
		Password:     req.Password,
		FirstName:    req.FirstName,
		LastName:     req.LastName,
		MiddleName:   req.MiddleName,
		IIN:          req.IIN,
		DateOfBirth:  req.DateOfBirth,
		Email:        req.Email,
		Address:      req.Address,
		Gender:       req.Gender,
		Height:       req.Height,
		Weight:       req.Weight,
		PhysActivity: req.PhysActivity,
		Diagnoses:    req.Diagnoses,
		Allergens:    req.Allergens,
		Diet:         req.Diet,
	}

	result, err := h.authService.RegisterPatientByDoctor(c.Request().Context(), serviceReq)
	if err != nil {
		if h.logger != nil {
			h.logger.Error("Failed to register patient by doctor", map[string]interface{}{
				"phone": req.Phone,
				"error": err.Error(),
			})
		}

		errMsg := err.Error()

		return echo.NewHTTPError(http.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"error":   "INTERNAL_ERROR",
			"message": errMsg,
		})

		message := "Не удалось создать пациента"
		if strings.Contains(errMsg, "patient service error") {
			message = strings.TrimPrefix(errMsg, "patient service error: ")
		} else if strings.Contains(errMsg, "Failed to create patient profile") {
			message = "Не удалось создать профиль пациента"
		} else if strings.Contains(errMsg, "failed to call patient service") {
			message = "Ошибка соединения с сервисом пациентов"
		}

		return echo.NewHTTPError(http.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"error":   "INTERNAL_ERROR",
			"message": message,
		})
	}

	if h.logger != nil {
		h.logger.Info("Patient registered by doctor", map[string]interface{}{
			"phone":      req.Phone,
			"user_id":    result.Data.UserID,
			"patient_id": result.Data.PatientID,
		})
	}

	return c.JSON(http.StatusOK, result)
}
func RegisterRoutes(e *echo.Echo, authService *service.AuthService, logger *logger.Client) {
	handler := NewAuthHandler(authService, logger)

	// Основные маршруты с префиксом /auth
	e.POST("/auth/login", handler.Login)
	e.POST("/auth/register", handler.Register)
	e.POST("/auth/validate", handler.ValidateToken)

	// Приватные маршруты для получения информации о пользователе
	protectedGroup := e.Group("/auth")
	protectedGroup.Use(middleware.JWTMiddleware(authService.GetJWTSecret()))
	protectedGroup.GET("/user/:user_id", handler.GetUser)
	protectedGroup.PUT("/phone", handler.UpdatePhone)
	protectedGroup.POST("/register-patient-by-doctor", handler.RegisterPatientByDoctor)

	// Публичный маршрут для получения данных пользователя по ID (для внутренних сервисов)
	e.GET("/auth/user/:id", handler.GetUserByID)

	// Публичный маршрут для обновления телефона внутренними сервисами
	e.PUT("/auth/internal/phone/:userID", handler.UpdatePhoneInternal)
}
