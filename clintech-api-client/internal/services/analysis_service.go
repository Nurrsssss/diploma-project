package services

import (
	"context"
	"fmt"
	"mime/multipart"
	"time"

	"github.com/beereket/vitalem-api-client/internal/client"
	"github.com/beereket/vitalem-api-client/internal/config"
	"github.com/beereket/vitalem-api-client/internal/openai"
	"github.com/beereket/vitalem-api-client/internal/repository"
	"github.com/beereket/vitalem-api-client/internal/utils/pdf"
)

type AnalysisService struct {
	config              *config.Config
	patientClient       *client.PatientClient
	fileServerClient    *client.FileServerClient
	pdfGenerator        *pdf.PDFGenerator
	contentGenerator    *pdf.ContentGenerator
	fileAnalysisService *FileAnalysisService
}

func NewAnalysisService(cfg *config.Config, patientClient *client.PatientClient, fileServerClient *client.FileServerClient, openaiClient *openai.Client) *AnalysisService {
	pdfGenerator := pdf.NewPDFGenerator("internal/utils/pdf/templates", "uploads/temp")
	contentGenerator := pdf.NewContentGenerator()

	contentGenerator.SetFileServerClient(fileServerClient)

	fileAnalysisConfig := DefaultFileAnalysisConfig()
	fileAnalysisService := NewFileAnalysisService(
		fileServerClient,
		nil,
		openaiClient,
		fileAnalysisConfig,
	)

	return &AnalysisService{
		config:              cfg,
		patientClient:       patientClient,
		fileServerClient:    fileServerClient,
		pdfGenerator:        pdfGenerator,
		contentGenerator:    contentGenerator,
		fileAnalysisService: fileAnalysisService,
	}
}

func (s *AnalysisService) Config() *config.Config {
	return s.config
}

func (s *AnalysisService) GetFileServerClient() *client.FileServerClient {
	return s.fileServerClient
}

func (s *AnalysisService) GetContentGenerator() *pdf.ContentGenerator {
	return s.contentGenerator
}

func (s *AnalysisService) GetPDFGenerator() *pdf.PDFGenerator {
	return s.pdfGenerator
}

type AnalysisRequest struct {
	Answers     map[string]string
	Attachments []*multipart.FileHeader
	Lang        string
}

type AnalysisResponse struct {
	Recommendations string `json:"recommendations"`
}

type PreliminaryConclusionRequest struct {
	AnalysisID string `json:"analysis_id"`
	UserID     string `json:"user_id"`
	Lang       string `json:"lang"`
}

type PreliminaryConclusionResponse struct {
	ConclusionFileID string `json:"conclusion_file_id"`
	GeneratedAt      string `json:"generated_at"`
}

func (s *AnalysisService) AnalyzeWithAI(req *AnalysisRequest) (*AnalysisResponse, error) {
	prompt := openai.GetMedicalPrompt(req.Lang, req.Answers)

	aiResp, err := openai.AskOpenAI(prompt, req.Lang)
	if err != nil {
		return nil, fmt.Errorf("AI analysis error: %v", err)
	}

	return &AnalysisResponse{
		Recommendations: aiResp,
	}, nil
}

