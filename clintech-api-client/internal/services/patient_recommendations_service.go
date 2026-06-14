package services

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/beereket/vitalem-api-client/internal/client"
	"github.com/beereket/vitalem-api-client/internal/models"
	"github.com/beereket/vitalem-api-client/internal/openai"
	"github.com/beereket/vitalem-api-client/internal/repository"
	"github.com/beereket/vitalem-api-client/internal/utils/pdf"
	"github.com/beereket/vitalem-api-client/internal/utils/text"
)

// PatientRecommendationsService генерирует DOCX с рекомендациями для пациента
// на основе диалога приёма и (если есть) диагноза/плана лечения из паспорта здоровья.
type PatientRecommendationsService struct {
	repository         *repository.HealthPassportRepository
	patientClient      *client.PatientClient
	appointmentService *client.AppointmentClient
	doctorService      *client.DoctorService
	fileServerClient   *client.FileServerClient
	pdfGenerator       *pdf.PDFGenerator
}

func NewPatientRecommendationsService(
	patientClient *client.PatientClient,
	appointmentService *client.AppointmentClient,
	doctorService *client.DoctorService,
	fileServerClient *client.FileServerClient,
	pdfGenerator *pdf.PDFGenerator,
) *PatientRecommendationsService {
	return &PatientRecommendationsService{
		repository:         repository.NewHealthPassportRepository(),
		patientClient:      patientClient,
		appointmentService: appointmentService,
		doctorService:      doctorService,
		fileServerClient:   fileServerClient,
		pdfGenerator:       pdfGenerator,
	}
}

// Generate делает один вызов AI и собирает DOCX с рекомендациями для пациента.
func (s *PatientRecommendationsService) Generate(ctx context.Context, req *models.PatientRecommendationsRequest, token string) (*models.PatientRecommendationsResponse, error) {
	if strings.TrimSpace(req.AppointmentID) == "" || strings.TrimSpace(req.DoctorID) == "" || strings.TrimSpace(req.Lang) == "" {
		return nil, fmt.Errorf("appointment_id, doctor_id and lang are required")
	}
	if strings.TrimSpace(req.TranscriptionText) == "" {
		return nil, fmt.Errorf("transcription_text is required")
	}

	if err := s.appointmentService.ValidateAppointment(req.AppointmentID, req.DoctorID, token); err != nil {
		return nil, fmt.Errorf("appointment validation failed: %w", err)
	}

	appointment, err := s.appointmentService.GetAppointment(req.AppointmentID, token)
	if err != nil {
		return nil, fmt.Errorf("failed to get appointment: %w", err)
	}

	var patientName, doctorName, diagnosisMain, diagnosisContext string

	if existingPassport, err := s.repository.GetHealthPassportByAppointmentAndAnalysis(ctx, req.AppointmentID, ""); err == nil && existingPassport != nil && existingPassport.Content != nil {
		content := existingPassport.Content
		diagnosisMain = strings.TrimSpace(content.DiagnosisMain)
		diagnosisContext = buildDiagnosisContext(content)
		if content.Patient != nil {
			patientName = formatFullName(content.Patient.LastName, content.Patient.FirstName, content.Patient.MiddleName)
		}
		if content.Doctor != nil {
			doctorName = formatFullName(content.Doctor.LastName, content.Doctor.FirstName, content.Doctor.MiddleName)
		}
	}

	var patientProfile *client.PatientProfile
	if profile, err := s.patientClient.GetPatientProfile(appointment.PatientID, token); err == nil && profile != nil {
		patientProfile = profile
		if patientName == "" {
			patientName = formatFullName(profile.LastName, profile.FirstName, profile.MiddleName)
		}
	}

	// Если профиль пациента не найден (404) или в нём нет имени — используем заглушку,
	// чтобы в документе всегда была подпись "Пациент".
	if patientName == "" {
		stub := stubPatientProfile(appointment.PatientID)
		patientName = formatFullName(stub.LastName, stub.FirstName, stub.MiddleName)
		if patientProfile == nil {
			patientProfile = stub
		}
	}

	if doctorName == "" {
		if doctor, err := s.doctorService.GetDoctor(req.DoctorID, token); err == nil && doctor != nil {
			doctorName = formatFullName(doctor.LastName, doctor.FirstName, doctor.MiddleName)
		}
	}

	// Последняя заполненная анкета пациента (вопросы из survey_questions + его ответы).
	var latestAnswers map[string]string
	if records, err := repository.GetRecordsByUser(ctx, appointment.PatientID); err == nil && len(records) > 0 {
		latestAnswers = records[0].Answers
	}

	var questions []models.Question
	if len(latestAnswers) > 0 {
		if qs, err := repository.GetAllQuestions(ctx); err == nil {
			questions = qs
		}
	}

	complaint := strings.TrimSpace(latestAnswers["complaints"])
	if complaint == "" {
		complaint = strings.TrimSpace(appointment.PatientNotes)
	}

	var contextParts []string
	if profileBlock := buildPatientProfileContext(patientProfile); profileBlock != "" {
		contextParts = append(contextParts, profileBlock)
	}
	if complaint != "" {
		contextParts = append(contextParts, "Жалоба пациента:\n"+complaint)
	}
	if anketaBlock := buildAnketaContext(latestAnswers, questions); anketaBlock != "" {
		contextParts = append(contextParts, anketaBlock)
	}
	if diagnosisContext != "" {
		contextParts = append(contextParts, diagnosisContext)
	}

	prompt := openai.GetPatientRecommendationsPrompt(req.Lang, strings.TrimSpace(req.TranscriptionText), strings.Join(contextParts, "\n\n"))

	aiResponse, err := openai.AskOpenAI(prompt, req.Lang)
	if err != nil {
		if errors.Is(err, openai.ErrLLMUnavailable) {
			return nil, fmt.Errorf("AI сервис временно недоступен, попробуйте позже: %w", err)
		}
		return nil, fmt.Errorf("failed to generate recommendations: %w", err)
	}

	recommendations := text.FormatMedicalText(aiResponse)

	docxPath, err := s.pdfGenerator.GeneratePatientRecommendations(&pdf.PatientRecommendationsData{
		PatientName:     patientName,
		DoctorName:      doctorName,
		GeneratedAt:     time.Now().Format("02.01.2006 15:04"),
		DiagnosisMain:   diagnosisMain,
		Complaint:       complaint,
		Recommendations: recommendations,
		Lang:            req.Lang,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to generate DOCX: %w", err)
	}
	defer s.pdfGenerator.CleanupFile(docxPath)

	fileID, err := s.fileServerClient.UploadLocalFile(docxPath, token)
	if err != nil {
		return nil, fmt.Errorf("failed to upload DOCX: %w", err)
	}

	return &models.PatientRecommendationsResponse{
		FileID:      fileID,
		DownloadURL: fmt.Sprintf("/patient-recommendations/%s/download", fileID),
	}, nil
}

// DownloadFile скачивает ранее сгенерированный файл рекомендаций с файлового сервера.
func (s *PatientRecommendationsService) DownloadFile(ctx context.Context, fileID string, token string) ([]byte, *client.FileMetadata, error) {
	metadata, err := s.fileServerClient.GetFileMetadata(fileID, token)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get file metadata: %w", err)
	}

	fileData, err := s.fileServerClient.DownloadFile(fileID, token)
	if err != nil {
		return nil, metadata, fmt.Errorf("failed to download file: %w", err)
	}

	if len(fileData) >= 4 && string(fileData[:4]) == "%PDF" {
		return nil, metadata, fmt.Errorf("CRITICAL: downloaded file is PDF instead of DOCX")
	}

	return fileData, metadata, nil
}

