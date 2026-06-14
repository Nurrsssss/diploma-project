package router

import (
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"

	"github.com/printprince/vitalem/appointment_service/internal/handlers"
	utilsMiddleware "github.com/printprince/vitalem/utils/middleware"
)

// SetupRoutes - настройка маршрутов
func SetupRoutes(e *echo.Echo, handler *handlers.AppointmentHandler, serviceHandler *handlers.ServiceHandler, jwtSecret string) {
	// Основные middleware
	e.Use(middleware.CORS())
	e.Use(utilsMiddleware.LoggerMiddleware())
	e.Use(middleware.Recover())
	e.Use(middleware.RequestID())

	// Услуги
	e.GET("/services", serviceHandler.ListServices)
	e.GET("/services/catalog", serviceHandler.GetCatalog)
	e.GET("/services/categories", serviceHandler.ListCategories)
	e.POST("/services/categories", serviceHandler.CreateCategory)
	e.POST("/services", serviceHandler.CreateService)
	e.PUT("/services/:id", serviceHandler.UpdateService)
	e.DELETE("/services/:id", serviceHandler.DeleteService)

	// Валидатор
	e.Validator = utilsMiddleware.NewValidator()

	// Health
	e.GET("/health", handler.HealthCheck)

	// JWT для всех защищённых роутов
	protected := e.Group("")
	protected.Use(utilsMiddleware.JWTMiddleware(jwtSecret))

	// =========================================================
	// SCHEDULES
	// =========================================================
	doctorSchedules := protected.Group("/appointments/schedules")
	doctorSchedules.Use(utilsMiddleware.RequireDoctorOrReception())
	{
		doctorSchedules.GET("", handler.GetDoctorSchedules)
		doctorSchedules.GET("/:id/generated-slots", handler.GetGeneratedSlots)

		doctorSchedules.POST("", handler.CreateSchedule)
		doctorSchedules.PUT("/:id", handler.UpdateSchedule)
		doctorSchedules.DELETE("/:id", handler.DeleteSchedule)
		doctorSchedules.PATCH("/:id/toggle", handler.ToggleSchedule)
		doctorSchedules.POST("/:id/generate-slots", handler.GenerateSlots)
		doctorSchedules.DELETE("/:id/slots", handler.DeleteScheduleSlots)
	}

	// =========================================================
	// EXCEPTIONS
	// =========================================================
	doctorExceptions := protected.Group("/appointments/exceptions")
	doctorExceptions.Use(utilsMiddleware.RequireDoctorOrReception())
	{
		doctorExceptions.POST("", handler.AddException)
		doctorExceptions.GET("", handler.GetDoctorExceptions)
		doctorExceptions.DELETE("/:id", handler.DeleteException)
	}

	// =========================================================
	// Appointments READ
	// =========================================================
	appointmentsRead := protected.Group("/appointments")
	appointmentsRead.Use(utilsMiddleware.RoleMiddleware("doctor", "patient", "reception"))
	{
		appointmentsRead.GET("/:id", handler.GetAppointmentByIDForRole)
		appointmentsRead.GET("/doctors/:id/available-slots", handler.GetAvailableSlots)
		appointmentsRead.GET("/board", handler.GetScheduleBoard)
	}

	// =========================================================
	// Appointments STAFF WRITE
	// =========================================================
	appointmentsStaffRoot := protected.Group("/appointments")
	appointmentsStaffRoot.Use(utilsMiddleware.RequireDoctorOrReception())
	{
		appointmentsStaffRoot.POST("/:id/book-by-doctor", handler.BookAppointmentByDoctor)
		appointmentsStaffRoot.POST("/:id/cancel-by-doctor", handler.CancelAppointmentByDoctor)
		appointmentsStaffRoot.PUT("/:id", handler.UpdateAppointment)
		appointmentsStaffRoot.POST("/:id/reschedule", handler.RescheduleAppointment)
		appointmentsStaffRoot.POST("/:id/complete", handler.CompleteAppointment)
		appointmentsStaffRoot.DELETE("/:id", handler.DeleteAppointment)
	}

	// =========================================================
	// Appointments LIST + patient operations
	// =========================================================
	appointments := protected.Group("/appointments")
	appointments.Use(utilsMiddleware.RoleMiddleware("doctor", "patient", "reception"))
	{
		appointments.GET("", func(c echo.Context) error {
			role, ok := c.Get("role").(string)
			if !ok {
				return echo.NewHTTPError(http.StatusUnauthorized, "Role not found")
			}
			if role == "doctor" || role == "reception" {
				return handler.GetDoctorAppointments(c)
			}
			return handler.GetPatientAppointments(c)
		})

		appointments.POST("/:id/book", handler.BookAppointment)
		appointments.POST("/:id/cancel", handler.CancelAppointment)

		appointments.POST("/:appointmentID/files", handler.UploadAppointmentFile)
		appointments.GET("/:appointmentID/files", handler.GetAppointmentFiles)
		appointments.DELETE("/:appointmentID/files/:fileID", handler.DeleteAppointmentFile)
		appointments.GET("/:appointmentID/files/:fileID/download", handler.DownloadAppointmentFile)
		appointments.POST("/:appointmentID/files/add", handler.AddAppointmentFiles)

		appointments.GET("/:id/transcription", handler.GetAppointmentTranscription)
		appointments.PUT("/:id/transcription", handler.UpdateAppointmentTranscription)
		appointments.POST("/:id/transcription", handler.UpdateAppointmentTranscription)
		appointments.DELETE("/:id/transcription", handler.DeleteAppointmentTranscription)
	}
}