func (s *AnalysisService) GeneratePreliminaryConclusion(req *PreliminaryConclusionRequest, token string) (*PreliminaryConclusionResponse, error) {
	if req.AnalysisID == "" || req.AnalysisID == "null" || req.AnalysisID == "undefined" {
		return nil, fmt.Errorf("invalid analysis_id: '%s' - must provide a valid UUID", req.AnalysisID)
	}

	record, err := repository.GetAnalysisRecordByID(context.Background(), req.AnalysisID)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch analysis record with ID '%s': %v", req.AnalysisID, err)
	}

	// Проверка доступа: пользователь может генерировать заключение только для своих анализов
	if record.UserID != req.UserID {
		return nil, fmt.Errorf("access denied: analysis record belongs to another user")
	}

	profile, err := s.patientClient.GetPatientProfile(req.UserID, token)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch patient profile: %v", err)
	}

	complaints, err := s.contentGenerator.GenerateComplaints(record.Answers, req.Lang)
	if err != nil {
		return nil, fmt.Errorf("failed to generate complaints: %v", err)
	}

	medicalHistory, err := s.contentGenerator.GenerateMedicalHistory(profile, record.Answers, req.Lang)
	if err != nil {
		return nil, fmt.Errorf("failed to generate medical history: %v", err)
	}

	lifestyle, err := s.contentGenerator.GenerateLifestyle(record.Answers, req.Lang)
	if err != nil {
		return nil, fmt.Errorf("failed to generate lifestyle: %v", err)
	}

	var uploadedDocumentsAnalysis string
	if len(record.Files) > 0 && s.fileAnalysisService != nil {

		fileReferences := make([]FileReference, 0, len(record.Files))
		for _, fileID := range record.Files {

			metadata, err := s.fileServerClient.GetFileMetadata(fileID, token)
			if err != nil {

				fileRef := FileReference{
					ID:           fileID,
					FileName:     fmt.Sprintf("file_%s.pdf", fileID),
					OriginalName: fmt.Sprintf("file_%s.pdf", fileID),
					Source:       "fileserver",
					Size:         0,
				}
				fileReferences = append(fileReferences, fileRef)
				continue
			}

			fileRef := FileReference{
				ID:           fileID,
				FileName:     metadata.OriginalName,
				OriginalName: metadata.OriginalName,
				MimeType:     metadata.MimeType,
				Size:         metadata.Size,
				Source:       "fileserver",
			}
			fileReferences = append(fileReferences, fileRef)
		}

		analysisReq := &FileAnalysisRequest{
			Files:    fileReferences,
			Language: req.Lang,
			Context:  "preliminary_conclusion",
			MaxFiles: 5,
		}

		fileAnalysis, err := s.fileAnalysisService.AnalyzeFiles(context.Background(), analysisReq, token)
		if err != nil {
			uploadedDocumentsAnalysis = s.getLocalizedMessage("file_analysis_failed", req.Lang)
		} else {
			uploadedDocumentsAnalysis = fileAnalysis
		}
	} else {
		uploadedDocumentsAnalysis = s.getLocalizedMessage("no_files_uploaded", req.Lang)
	}

	generalConclusion, err := s.contentGenerator.GenerateGeneralConclusion(profile, record.Answers, uploadedDocumentsAnalysis, req.Lang)
	if err != nil {
		generalConclusion = s.getLocalizedMessage("general_conclusion_failed", req.Lang)
	}

	pdfData := &pdf.PreliminaryConclusionData{
		Patient:           profile,
		Answers:           record.Answers,
		Files:             record.Files,
		GeneratedAt:       time.Now().Format("02.01.2006 15:04"),
		Complaints:        complaints,
		MedicalHistory:    medicalHistory,
		Lifestyle:         lifestyle,
		UploadedDocuments: uploadedDocumentsAnalysis,
		GeneralConclusion: generalConclusion,
		CurrentState:      "", // Для preliminary conclusion CurrentState не используется
	}

	pdfPath, err := s.pdfGenerator.GeneratePreliminaryConclusion(pdfData)
	if err != nil {
		return nil, fmt.Errorf("failed to generate PDF: %v", err)
	}

	fileID, err := s.fileServerClient.UploadLocalFile(pdfPath, token)
	if err != nil {
		s.pdfGenerator.CleanupFile(pdfPath)
		return nil, fmt.Errorf("failed to upload PDF to file service: %v", err)
	}

	if err := s.pdfGenerator.CleanupFile(pdfPath); err != nil {
	}

	return &PreliminaryConclusionResponse{
		ConclusionFileID: fileID,
		GeneratedAt:      time.Now().Format("02.01.2006 15:04"),
	}, nil
}

func (s *AnalysisService) getLocalizedMessage(key, language string) string {
	messages := map[string]map[string]string{
		"no_files_uploaded": {
			"ru": "Файлы не были загружены для анализа.",
			"en": "No files were uploaded for analysis.",
			"kz": "Талдауға файлдар жүктелмеген.",
		},
		"file_analysis_failed": {
			"ru": "Не удалось проанализировать загруженные файлы. Анализ будет основан только на ответах анкеты.",
			"en": "Failed to analyze uploaded files. Analysis will be based on questionnaire answers only.",
			"kz": "Жүктелген файлдарды талдау мүмкін болмады. Талдау тек сауалнама жауаптарына негізделеді.",
		},
		"uploaded_documents_analysis": {
			"ru": "Анализ загруженных документов",
			"en": "Analysis of Uploaded Documents",
			"kz": "Жүктелген құжаттарды талдау",
		},
		"no_results": {
			"ru": "Нет результатов анализа документов.",
			"en": "No document analysis results.",
			"kz": "Құжат талдауының нәтижелері жоқ.",
		},
		"document": {
			"ru": "Документ",
			"en": "Document",
			"kz": "Құжат",
		},
		"analysis_error": {
			"ru": "Ошибка анализа",
			"en": "Analysis error",
			"kz": "Талдау қатесі",
		},
		"summary": {
			"ru": "Итого",
			"en": "Summary",
			"kz": "Қорытынды",
		},
		"analyzed_successfully": {
			"ru": "проанализировано успешно",
			"en": "analyzed successfully",
			"kz": "сәтті талданды",
		},
		"analysis_failed": {
			"ru": "с ошибками анализа",
			"en": "failed to analyze",
			"kz": "талдау қатесімен",
		},
		"general_conclusion_failed": {
			"ru": "Не удалось сгенерировать общее заключение.",
			"en": "Failed to generate general conclusion.",
			"kz": "Жалпы қорытынды жасау мүмкін болмады.",
		},
	}

	if langMap, exists := messages[key]; exists {
		if msg, exists := langMap[language]; exists {
			return msg
		}
		if msg, exists := langMap["ru"]; exists {
			return msg
		}
	}

	return key
}
