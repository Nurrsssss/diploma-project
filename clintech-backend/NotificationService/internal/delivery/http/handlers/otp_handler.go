package handlers

import (
	"net/http"

	"github.com/labstack/echo/v4"

	"NotificationService/internal/domain/models"
	"NotificationService/internal/service"
)

// OTPHandler обработчик для OTP эндпоинтов
type OTPHandler struct {
	otpService service.OTPService
}

// NewOTPHandler создает новый обработчик OTP
func NewOTPHandler(otpService service.OTPService) *OTPHandler {
	return &OTPHandler{
		otpService: otpService,
	}
}

// SendOTP отправляет OTP код
// POST /api/auth/send-otp
func (h *OTPHandler) SendOTP(c echo.Context) error {
	var req models.SendOTPRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"message": "Неверный формат запроса",
			"error":   err.Error(),
		})
	}

	// Валидация
	if err := c.Validate(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"message": "Ошибка валидации",
			"error":   err.Error(),
		})
	}

	// Отправляем OTP
	response, err := h.otpService.SendOTP(req.Phone)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"message": "Ошибка отправки OTP",
			"error":   err.Error(),
		})
	}

	return c.JSON(http.StatusOK, response)
}

// VerifyOTP верифицирует OTP код
// POST /api/auth/verify-otp
func (h *OTPHandler) VerifyOTP(c echo.Context) error {
	var req models.VerifyOTPRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"message": "Неверный формат запроса",
			"error":   err.Error(),
		})
	}

	// Валидация
	if err := c.Validate(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"message": "Ошибка валидации",
			"error":   err.Error(),
		})
	}

	// Верифицируем OTP
	response, err := h.otpService.VerifyOTP(req.Phone, req.Code)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"message": "Ошибка верификации OTP",
			"error":   err.Error(),
		})
	}

	return c.JSON(http.StatusOK, response)
}

// ResendOTP повторно отправляет OTP код
// POST /api/auth/resend-otp
func (h *OTPHandler) ResendOTP(c echo.Context) error {
	var req models.ResendOTPRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"message": "Неверный формат запроса",
			"error":   err.Error(),
		})
	}

	// Валидация
	if err := c.Validate(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"message": "Ошибка валидации",
			"error":   err.Error(),
		})
	}

	// Повторно отправляем OTP
	response, err := h.otpService.ResendOTP(req.Phone)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"message": "Ошибка повторной отправки OTP",
			"error":   err.Error(),
		})
	}

	return c.JSON(http.StatusOK, response)
}
