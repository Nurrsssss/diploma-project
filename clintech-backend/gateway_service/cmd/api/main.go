package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/labstack/echo/v4"
	echomiddleware "github.com/labstack/echo/v4/middleware"
	"github.com/printprince/vitalem/gateway_service/docs"
	"github.com/printprince/vitalem/gateway_service/internal/config"
	"github.com/printprince/vitalem/gateway_service/internal/handlers"
	"github.com/printprince/vitalem/utils/middleware"

	_ "github.com/printprince/vitalem/gateway_service/docs" // swagger docs
)

// @title           Clintech API Gateway
// @version         1.0.0
// @description     Единая точка входа для всех микросервисов медицинской платформы Clintech. Упрощает взаимодействие с backend сервисами через простые и понятные REST API.

// @host      localhost:8800
// @BasePath  /

// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization
// @description Введите JWT токен в формате: Bearer {ваш_токен}

func main() {
	// Загружаем конфигурацию
	cfg, err := config.LoadConfig("./config.yaml")
	if err != nil {
		log.Fatalf("Ошибка загрузки конфигурации: %v", err)
	}

	// Создаем Echo сервер
	e := echo.New()

	// Базовые middleware
	e.Use(echomiddleware.Recover())
	e.Use(middleware.LoggerMiddleware())
	e.Use(middleware.CORSMiddleware())

	// Health check endpoint (после создания handlers)
	// Временный endpoint, заменим позже

	// Настраиваем Swagger маршруты
	docs.SetupSwaggerRoutes(e)

	// Создаем handlers
	proxyHandler := handlers.NewProxyHandler(cfg)
	swaggerHandlers := handlers.NewSwaggerHandlers(proxyHandler)

	// Health check endpoint
	e.GET("/health", swaggerHandlers.HealthCheck)

	// ===== ПУБЛИЧНЫЕ РОУТЫ (без JWT) =====

	// Identity Service - авторизация (публичные)
	auth := e.Group("/auth")
	auth.POST("/login", swaggerHandlers.Login)
	auth.POST("/register", swaggerHandlers.Register)
	auth.POST("/validate", swaggerHandlers.ValidateToken)

	// OTP Service - публичные роуты для SMS верификации
	otp := e.Group("/api/auth")
	otp.POST("/send-otp", proxyHandler.ProxyToNotification)
	otp.POST("/verify-otp", proxyHandler.ProxyToNotification)
	otp.POST("/resend-otp", proxyHandler.ProxyToNotification)

	// Публичные роуты для врачей (просмотр профилей)
	publicDoctors := e.Group("/doctors")
	publicDoctors.GET("", swaggerHandlers.GetDoctors)    // Список врачей
	publicDoctors.GET("/:id", swaggerHandlers.GetDoctor) // Профиль врача

	// Публичные файлы
	publicFiles := e.Group("/public")
	publicFiles.GET("/:id", swaggerHandlers.GetPublicFile) // Публичный доступ к файлам

	// ===== ЗАЩИЩЕННЫЕ РОУТЫ (требуют JWT) =====

	// Identity Service - пользовательские данные (защищенные)
	protectedAuth := e.Group("/auth")
	protectedAuth.Use(middleware.JWTMiddleware(cfg.JWT.Secret))
	protectedAuth.GET("/user", swaggerHandlers.GetUser)
	protectedAuth.POST("/register-patient-by-doctor", swaggerHandlers.RegisterPatientByDoctor)

	// Patient Service - основные операции
	patients := e.Group("/patients")
	patients.Use(middleware.JWTMiddleware(cfg.JWT.Secret))
	patients.GET("", swaggerHandlers.GetPatients)
	patients.POST("", swaggerHandlers.CreatePatient)
	patients.GET("/:id", swaggerHandlers.GetPatient)
	patients.PUT("/:id", swaggerHandlers.UpdatePatient)
	patients.DELETE("/:id", swaggerHandlers.DeletePatient)
	patients.Any("/*", proxyHandler.ProxyToPatient) // Остальные операции через proxy

	// Patient Service - пользовательские маршруты
	users := e.Group("/users")
	users.Use(middleware.JWTMiddleware(cfg.JWT.Secret))
	users.GET("/:userID/patient", swaggerHandlers.GetPatientByUserID)
	users.PUT("/:userID/patient", swaggerHandlers.UpdatePatientProfile)

	// Specialist Service - основные защищенные операции
	protectedDoctors := e.Group("/doctors")
	protectedDoctors.Use(middleware.JWTMiddleware(cfg.JWT.Secret))
	protectedDoctors.POST("", swaggerHandlers.CreateDoctor)
	protectedDoctors.PUT("/:id", swaggerHandlers.UpdateDoctor)
	protectedDoctors.DELETE("/:id", swaggerHandlers.DeleteDoctor)
	protectedDoctors.Any("/*", proxyHandler.ProxyToSpecialist) // Остальные операции через proxy

	// Specialist Service - пользовательские маршруты (дополнение к users группе)
	users.GET("/:userID/doctor", swaggerHandlers.GetDoctorByUserID)
	users.PUT("/:userID/doctor", swaggerHandlers.UpdateDoctorProfile)

	// Avatar management (работа с аватарками)
	users.POST("/avatar", swaggerHandlers.UploadAvatar)
	users.DELETE("/avatar", swaggerHandlers.DeleteAvatar)

	// Appointment Service - основные операции
	appointments := e.Group("/appointments")
	appointments.Use(middleware.JWTMiddleware(cfg.JWT.Secret))
	appointments.GET("", swaggerHandlers.GetAppointments)
	appointments.GET("/:id", swaggerHandlers.GetAppointment)
	appointments.POST("/:id/book", swaggerHandlers.BookAppointment)
	appointments.POST("/:id/cancel", swaggerHandlers.CancelAppointment)
	appointments.GET("/doctors/:id/available-slots", swaggerHandlers.GetAvailableSlots)

	// Appointment schedules (для врачей)
	appointments.GET("/schedules", swaggerHandlers.GetSchedules)
	appointments.POST("/schedules", swaggerHandlers.CreateSchedule)
	appointments.PUT("/schedules/:id", swaggerHandlers.UpdateSchedule)
	appointments.DELETE("/schedules/:id", swaggerHandlers.DeleteSchedule)
	appointments.PATCH("/schedules/:id/toggle", swaggerHandlers.ToggleSchedule)
	appointments.POST("/schedules/:id/generate-slots", swaggerHandlers.GenerateSlots)
	appointments.DELETE("/schedules/:id/slots", swaggerHandlers.DeleteScheduleSlots)
	appointments.GET("/schedules/:id/generated-slots", swaggerHandlers.GetGeneratedSlots)

	// Schedule exceptions (исключения в расписании)
	appointments.POST("/exceptions", swaggerHandlers.AddException)
	appointments.GET("/exceptions", swaggerHandlers.GetDoctorExceptions)

	// Appointment Files - файлы записей (через Swagger handlers)
	appointments.POST("/:appointmentID/files", swaggerHandlers.UploadAppointmentFile)
	appointments.GET("/:appointmentID/files", swaggerHandlers.GetAppointmentFiles)
	appointments.DELETE("/:appointmentID/files/:fileID", swaggerHandlers.DeleteAppointmentFile)
	appointments.GET("/:appointmentID/files/:fileID/download", swaggerHandlers.DownloadAppointmentFile)

	appointments.Any("/*", proxyHandler.ProxyToAppointment) // Остальные операции через proxy

	// FileServer Service - основные операции
	files := e.Group("/files")
	files.Use(middleware.JWTMiddleware(cfg.JWT.Secret))
	files.GET("", swaggerHandlers.GetFiles)
	files.POST("", swaggerHandlers.UploadFile)
	files.GET("/:id", swaggerHandlers.GetFile)
	files.DELETE("/:id", swaggerHandlers.DeleteFile)
	files.GET("/:id/download", swaggerHandlers.DownloadFile)
	files.GET("/:id/preview", swaggerHandlers.PreviewFile)
	files.PATCH("/:id/visibility", swaggerHandlers.ToggleFileVisibility)
	files.Any("/*", proxyHandler.ProxyToFileServer) // Остальные операции через proxy

	// Notification Service - основные операции
	notifications := e.Group("/notifications")
	notifications.Use(middleware.JWTMiddleware(cfg.JWT.Secret))
	notifications.GET("/my", swaggerHandlers.GetMyNotifications)
	notifications.GET("/:id", swaggerHandlers.GetNotification)
	notifications.POST("", swaggerHandlers.CreateNotification)
	notifications.PUT("/:id/sent", swaggerHandlers.MarkNotificationAsSent)
	notifications.GET("/recipient/:recipientId", swaggerHandlers.GetNotificationsByRecipient)
	notifications.Any("/*", proxyHandler.ProxyToNotification) // Остальные операции через proxy

	// Logger Service
	logs := e.Group("/logs")
	logs.Use(middleware.JWTMiddleware(cfg.JWT.Secret))
	logs.Any("/*", proxyHandler.ProxyToLogger) // Логирование

	// Запускаем сервер
	go func() {
		addr := fmt.Sprintf("%s:%d", cfg.Server.Host, cfg.Server.Port)
		log.Printf("🚀 Gateway запущен на %s", addr)
		log.Printf("📋 API схема:")
		log.Printf("   Публичные:")
		log.Printf("     POST /auth/login, /auth/register")
		log.Printf("     GET  /doctors, /doctors/:id")
		log.Printf("     GET  /public/:id")
		log.Printf("   Защищенные (JWT):")
		log.Printf("     /auth/*, /patients/*, /doctors/*, /appointments/*")
		log.Printf("     /notifications/*, /files/*, /logs/*")

		if err := e.Start(addr); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Ошибка запуска сервера: %v", err)
		}
	}()

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)
	<-quit

	log.Println("Выключение Gateway...")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := e.Shutdown(ctx); err != nil {
		log.Fatalf("Ошибка при выключении: %v", err)
	}
	log.Println("Gateway выключен")
}
