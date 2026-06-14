package routes

import (
	"github.com/beereket/vitalem-api-client/internal/client"
	"github.com/beereket/vitalem-api-client/internal/config"
	"github.com/beereket/vitalem-api-client/internal/database/handlers"
	"github.com/beereket/vitalem-api-client/internal/middleware"
	"github.com/beereket/vitalem-api-client/internal/openai"
	"github.com/beereket/vitalem-api-client/internal/services"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
)

func SetupRouter(cfg *config.Config) *gin.Engine {
	r := gin.Default()

	// CORS
	corsConfig := cors.DefaultConfig()
	corsConfig.AllowAllOrigins = true
	corsConfig.AllowMethods = []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"}
	corsConfig.AllowHeaders = []string{"Origin", "Content-Type", "Accept", "Authorization"}
	r.Use(cors.New(corsConfig))

	// External clients
	identityClient := client.NewIdentityClient(cfg.ExternalService.IdentityServiceURL)
	patientClient := client.NewPatientClient(cfg.ExternalService.PatientServiceURL)
	fileServerClient := client.NewFileServerClient(cfg.ExternalService.FileServiceURL)
	appointmentService := client.NewAppointmentClient(cfg.ExternalService.AppointmentServiceURL)
	doctorService := client.NewDoctorService(cfg.ExternalService.DoctorServiceURL)

	// OpenAI
	openaiClient, _ := openai.NewClient(&cfg.OpenAI)

	// Services
	analysisService := services.NewAnalysisService(cfg, patientClient, fileServerClient, openaiClient)
	questionnaireService := services.NewQuestionnaireService(cfg)
	healthPassportService := services.NewHealthPassportService(
		patientClient,
		appointmentService,
		doctorService,
		fileServerClient,
		analysisService.GetContentGenerator(),
		analysisService.GetPDFGenerator(),
		openaiClient,
	)
	patientRecommendationsService := services.NewPatientRecommendationsService(
		patientClient,
		appointmentService,
		doctorService,
		fileServerClient,
		analysisService.GetPDFGenerator(),
	)
	// Handlers
	analysisHandler := handlers.NewAnalysisHandler(analysisService)
	questionnaireHandler := handlers.NewQuestionnaireHandler(questionnaireService)
	healthPassportHandler := handlers.NewHealthPassportHandler(healthPassportService)
	patientRecommendationsHandler := handlers.NewPatientRecommendationsHandler(patientRecommendationsService)
	r.POST("/analysis/extract-answers", analysisHandler.ExtractAnswersFromDialogue)
	r.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))
	r.GET("/questionnaire/template", questionnaireHandler.GetQuestionnaire)
	r.POST("/analysis/audio/whisper", handlers.TranscribeAudioWithWhisper)
	r.POST("/audio/gpt-transcribe", handlers.TranscribeAudioWithGPT4o)
	r.POST("/audio/gpt-mini-transcribe", handlers.TranscribeAudioWithGPT4oMini)
	r.Static("/uploads", "./uploads")

	// Authenticated (любой пользователь)
	authGroup := r.Group("/")
	authGroup.Use(middleware.AuthMiddleware(identityClient))
	{
		authGroup.POST("/analysis/recommendation", analysisHandler.SubmitAnalysisWithAI)
		authGroup.GET("/analysis/my", analysisHandler.ListMyAnalysis)
		authGroup.POST("/analysis/preliminary-conclusion", analysisHandler.GeneratePreliminaryConclusion)

		authGroup.GET("/health-passport/:id", healthPassportHandler.GetHealthPassport)
		authGroup.GET("/health-passport/my", healthPassportHandler.GetMyHealthPassports)
		// Скачивание файла доступно всем авторизованным пользователям (пациентам и врачам)
		// Проверка доступа выполняется в сервисе
		authGroup.GET("/health-passport/:id/download", healthPassportHandler.DownloadHealthPassportFile)

		// Скачивание рекомендаций для пациента доступно всем авторизованным пользователям
		authGroup.GET("/patient-recommendations/:fileId/download", patientRecommendationsHandler.DownloadRecommendationsFile)
	}

	// Doctor-only
	doctorGroup := r.Group("/")
	doctorGroup.Use(middleware.AuthMiddleware(identityClient), middleware.RequireRole("doctor"))
	{
		doctorGroup.GET("/doctor/analysis/:user_id", analysisHandler.ListAnalysisRecordsByUser)
		doctorGroup.POST("/health-passport/generate", healthPassportHandler.GenerateHealthPassport)
		doctorGroup.POST("/patient-recommendations/generate", patientRecommendationsHandler.GenerateRecommendations)
		doctorGroup.GET("/health-passport/patient/:patient_id", healthPassportHandler.GetHealthPassportsByPatient)
		doctorGroup.GET("/health-passport/doctor/:doctor_id", healthPassportHandler.GetHealthPassportsByDoctor)
		doctorGroup.DELETE("/health-passport/:id", healthPassportHandler.DeleteHealthPassport)

		doctorGroup.GET("/health-passport/:id/content", healthPassportHandler.GetHealthPassportContent)
		doctorGroup.PUT("/health-passport/:id/content", healthPassportHandler.UpdateHealthPassportContent)
		doctorGroup.PUT("/health-passport/:id/content-only", healthPassportHandler.UpdateHealthPassportContentOnly)
		doctorGroup.POST("/health-passport/:id/regenerate", healthPassportHandler.RegenerateHealthPassportDOCX)
		// Скачивание файла теперь доступно всем авторизованным пользователям через authGroup
		doctorGroup.PUT("/doctor/analysis/:user_id/answers", analysisHandler.UpdateAnswersByUser)

	}

	return r
}
