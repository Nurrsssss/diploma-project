package router

import (
	"github.com/labstack/echo/v4"

	"NotificationService/internal/delivery/http/handler"
	"NotificationService/internal/delivery/http/handlers"
	"NotificationService/internal/service"
)

// SetupRoutes настраивает все маршруты для Echo
func SetupRoutes(e *echo.Echo, notificationService service.NotificationService, otpService service.OTPService) {
	// Основные API маршруты
	api := e.Group("/notifications")
	h := handler.NewNotificationHandler(notificationService)
	h.RegisterRoutes(api)

	// OTP API маршруты
	auth := e.Group("/api/auth")
	otpHandler := handlers.NewOTPHandler(otpService)

	auth.POST("/send-otp", otpHandler.SendOTP)
	auth.POST("/verify-otp", otpHandler.VerifyOTP)
	auth.POST("/resend-otp", otpHandler.ResendOTP)
}