// buildDiagnosisContext собирает текстовый контекст из паспорта здоровья для промпта.
func buildDiagnosisContext(content *models.HealthPassportData) string {
	var b strings.Builder
	addLine := func(label, value string) {
		value = strings.TrimSpace(value)
		if value == "" {
			return
		}
		if b.Len() > 0 {
			b.WriteString("\n\n")
		}
		b.WriteString(label)
		b.WriteString(":\n")
		b.WriteString(value)
	}

	addLine("Жалобы", content.Complaints)
	addLine("Текущее состояние", content.CurrentState)
	addLine("Диагноз", content.DiagnosisMain)
	if len(content.DiagnosisComorbid) > 0 {
		addLine("Сопутствующие диагнозы", strings.Join(content.DiagnosisComorbid, ", "))
	}
	addLine("План обследования", content.PlanExam)
	addLine("План лечения", content.PlanTreatment)
	addLine("Общие рекомендации врача", content.PlanGeneral)

	return b.String()
}

func formatFullName(lastName, firstName, middleName string) string {
	var parts []string
	for _, p := range []string{lastName, firstName, middleName} {
		if p = strings.TrimSpace(p); p != "" {
			parts = append(parts, p)
		}
	}
	return strings.Join(parts, " ")
}

// buildPatientProfileContext собирает текстовый блок с данными профиля пациента для промпта.
func buildPatientProfileContext(profile *client.PatientProfile) string {
	if profile == nil {
		return ""
	}

	var b strings.Builder
	b.WriteString("Данные пациента:")
	written := false

	if age := calculateAge(profile.DateOfBirth); age > 0 {
		b.WriteString(fmt.Sprintf("\n- Возраст: %d лет", age))
		written = true
	}
	if gender := strings.TrimSpace(profile.Gender); gender != "" {
		b.WriteString(fmt.Sprintf("\n- Пол: %s", gender))
		written = true
	}
	if profile.Height > 0 || profile.Weight > 0 {
		b.WriteString(fmt.Sprintf("\n- Рост: %d см, Вес: %d кг", profile.Height, profile.Weight))
		written = true
	}
	if len(profile.Diagnoses) > 0 {
		b.WriteString(fmt.Sprintf("\n- Известные диагнозы: %s", strings.Join(profile.Diagnoses, ", ")))
		written = true
	}
	if len(profile.Allergens) > 0 {
		b.WriteString(fmt.Sprintf("\n- Аллергии: %s", strings.Join(profile.Allergens, ", ")))
		written = true
	}
	if len(profile.Diet) > 0 {
		b.WriteString(fmt.Sprintf("\n- Особенности питания: %s", strings.Join(profile.Diet, ", ")))
		written = true
	}

	if !written {
		return ""
	}
	return b.String()
}

// buildAnketaContext собирает текстовый блок с ответами пациента из последней анкеты для промпта.
func buildAnketaContext(answers map[string]string, questions []models.Question) string {
	if len(answers) == 0 {
		return ""
	}

	var b strings.Builder
	b.WriteString("Анкета пациента (последнее заполнение):")
	written := 0

	for _, q := range questions {
		value := strings.TrimSpace(answers[q.QuestionID])
		if value == "" {
			continue
		}
		b.WriteString(fmt.Sprintf("\n- %s: %s", q.Text, value))
		written++
	}

	if written == 0 {
		for questionID, value := range answers {
			value = strings.TrimSpace(value)
			if value == "" {
				continue
			}
			b.WriteString(fmt.Sprintf("\n- %s: %s", questionID, value))
			written++
		}
	}

	if written == 0 {
		return ""
	}
	return b.String()
}
