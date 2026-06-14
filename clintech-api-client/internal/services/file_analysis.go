package services

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"time"

	"sync"

	"github.com/beereket/vitalem-api-client/internal/client"
	"github.com/beereket/vitalem-api-client/internal/openai"
	"github.com/beereket/vitalem-api-client/internal/utils/text"
)

type FileReference struct {
	ID            string               `json:"id"`
	FileName      string               `json:"file_name"`
	OriginalName  string               `json:"original_name"`
	MimeType      string               `json:"mime_type"`
	Size          int64                `json:"size"`
	Source        string               `json:"source"`
	AppointmentID string               `json:"appointment_id"`
	Metadata      *client.FileMetadata `json:"metadata,omitempty"`
}

type FileAnalysisRequest struct {
	AppointmentID string          `json:"appointment_id"`
	Files         []FileReference `json:"files"`
	Language      string          `json:"language"`
	Context       string          `json:"context"`
	MaxFiles      int             `json:"max_files"`
}

type VitalSigns struct {
	Temperature *float64 `json:"temperature,omitempty"`   // °C
	SystolicBP  *int     `json:"systolic_bp,omitempty"`   // мм рт. ст.
	DiastolicBP *int     `json:"diastolic_bp,omitempty"` // мм рт. ст.
	Pulse       *int     `json:"pulse,omitempty"`        // уд/мин
	Saturation  *int     `json:"saturation,omitempty"`   // % (SpO2)
}

// StudyData представляет структурированные данные одного анализа
type StudyData struct {
	Title      string `json:"title"`       // Название исследования
	Findings   string `json:"findings"`    // Ключевые находки
	Conclusion string `json:"conclusion"`  // Заключение
}

type AnalysisResult struct {
	FileID      string       `json:"file_id"`
	FileName    string       `json:"file_name"`
	FileType    string       `json:"file_type"`
	Analysis    string       `json:"analysis"`     // Текстовый анализ (для обратной совместимости)
	Studies     []StudyData  `json:"studies,omitempty"` // Структурированные данные анализов из JSON
	Confidence  float64      `json:"confidence"`
	Timestamp   time.Time    `json:"timestamp"`
	Error       string       `json:"error,omitempty"`
	Success     bool         `json:"success"`
	VitalSigns *VitalSigns  `json:"vital_signs,omitempty"` // Витальные показатели, найденные в документе
}

type AnalysisError struct {
	Type    string `json:"type"`
	Message string `json:"message"`
	Retry   bool   `json:"retry"`
}

func (e *AnalysisError) Error() string {
	return fmt.Sprintf("[%s] %s", e.Type, e.Message)
}

type FileAnalysisConfig struct {
	Enabled         bool          `json:"enabled"`
	MaxFileSize     int64         `json:"max_file_size"`
	SupportedTypes  []string      `json:"supported_types"`
	MaxConcurrent   int           `json:"max_concurrent"`
	AnalysisTimeout time.Duration `json:"analysis_timeout"`
	RetryAttempts   int           `json:"retry_attempts"`
	MaxFilesPerReq  int           `json:"max_files_per_req"`
}

func DefaultFileAnalysisConfig() *FileAnalysisConfig {
	return &FileAnalysisConfig{
		Enabled:         true,
		MaxFileSize:     50 * 1024 * 1024, // Увеличено до 20MB для обработки больших медицинских файлов
		SupportedTypes:  []string{"pdf", "jpg", "jpeg", "png", "gif", "bmp", "tiff", "webp", "docx", "txt", "csv"},
		MaxConcurrent:   8,
		AnalysisTimeout: 180 * time.Second,
		RetryAttempts:   3,
		MaxFilesPerReq:  10,
	}
}

func HighPerformanceFileAnalysisConfig() *FileAnalysisConfig {
	return &FileAnalysisConfig{
		Enabled:         true,
		MaxFileSize:     15 * 1024 * 1024,
		SupportedTypes:  []string{"pdf", "jpg", "jpeg", "png", "gif", "bmp", "tiff", "webp", "docx", "txt", "csv"},
		MaxConcurrent:   12,
		AnalysisTimeout: 240 * time.Second,
		RetryAttempts:   2,
		MaxFilesPerReq:  20,
	}
}

func ConservativeFileAnalysisConfig() *FileAnalysisConfig {
	return &FileAnalysisConfig{
		Enabled:         true,
		MaxFileSize:     5 * 1024 * 1024,
		SupportedTypes:  []string{"pdf", "jpg", "jpeg", "png", "gif", "bmp", "tiff", "webp", "docx", "txt", "csv"},
		MaxConcurrent:   3,
		AnalysisTimeout: 120 * time.Second,
		RetryAttempts:   1,
		MaxFilesPerReq:  5,
	}
}

type FileDownloadManager struct {
	fileServerClient  *client.FileServerClient
	appointmentClient *client.AppointmentClient
	config            *FileAnalysisConfig
}

func NewFileDownloadManager(
	fileServerClient *client.FileServerClient,
	appointmentClient *client.AppointmentClient,
	config *FileAnalysisConfig,
) *FileDownloadManager {
	if config == nil {
		config = DefaultFileAnalysisConfig()
	}

	return &FileDownloadManager{
		fileServerClient:  fileServerClient,
		appointmentClient: appointmentClient,
		config:            config,
	}
}

func (dm *FileDownloadManager) DownloadFile(ctx context.Context, ref FileReference, token string) ([]byte, error) {
	if ref.Size > dm.config.MaxFileSize {
		sizeMB := float64(ref.Size) / (1024 * 1024)
		maxMB := float64(dm.config.MaxFileSize) / (1024 * 1024)
		return nil, &AnalysisError{
			Type:    "file_too_large",
			Message: fmt.Sprintf("File %s is too large (%d bytes = %.2f MB, max: %d bytes = %.2f MB)", 
				ref.FileName, ref.Size, sizeMB, dm.config.MaxFileSize, maxMB),
			Retry:   false,
		}
	}

	if !dm.isFileTypeSupported(ref.FileName) {
		return nil, &AnalysisError{
			Type:    "unsupported_format",
			Message: fmt.Sprintf("File type not supported: %s", getFileExtension(ref.FileName)),
			Retry:   false,
		}
	}

	switch ref.Source {
	case "fileserver":
		return dm.downloadFromFileServer(ctx, ref, token)
	case "appointment":
		return dm.downloadFromAppointment(ctx, ref, token)
	default:
		return nil, &AnalysisError{
			Type:    "invalid_source",
			Message: fmt.Sprintf("Unknown file source: %s", ref.Source),
			Retry:   false,
		}
	}
}

func (dm *FileDownloadManager) downloadFromFileServer(ctx context.Context, ref FileReference, token string) ([]byte, error) {
	if dm.fileServerClient == nil {
		return nil, &AnalysisError{
			Type:    "client_unavailable",
			Message: "FileServer client not initialized",
			Retry:   false,
		}
	}

	fileData, err := dm.fileServerClient.DownloadFile(ref.ID, token)
	if err != nil {
		return nil, &AnalysisError{
			Type:    "download_failed",
			Message: fmt.Sprintf("Failed to download from fileserver: %v", err),
			Retry:   true,
		}
	}

	return fileData, nil
}

func (dm *FileDownloadManager) downloadFromAppointment(ctx context.Context, ref FileReference, token string) ([]byte, error) {

	if dm.appointmentClient == nil {
		return nil, &AnalysisError{
			Type:    "client_unavailable",
			Message: "Appointment client not initialized",
			Retry:   false,
		}
	}

	if ref.AppointmentID == "" {
		return nil, &AnalysisError{
			Type:    "invalid_request",
			Message: "AppointmentID required for appointment files",
			Retry:   false,
		}
	}

	fileData, err := dm.appointmentClient.DownloadAppointmentFile(ref.AppointmentID, ref.ID, token)
	if err != nil {
		return nil, &AnalysisError{
			Type:    "download_failed",
			Message: fmt.Sprintf("Failed to download from appointment service: %v", err),
			Retry:   true,
		}
	}

	return fileData, nil
}

func (dm *FileDownloadManager) isFileTypeSupported(fileName string) bool {
	ext := strings.ToLower(getFileExtension(fileName))
	if ext == "" {
		return false
	}

	for _, supportedType := range dm.config.SupportedTypes {
		if ext == supportedType {
			return true
		}
	}
	return false
}

type FileAnalysisService struct {
	fileDownloader *FileDownloadManager
	openaiClient   *openai.Client
	config         *FileAnalysisConfig
}

func NewFileAnalysisService(
	fileServerClient *client.FileServerClient,
	appointmentClient *client.AppointmentClient,
	openaiClient *openai.Client,
	config *FileAnalysisConfig,
) *FileAnalysisService {
	if config == nil {
		config = DefaultFileAnalysisConfig()
	}

	fileDownloader := NewFileDownloadManager(fileServerClient, appointmentClient, config)

	return &FileAnalysisService{
		fileDownloader: fileDownloader,
		openaiClient:   openaiClient,
		config:         config,
	}
}

type EnhancedFileAnalysisRequest struct {
	AppointmentID    string                 `json:"appointment_id"`
	Files            []FileReference        `json:"files"`
	Language         string                 `json:"language"`
	Context          string                 `json:"context"`
	MaxFiles         int                    `json:"max_files"`
	EnableOCR        bool                   `json:"enable_ocr"`
	OCRFirst         bool                   `json:"ocr_first"`
	Specialty        string                 `json:"specialty"`
	CustomPrompt     string                 `json:"custom_prompt"`
	BatchSize        int                    `json:"batch_size"`
	ProgressCallback func(int, int, string) `json:"-"`
}

type BatchAnalysisProgress struct {
	TotalFiles      int               `json:"total_files"`
	ProcessedFiles  int               `json:"processed_files"`
	SuccessfulFiles int               `json:"successful_files"`
	FailedFiles     int               `json:"failed_files"`
	CurrentFile     string            `json:"current_file"`
	Status          string            `json:"status"`
	Results         []*AnalysisResult `json:"results"`
	StartTime       time.Time         `json:"start_time"`
	EstimatedEnd    time.Time         `json:"estimated_end"`
}

func (fas *FileAnalysisService) AnalyzeFilesEnhanced(ctx context.Context, req *EnhancedFileAnalysisRequest, token string) (*BatchAnalysisProgress, error) {

	if !fas.config.Enabled {
		return &BatchAnalysisProgress{
			Status: "disabled",
		}, nil
	}

	if len(req.Files) == 0 {
		return &BatchAnalysisProgress{
			Status: "no_files",
		}, nil
	}


	progress := &BatchAnalysisProgress{
		TotalFiles: len(req.Files),
		StartTime:  time.Now(),
		Status:     "starting",
		Results:    make([]*AnalysisResult, 0, len(req.Files)),
	}

	maxFiles := req.MaxFiles
	if maxFiles <= 0 || maxFiles > fas.config.MaxFilesPerReq {
		maxFiles = fas.config.MaxFilesPerReq
	}

	filesToAnalyze := req.Files
	if len(filesToAnalyze) > maxFiles {
		filesToAnalyze = filesToAnalyze[:maxFiles]
		progress.TotalFiles = maxFiles
	}

	batchSize := req.BatchSize
	if batchSize <= 0 {
		batchSize = fas.calculateOptimalBatchSize(filesToAnalyze)
	}

	maxBatchSize := fas.config.MaxConcurrent
	if maxBatchSize > 12 {
		maxBatchSize = 12
	}
	if batchSize > maxBatchSize {
		batchSize = maxBatchSize
	}

	if batchSize < 1 {
		batchSize = 1
	}

	progress.Status = "processing"


	results := make([]*AnalysisResult, len(filesToAnalyze))

	sem := make(chan struct{}, batchSize)
	var wg sync.WaitGroup
	var mutex sync.Mutex

	for i, fileRef := range filesToAnalyze {
		wg.Add(1)

		go func(index int, file FileReference) {
			defer wg.Done()
			defer func() {
				if r := recover(); r != nil {
					mutex.Lock()
					if results[index] == nil {
						results[index] = &AnalysisResult{
							FileID:    file.ID,
							FileName:  file.FileName,
							FileType:  getFileTypeWithMimeType(file.FileName, file.MimeType),
							Timestamp: time.Now(),
							Success:   false,
							Error:     fmt.Sprintf("Analysis panic: %v", r),
						}
					}
					mutex.Unlock()
				}
			}()

			select {
			case <-ctx.Done():
				mutex.Lock()
				results[index] = &AnalysisResult{
					FileID:    file.ID,
					FileName:  file.FileName,
					FileType:  getFileTypeWithMimeType(file.FileName, file.MimeType),
					Timestamp: time.Now(),
					Success:   false,
					Error:     "Analysis cancelled: " + ctx.Err().Error(),
				}
				progress.ProcessedFiles++
				progress.FailedFiles++
				mutex.Unlock()
				return
			default:
			}

			select {
			case sem <- struct{}{}:
				defer func() { <-sem }()
			case <-ctx.Done():
				return
			}

			if req.ProgressCallback != nil {
				req.ProgressCallback(progress.ProcessedFiles+1, progress.TotalFiles, file.FileName)
			}


		result := fas.analyzeFileEnhanced(ctx, file, req, token)

		mutex.Lock()
			results[index] = result
			progress.ProcessedFiles++
			if result.Success {
				progress.SuccessfulFiles++
				if len(result.Analysis) > 0 {
					preview := result.Analysis
					if len(preview) > 200 {
						preview = preview[:200] + "..."
					}
				}
			} else {
				progress.FailedFiles++
				if result.Analysis != "" {
				}
			}
			progress.CurrentFile = file.FileName
			progress.Results = append(progress.Results, result)

			if progress.ProcessedFiles > 0 {
				elapsed := time.Since(progress.StartTime)
				avgTimePerFile := elapsed / time.Duration(progress.ProcessedFiles)
				remainingFiles := progress.TotalFiles - progress.ProcessedFiles
				progress.EstimatedEnd = time.Now().Add(avgTimePerFile * time.Duration(remainingFiles))
			}
			mutex.Unlock()

		}(i, fileRef)
	}

	wg.Wait()

	progress.Status = "completed"
	progress.ProcessedFiles = len(filesToAnalyze)

	_ = time.Since(progress.StartTime)
	if progress.ProcessedFiles > 0 {
	}

	return progress, nil
}

func (fas *FileAnalysisService) analyzeFileEnhanced(ctx context.Context, fileRef FileReference, req *EnhancedFileAnalysisRequest, token string) *AnalysisResult {
	result := &AnalysisResult{
		FileID:    fileRef.ID,
		FileName:  fileRef.FileName,
		FileType:  getFileTypeWithMimeType(fileRef.FileName, fileRef.MimeType),
		Timestamp: time.Now(),
		Success:   false,
	}

	fileData, err := fas.fileDownloader.DownloadFile(ctx, fileRef, token)
	if err != nil {
		result.Error = err.Error()
		return result
	}

	if fas.openaiClient == nil {
		result.Error = "OpenAI client not available"
		result.Analysis = fmt.Sprintf("File downloaded successfully (%d bytes) but analysis service is not configured.", len(fileData))
		return result
	}

	documentType := detectDocumentTypeFromFilename(fileRef.FileName)
	fileType := getFileTypeWithMimeType(fileRef.FileName, fileRef.MimeType)

	if fileType == "document" || fileType == "spreadsheet" {
		return fas.analyzeTextDocument(ctx, fileData, fileRef, req, documentType, result)
	}

	// Для изображений автоматически включаем OCR, если он не был явно отключен
	// Это улучшает распознавание текста на фотографиях медицинских документов
	enableOCR := req.EnableOCR
	if fileType == "image" && !req.EnableOCR {
		// Для изображений включаем OCR по умолчанию для лучшего распознавания
		enableOCR = true
	}


	enhancedOptions := openai.EnhancedMedicalAnalysisOptions{
		Language:     req.Language,
		Context:      req.Context,
		DocumentType: documentType,
		Specialty:    req.Specialty,
		Detailed:     true,
		MaxPages:     10,
		Confidence:   0.8,
		EnableOCR:    enableOCR,
		OCRFirst:     req.OCRFirst,
		CustomPrompt: req.CustomPrompt,
	}
	

	var visionResponse *openai.VisionResponse
	var analysisErr error

	maxRetries := fas.config.RetryAttempts
	for attempt := 0; attempt <= maxRetries; attempt++ {
		if attempt > 0 {
		}

		analysisCtx, cancel := context.WithTimeout(ctx, fas.config.AnalysisTimeout)
		visionResponse, analysisErr = fas.openaiClient.AnalyzeMedicalFileEnhanced(
			analysisCtx,
			fileData,
			fileRef.FileName,
			enhancedOptions,
		)

		cancel()

		if analysisErr == nil {
			if visionResponse != nil {
				responsePreview := visionResponse.Description
				if len(responsePreview) > 500 {
					responsePreview = responsePreview[:500] + "..."
				}
				log.Printf("[Интерпретация данных исследований] Метод: AnalyzeMedicalFileEnhanced | Ответ OpenAI: длина=%d, превью=%s", len(visionResponse.Description), responsePreview)
			}
			break
		}


		if attempt < maxRetries && isTimeoutError(analysisErr) {
			retryDelay := time.Duration(attempt+1) * 2 * time.Second
			time.Sleep(retryDelay)
			continue
		}

		break
	}

	if analysisErr != nil {
		result.Error = analysisErr.Error()

		if isTimeoutError(analysisErr) {
			result.Analysis = fmt.Sprintf("File downloaded (%d bytes) but analysis timed out after %d attempts. This may be due to large file size or complex content. Consider using smaller files or images instead of PDFs.",
				len(fileData), maxRetries+1)
		} else {
			result.Analysis = fmt.Sprintf("File downloaded (%d bytes) but enhanced analysis failed: %v", len(fileData), analysisErr)
		}
		return result
	}

	confidence := enhancedOptions.Confidence
	if visionResponse.Tokens > 0 {
		confidence = calculateAnalysisConfidence(visionResponse, enhancedOptions)
	}

	result.Success = true
	result.Confidence = confidence
	rawAnalysis := cleanInvalidUTF8(visionResponse.Description)
	
	// Логируем формат ответа
	isJSON := strings.TrimSpace(rawAnalysis)[0] == '{' || strings.TrimSpace(rawAnalysis)[0] == '['
	log.Printf("[Интерпретация данных исследований] Файл: %s | Формат ответа: %s (первые 100 символов: %s)", 
		fileRef.FileName, map[bool]string{true: "JSON", false: "ТЕКСТ"}[isJSON], 
		func() string {
			if len(rawAnalysis) > 100 {
				return rawAnalysis[:100] + "..."
			}
			return rawAnalysis
		}())
	
	vitalSigns, cleanedAnalysis := extractVitalSignsFromResponse(rawAnalysis)
	if vitalSigns != nil {
		result.VitalSigns = vitalSigns
		log.Printf("[Интерпретация данных исследований] Файл: %s | Извлечены витальные показатели", fileRef.FileName)
	}
	
	studies, jsonErr := parseJSONResponse(cleanedAnalysis)
	if jsonErr == nil && len(studies) > 0 {
		result.Studies = studies
		result.Analysis = formatStudiesToText(studies)
		log.Printf("[Интерпретация данных исследований] Файл: %s | Успешный парсинг JSON: найдено исследований=%d", fileRef.FileName, len(studies))
		for i, study := range studies {
			titlePreview := study.Title
			if len(titlePreview) > 50 {
				titlePreview = titlePreview[:50] + "..."
			}
			findingsPreview := study.Findings
			if len(findingsPreview) > 100 {
				findingsPreview = findingsPreview[:100] + "..."
			}
			conclusionPreview := study.Conclusion
			if len(conclusionPreview) > 100 {
				conclusionPreview = conclusionPreview[:100] + "..."
			}
			log.Printf("[Интерпретация данных исследований] Файл: %s | Исследование #%d: title='%s' | findings_len=%d | conclusion_len=%d | findings_preview='%s' | conclusion_preview='%s'", 
				fileRef.FileName, i+1, titlePreview, len(study.Findings), len(study.Conclusion), findingsPreview, conclusionPreview)
		}
	} else {
		result.Analysis = cleanedAnalysis
		log.Printf("[Интерпретация данных исследований] Файл: %s | Парсинг JSON не удался: ошибка=%v, используется fallback (длина текста=%d)", 
			fileRef.FileName, jsonErr, len(cleanedAnalysis))
		if extractedStudies := extractStudiesFromText(cleanedAnalysis); len(extractedStudies) > 0 {
			result.Studies = extractedStudies
			log.Printf("[Интерпретация данных исследований] Файл: %s | Fallback парсинг: извлечено исследований=%d", fileRef.FileName, len(extractedStudies))
			for i, study := range extractedStudies {
				titlePreview := study.Title
				if len(titlePreview) > 50 {
					titlePreview = titlePreview[:50] + "..."
				}
				findingsPreview := study.Findings
				if len(findingsPreview) > 100 {
					findingsPreview = findingsPreview[:100] + "..."
				}
				conclusionPreview := study.Conclusion
				if len(conclusionPreview) > 100 {
					conclusionPreview = conclusionPreview[:100] + "..."
				}
				log.Printf("[Интерпретация данных исследований] Файл: %s | Исследование #%d (fallback): title='%s' | findings_len=%d | conclusion_len=%d | findings_preview='%s' | conclusion_preview='%s'", 
					fileRef.FileName, i+1, titlePreview, len(study.Findings), len(study.Conclusion), findingsPreview, conclusionPreview)
			}
		} else {
			log.Printf("[Интерпретация данных исследований] Файл: %s | Fallback парсинг: исследования не извлечены, используется исходный текст", fileRef.FileName)
		}
	}

	// Проверяем, что анализ не пустой и содержит полезную информацию
	analysisTrimmed := strings.TrimSpace(result.Analysis)
	if len(analysisTrimmed) < 50 {
	}

	// Проверяем на признаки неудачного анализа
	analysisLower := strings.ToLower(analysisTrimmed)
	if strings.Contains(analysisLower, "не удалось") || 
	   strings.Contains(analysisLower, "не могу") ||
	   strings.Contains(analysisLower, "не вижу") ||
	   strings.Contains(analysisLower, "неразборчив") ||
	   strings.Contains(analysisLower, "пустой") ||
	   (strings.Contains(analysisLower, "не выявлено") && len(analysisTrimmed) < 100) {
	}

	return result
}

func (fas *FileAnalysisService) analyzeTextDocument(ctx context.Context, fileData []byte, fileRef FileReference, req *EnhancedFileAnalysisRequest, documentType openai.DocumentType, result *AnalysisResult) *AnalysisResult {
	
	tempFile, err := fas.createTempFile(fileData, fileRef.FileName)
	if err != nil {
		result.Error = fmt.Sprintf("Failed to create temporary file: %v", err)
		return result
	}
	defer os.Remove(tempFile)

	var extractedText string
	ext := getFileExtension(fileRef.FileName)

	switch ext {
	case "docx":
		extractedText, err = text.ExtractTextFromDOCX(tempFile)
	case "txt":
		extractedText, err = text.ExtractTextFromTXT(tempFile)
	case "csv":
		extractedText, err = text.ExtractTextFromCSV(tempFile)
	default:
		result.Error = fmt.Sprintf("Unsupported text document type: %s", ext)
		return result
	}

	if err != nil {
		result.Error = fmt.Sprintf("Failed to extract text from %s: %v", ext, err)
		return result
	}


	if len(strings.TrimSpace(extractedText)) == 0 {
		result.Error = "No text content found in document"
		result.Analysis = fmt.Sprintf("Document %s appears to be empty or contains no readable text.", fileRef.FileName)
		return result
	}

	analysisPrompt := fas.buildMedicalAnalysisPrompt(extractedText, fileRef.FileName, documentType, req)

	textReq := openai.TextGenerationRequest{
		Input:        analysisPrompt,
		Language:     req.Language,
		Instructions: req.CustomPrompt,
		Temperature:  &[]float64{0.3}[0],
	}

	var textResponse *openai.TextGenerationResponse
	var analysisErr error
	maxRetries := fas.config.RetryAttempts

	for attempt := 0; attempt <= maxRetries; attempt++ {
		if attempt > 0 {
		}

		analysisCtx, cancel := context.WithTimeout(ctx, fas.config.AnalysisTimeout)
		requestStartTime := time.Now()

		textResponse, analysisErr = fas.openaiClient.GenerateText(analysisCtx, textReq)
		_ = time.Since(requestStartTime)

		cancel()

		if analysisErr == nil {
			if textResponse != nil {
				responsePreview := textResponse.Text
				if len(responsePreview) > 500 {
					responsePreview = responsePreview[:500] + "..."
				}
				log.Printf("[Интерпретация данных исследований] Метод: GenerateText | Ответ OpenAI: длина=%d, превью=%s", len(textResponse.Text), responsePreview)
			}
			break
		}


		if attempt < maxRetries && isTimeoutError(analysisErr) {
			retryDelay := time.Duration(attempt+1) * 2 * time.Second
			time.Sleep(retryDelay)
			continue
		}
		break
	}

	if analysisErr != nil {
		result.Error = analysisErr.Error()
		if isTimeoutError(analysisErr) {
			result.Analysis = fmt.Sprintf("Text extracted successfully (%d characters) but analysis timed out after %d attempts. Document may be too large or complex.",
				len(extractedText), maxRetries+1)
		} else {
			result.Analysis = fmt.Sprintf("Text extracted successfully (%d characters) but analysis failed: %v", len(extractedText), analysisErr)
		}
		return result
	}

	result.Success = true
	result.Confidence = 0.85
	rawAnalysis := cleanInvalidUTF8(textResponse.Text)
	
	// Логируем формат ответа
	isJSON := len(strings.TrimSpace(rawAnalysis)) > 0 && (strings.TrimSpace(rawAnalysis)[0] == '{' || strings.TrimSpace(rawAnalysis)[0] == '[')
	log.Printf("[Интерпретация данных исследований] Файл: %s | Формат ответа: %s (первые 100 символов: %s)", 
		fileRef.FileName, map[bool]string{true: "JSON", false: "ТЕКСТ"}[isJSON], 
		func() string {
			if len(rawAnalysis) > 100 {
				return rawAnalysis[:100] + "..."
			}
			return rawAnalysis
		}())
	
	vitalSigns, cleanedAnalysis := extractVitalSignsFromResponse(rawAnalysis)
	if vitalSigns != nil {
		result.VitalSigns = vitalSigns
		log.Printf("[Интерпретация данных исследований] Файл: %s | Извлечены витальные показатели", fileRef.FileName)
	}
	
	studies, jsonErr := parseJSONResponse(cleanedAnalysis)
	if jsonErr == nil && len(studies) > 0 {
		result.Studies = studies
		result.Analysis = formatStudiesToText(studies)
		log.Printf("[Интерпретация данных исследований] Файл: %s | Успешный парсинг JSON: найдено исследований=%d", fileRef.FileName, len(studies))
		for i, study := range studies {
			titlePreview := study.Title
			if len(titlePreview) > 50 {
				titlePreview = titlePreview[:50] + "..."
			}
			findingsPreview := study.Findings
			if len(findingsPreview) > 100 {
				findingsPreview = findingsPreview[:100] + "..."
			}
			conclusionPreview := study.Conclusion
			if len(conclusionPreview) > 100 {
				conclusionPreview = conclusionPreview[:100] + "..."
			}
			log.Printf("[Интерпретация данных исследований] Файл: %s | Исследование #%d: title='%s' | findings_len=%d | conclusion_len=%d | findings_preview='%s' | conclusion_preview='%s'", 
				fileRef.FileName, i+1, titlePreview, len(study.Findings), len(study.Conclusion), findingsPreview, conclusionPreview)
		}
	} else {
		result.Analysis = cleanedAnalysis
		log.Printf("[Интерпретация данных исследований] Файл: %s | Парсинг JSON не удался: ошибка=%v, используется fallback (длина текста=%d)", 
			fileRef.FileName, jsonErr, len(cleanedAnalysis))
		if extractedStudies := extractStudiesFromText(cleanedAnalysis); len(extractedStudies) > 0 {
			result.Studies = extractedStudies
			log.Printf("[Интерпретация данных исследований] Файл: %s | Fallback парсинг: извлечено исследований=%d", fileRef.FileName, len(extractedStudies))
			for i, study := range extractedStudies {
				titlePreview := study.Title
				if len(titlePreview) > 50 {
					titlePreview = titlePreview[:50] + "..."
				}
				findingsPreview := study.Findings
				if len(findingsPreview) > 100 {
					findingsPreview = findingsPreview[:100] + "..."
				}
				conclusionPreview := study.Conclusion
				if len(conclusionPreview) > 100 {
					conclusionPreview = conclusionPreview[:100] + "..."
				}
				log.Printf("[Интерпретация данных исследований] Файл: %s | Исследование #%d (fallback): title='%s' | findings_len=%d | conclusion_len=%d | findings_preview='%s' | conclusion_preview='%s'", 
					fileRef.FileName, i+1, titlePreview, len(study.Findings), len(study.Conclusion), findingsPreview, conclusionPreview)
			}
		} else {
			log.Printf("[Интерпретация данных исследований] Файл: %s | Fallback парсинг: исследования не извлечены, используется исходный текст", fileRef.FileName)
		}
	}

	return result
}

func (fas *FileAnalysisService) createTempFile(data []byte, originalFileName string) (string, error) {
	ext := filepath.Ext(originalFileName)
	tempFile, err := os.CreateTemp("", fmt.Sprintf("analysis_*%s", ext))
	if err != nil {
		return "", err
	}

	defer tempFile.Close()

	if _, err := tempFile.Write(data); err != nil {
		os.Remove(tempFile.Name())
		return "", err
	}

	return tempFile.Name(), nil
}

func (fas *FileAnalysisService) buildMedicalAnalysisPrompt(textContent, fileName string, docType openai.DocumentType, req *EnhancedFileAnalysisRequest) string {
	isHealthPassportContext := strings.HasPrefix(req.Context, "health_passport_generation")
	if isHealthPassportContext {
		basePrompt := openai.GetMedicalFilesAnalysisPrompt(req.Language, req.Context)
		
		prompt := fmt.Sprintf(`%s

Документ: %s

Содержимое документа:
%s

Проведите анализ документа согласно инструкциям выше.`, basePrompt, fileName, textContent)
		
		return prompt
	}
	
	basePrompt := "Вы ведущий медицинский эксперт, анализирующий медицинский документ. Предоставьте комплексный медицинский анализ на русском языке."

	var typeInstructions string
	switch docType {
	case openai.DocTypeBloodTest:
		typeInstructions = "Это анализ крови. Обратите особое внимание на значения показателей, нормы, отклонения и их клиническое значение."
	case openai.DocTypeRadiology:
		typeInstructions = "Это радиологическое исследование. Проанализируйте описанные находки, заключения и рекомендации."
	case openai.DocTypeCardiology:
		typeInstructions = "Это кардиологическое исследование. Обратите внимание на показатели сердечной деятельности и их интерпретацию."
	case openai.DocTypeUltrasound:
		typeInstructions = "Это ультразвуковое исследование. Проанализируйте описанные структуры и патологические изменения."
	case openai.DocTypePrescription:
		typeInstructions = "Это рецепт или назначение. Проанализируйте лекарственные препараты, дозировки и показания."
	default:
		typeInstructions = "Проанализируйте медицинское содержание документа."
	}

	var contextInstruction string
	if req.Context != "" {
		contextInstruction = fmt.Sprintf("Контекст использования: %s", req.Context)
	}

	var formatInstruction string
	
	// Для других контекстов используем текстовый формат (всегда русский)
	// Примечание: если бы это был health_passport_generation, мы бы уже вернулись выше
	formatInstruction = `КРИТИЧЕСКИ ВАЖНО - ФОРМАТ ОТВЕТА (ОБЯЗАТЕЛЬНО):

ВНИМАНИЕ: Если в документе содержится ОДИН анализ - используйте формат ниже.
Если в документе содержится НЕСКОЛЬКО анализов (например, ЭКГ, ЭхоКГ, КТ, анализы крови и т.д.) - 
каждый анализ должен быть представлен ОТДЕЛЬНО в следующем формате:

[Название типа исследования 1]

Ключевые находки: [перечислите все ключевые находки через точку с запятой, в одну строку]

Заключение: [развернутое заключение в 2-4 предложениях]

[Название типа исследования 2]

Ключевые находки: [перечислите все ключевые находки через точку с запятой, в одну строку]

Заключение: [развернутое заключение в 2-4 предложениях]

И так далее для каждого анализа.

ПРАВИЛА ДЛЯ НАЗВАНИЯ ТИПА ИССЛЕДОВАНИЯ:
- Название должно быть КОРОТКИМ и содержать ТОЛЬКО тип исследования (например: "Электрокардиограмма", "ЭКГ", "Эхокардиография", "ЭхоКГ", "Компьютерная томография", "КТ", "Анализ крови", "Биохимический анализ крови", "Общий анализ мочи")
- НЕ включайте в название описательные слова, измерения, характеристики (например, НЕ пишите "Эхокардиография аорта уплотнена" - пишите только "Эхокардиография")
- НЕ включайте в название единицы измерения, размеры, значения (например, НЕ пишите "ЭКГ 83 уд/мин" - пишите только "ЭКГ")
- Если в документе несколько анализов одного типа (например, два разных ЭКГ), укажите это в названии: "Электрокардиограмма 1", "Электрокардиограмма 2" или добавьте дату: "Электрокардиограмма (20.11.2025)"

ПРАВИЛА ДЛЯ КЛЮЧЕВЫХ НАХОДОК:
- Перечислите ВСЕ важные находки через точку с запятой в ОДНУ строку
- Включите все важные значения, измерения и наблюдения
- Пример: "синусовый ритм; неполная блокада правой ножки пучка Гиса; фракция выброса левого желудочка сохранена (≥50%); признаков острого инфаркта миокарда с подъемом сегмента ST не выявлено; частота сердечных сокращений 69 в минуту; ось электрической активности сердца в пределах нормы; остальные интервалы и длительности в пределах нормальных значений"

ПРАВИЛА ДЛЯ ЗАКЛЮЧЕНИЯ:
- Развернутое заключение в 2-4 предложениях
- Включите клиническую интерпретацию, значимость находок и рекомендации при необходимости
- Пример: "Электрокардиограмма демонстрирует сохраненный синусовый ритм и нормальную функцию левого желудочка без признаков инфаркта, выявлена неполная блокада правой ножки пучка Гиса, что требует клинического наблюдения и при необходимости дополнительного обследования."

ВАЖНО: 
- БЕЗ markdown заголовков (###, ##, #)
- БЕЗ жирного текста (**)
- БЕЗ списков с маркерами
- Каждый анализ должен быть четко отделен от другого пустой строкой
- Название типа исследования должно быть на ОТДЕЛЬНОЙ строке, БЕЗ дополнительного текста`

	prompt := fmt.Sprintf(`%s

%s

%s

Документ: %s

Содержимое документа:
%s

Проведите подробный медицинский анализ документа.

%s

ПРИМЕР ПРАВИЛЬНОГО ФОРМАТА ДЛЯ НЕСКОЛЬКИХ АНАЛИЗОВ:

Электрокардиограмма

Ключевые находки: синусовый ритм; частота сердечных сокращений 83 уд/мин; электрическая ось сердца горизонтальная; преобладание потенциалов левого желудочка; интервалы RR, P, PQ, QRS, QT в пределах нормы; сегмент ST положительный

Заключение: Электрокардиограмма без признаков аритмий или нарушений проводимости, с нормальным синусовым ритмом и нормальной электрической осью сердца, отмечается преобладание потенциалов левого желудочка, что может соответствовать нормальной вариабельности.

Эхокардиография

Ключевые находки: аорта уплотнена и склерозирована, не расширена (3.0 см); восходящий отдел аорты фиброзно уплотнен, умеренно расширен (4.0 см); аортальный клапан трехстворчатый, уплотнен, умеренно кальцинирован, раскрытие 2.1 см; левое предсердие увеличено в передне-заднем размере (3.8 см); левый желудочек не расширен; сократимость миокарда снижена (42%%); фракция выброса сохранена (74%%)

Заключение: У пациентки выявлены признаки склерозирования и умеренного кальциноза аортального клапана с сохраненной фракцией выброса и сниженной сократимостью миокарда. Отмечается умеренное расширение восходящего отдела аорты и увеличение размеров левого предсердия. Рекомендуется динамическое наблюдение и при необходимости консультация кардиолога.

Компьютерная томография коленного сустава

Ключевые находки: неравномерное сужение рентгеновских суставных щелей; неровные суставные поверхности; уплотнённые субхондральные зоны с единичными субхондральными кистами на медиальном мыщелке бедренной кости диаметром до 0,26 см; истончение суставного хряща с признаками дегенеративных изменений; истончение менисков с признаками дегенеративных изменений; умеренная деформация задней крестообразной связки

Заключение: КТ выявляет признаки остеоартроза правого коленного сустава. Для более детальной оценки состояния связочного аппарата и менисков рекомендуется проведение МРТ.

ВАЖНО: 
- НЕ используйте markdown заголовки (###, ##, #)
- НЕ используйте жирный текст (**)
- НЕ используйте списки с маркерами
- Используйте ТОЛЬКО указанный формат выше
- Ключевые находки должны быть в ОДНУ строку через точку с запятой
- Заключение должно быть в 2-4 предложениях
- Если в документе НЕСКОЛЬКО анализов - каждый анализ должен быть представлен ОТДЕЛЬНО с четкой структурой: Название -> Ключевые находки -> Заключение
- Название типа исследования должно быть КОРОТКИМ и содержать ТОЛЬКО тип исследования, БЕЗ описательных слов, измерений или характеристик
- Между разными анализами должна быть пустая строка для четкого разделения
- НЕ пишите в названии такие слова как "уплотнена", "расширена", "увеличен", "см", "мм", "уд/мин" и другие описательные элементы - это должно быть только в ключевых находках`,
		basePrompt,
		typeInstructions,
		contextInstruction,
		fileName,
		textContent,
		formatInstruction)
	
	return prompt
}

func detectDocumentTypeFromFilename(fileName string) openai.DocumentType {
	fileNameLower := strings.ToLower(fileName)

	if strings.Contains(fileNameLower, "кров") || strings.Contains(fileNameLower, "blood") ||
		strings.Contains(fileNameLower, "анализ") || strings.Contains(fileNameLower, "lab") {
		return openai.DocTypeBloodTest
	}

	if strings.Contains(fileNameLower, "рентген") || strings.Contains(fileNameLower, "xray") ||
		strings.Contains(fileNameLower, "кт") || strings.Contains(fileNameLower, "ct") ||
		strings.Contains(fileNameLower, "мрт") || strings.Contains(fileNameLower, "mri") {
		return openai.DocTypeRadiology
	}

	if strings.Contains(fileNameLower, "узи") || strings.Contains(fileNameLower, "ultrasound") ||
		strings.Contains(fileNameLower, "usg") || strings.Contains(fileNameLower, "эхо") {
		return openai.DocTypeUltrasound
	}

	if strings.Contains(fileNameLower, "экг") || strings.Contains(fileNameLower, "ecg") ||
		strings.Contains(fileNameLower, "кардио") || strings.Contains(fileNameLower, "cardio") ||
		strings.Contains(fileNameLower, "сердце") || strings.Contains(fileNameLower, "heart") {
		return openai.DocTypeCardiology
	}

	if strings.Contains(fileNameLower, "рецепт") || strings.Contains(fileNameLower, "prescription") ||
		strings.Contains(fileNameLower, "лекарств") || strings.Contains(fileNameLower, "medication") {
		return openai.DocTypePrescription
	}

	return openai.DocTypeGeneral
}

func isTimeoutError(err error) bool {
	if err == nil {
		return false
	}

	errStr := strings.ToLower(err.Error())
	return strings.Contains(errStr, "timeout") ||
		strings.Contains(errStr, "deadline exceeded") ||
		strings.Contains(errStr, "context canceled") ||
		strings.Contains(errStr, "connection timed out")
}

func calculateAnalysisConfidence(response *openai.VisionResponse, options openai.EnhancedMedicalAnalysisOptions) float64 {
	baseConfidence := options.Confidence

	if response.Tokens > 500 {
		baseConfidence += 0.1
	} else if response.Tokens < 100 {
		baseConfidence -= 0.1
	}

	if options.EnableOCR {
		baseConfidence += 0.05
	}

	if options.CustomPrompt != "" {
		baseConfidence += 0.05
	}

	if baseConfidence > 0.95 {
		baseConfidence = 0.95
	}
	if baseConfidence < 0.1 {
		baseConfidence = 0.1
	}

	return baseConfidence
}

// AnalyzeFilesResult содержит результаты анализа файлов и витальные показатели
type AnalyzeFilesResult struct {
	Analysis   string      `json:"analysis"`
	VitalSigns *VitalSigns `json:"vital_signs,omitempty"`
}

func (fas *FileAnalysisService) AnalyzeFiles(ctx context.Context, req *FileAnalysisRequest, token string) (string, error) {

	enhancedReq := &EnhancedFileAnalysisRequest{
		AppointmentID: req.AppointmentID,
		Files:         req.Files,
		Language:      req.Language,
		Context:       req.Context,
		MaxFiles:      req.MaxFiles,
		EnableOCR:     false,
		OCRFirst:      false,
		BatchSize:     fas.config.MaxConcurrent,
	}

	progress, err := fas.AnalyzeFilesEnhanced(ctx, enhancedReq, token)
	if err != nil {
		return "", err
	}

	// Собираем витальные показатели из всех результатов
	var aggregatedVitalSigns *VitalSigns
	for _, result := range progress.Results {
		if result.VitalSigns != nil {
			if aggregatedVitalSigns == nil {
				aggregatedVitalSigns = &VitalSigns{}
			}
			// Объединяем витальные показатели (приоритет у первого найденного)
			if result.VitalSigns.Temperature != nil && aggregatedVitalSigns.Temperature == nil {
				aggregatedVitalSigns.Temperature = result.VitalSigns.Temperature
			}
			if result.VitalSigns.SystolicBP != nil && aggregatedVitalSigns.SystolicBP == nil {
				aggregatedVitalSigns.SystolicBP = result.VitalSigns.SystolicBP
			}
			if result.VitalSigns.DiastolicBP != nil && aggregatedVitalSigns.DiastolicBP == nil {
				aggregatedVitalSigns.DiastolicBP = result.VitalSigns.DiastolicBP
			}
			if result.VitalSigns.Pulse != nil && aggregatedVitalSigns.Pulse == nil {
				aggregatedVitalSigns.Pulse = result.VitalSigns.Pulse
			}
			if result.VitalSigns.Saturation != nil && aggregatedVitalSigns.Saturation == nil {
				aggregatedVitalSigns.Saturation = result.VitalSigns.Saturation
			}
		}
	}

	result := fas.formatAnalysisResults(progress.Results, req.Language, req.Context)

	return result, nil
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// calculateSimilarity вычисляет схожесть двух строк (0.0 - 1.0)
func calculateSimilarity(str1, str2 string) float64 {
	if str1 == str2 {
		return 1.0
	}
	
	// Нормализуем строки (убираем пробелы, приводим к нижнему регистру)
	normalize := func(s string) string {
		s = strings.ToLower(s)
		s = regexp.MustCompile(`\s+`).ReplaceAllString(s, " ")
		return strings.TrimSpace(s)
	}
	
	norm1 := normalize(str1)
	norm2 := normalize(str2)
	
	if norm1 == norm2 {
		return 1.0
	}
	
	// Простой алгоритм схожести на основе длины общей подстроки
	len1 := len(norm1)
	len2 := len(norm2)
	
	if len1 == 0 || len2 == 0 {
		return 0.0
	}
	
	// Находим длину общей подстроки
	maxLen := len1
	if len2 > maxLen {
		maxLen = len2
	}
	
	// Простая проверка: если одна строка содержит другую
	if strings.Contains(norm1, norm2) || strings.Contains(norm2, norm1) {
		minLen := len1
		if len2 < minLen {
			minLen = len2
		}
		return float64(minLen) / float64(maxLen)
	}
	
	// Подсчитываем общие слова
	words1 := strings.Fields(norm1)
	words2 := strings.Fields(norm2)
	
	commonWords := 0
	for _, w1 := range words1 {
		for _, w2 := range words2 {
			if w1 == w2 {
				commonWords++
				break
			}
		}
	}
	
	totalWords := len(words1) + len(words2)
	if totalWords == 0 {
		return 0.0
	}
	
	// Возвращаем процент общих слов
	return float64(commonWords*2) / float64(totalWords)
}

func (fas *FileAnalysisService) formatAnalysisResults(results []*AnalysisResult, language string, context string) string {
	
	if len(results) == 0 {
		return getLocalizedMessage("no_results", language)
	}

	if strings.HasPrefix(context, "health_passport_generation") {
		// Для health_passport_generation объединяем похожие файлы и форматируем компактно
		result := fas.formatAnalysisResultsForHealthPassport(results, language)
		return result
	}

	var sections []string

	for _, result := range results {
		if result.Success {
			analysis := result.Analysis
			sections = append(sections, analysis)
		} else {
			sections = append(sections, fmt.Sprintf("❌ %s: %s",
				getLocalizedMessage("error", language), result.Error))
		}
	}

	return strings.Join(sections, "\n\n")
}

// formatAnalysisResultsForHealthPassport форматирует результаты для паспорта здоровья
// Включает ВСЕ успешно обработанные файлы без фильтрации и дедупликации
func (fas *FileAnalysisService) formatAnalysisResultsForHealthPassport(results []*AnalysisResult, language string) string {
	var sections []string

	for _, result := range results {
		if !result.Success {
			continue
		}

		var studies []StudyData
		if len(result.Studies) > 0 {
			studies = result.Studies
		} else {
			// Нет структурированных данных - пытаемся извлечь из текста (fallback)
			analysis := result.Analysis
			// Пытаемся извлечь структурированные данные из текста
			extractedStudies := extractStudiesFromText(analysis)
			if len(extractedStudies) > 0 {
				studies = extractedStudies
			} else {
				// Не удалось извлечь - используем старый метод splitMultipleStudies
				textStudies := fas.splitMultipleStudies(analysis, result.FileName)
				// Конвертируем текстовые исследования в StudyData
				for _, textStudy := range textStudies {
					studyLines := strings.Split(textStudy, "\n")
					if len(studyLines) > 0 {
						title := strings.TrimSpace(studyLines[0])
						var findings, conclusion string
						// Пытаемся извлечь findings и conclusion из текста
						for _, line := range studyLines[1:] {
							lineLower := strings.ToLower(strings.TrimSpace(line))
							if strings.HasPrefix(lineLower, "ключевые находки:") {
								findings = strings.TrimSpace(strings.TrimPrefix(line, "Ключевые находки:"))
								findings = strings.TrimPrefix(findings, "ключевые находки:")
								findings = strings.TrimSpace(findings)
							} else if strings.HasPrefix(lineLower, "заключение:") {
								conclusion = strings.TrimSpace(strings.TrimPrefix(line, "Заключение:"))
								conclusion = strings.TrimPrefix(conclusion, "заключение:")
								conclusion = strings.TrimSpace(conclusion)
							} else if findings == "" && strings.TrimSpace(line) != "" {
								findings = strings.TrimSpace(line)
							} else if conclusion == "" && strings.TrimSpace(line) != "" {
								conclusion = strings.TrimSpace(line)
							}
						}
						if title != "" {
							studies = append(studies, StudyData{
								Title:      title,
								Findings:   findings,
								Conclusion: conclusion,
							})
						}
					}
				}
				if len(studies) == 0 {
					// Если все еще пусто - создаем одно исследование из всего текста
					docType := fas.detectDocumentTypeFromAnalysis(analysis, result.FileName)
					date := fas.extractDateFromAnalysis(analysis)
					title := docType
					if date != "" {
						title += " (" + date + ")"
					}
					findings, conclusion := fas.extractFindingsAndConclusion(analysis)
					studies = []StudyData{{
						Title:      title,
						Findings:   findings,
						Conclusion: conclusion,
					}}
				}
			}
		}
		
		// Обрабатываем все найденные исследования
		for _, study := range studies {
			studyTitle := strings.TrimSpace(study.Title)
			
			// ПРОВЕРЯЕМ НА ДУБЛИКАТЫ ПЕРЕД ДОБАВЛЕНИЕМ
			isDuplicate := false
			
			// Нормализуем заголовок для сравнения
			studyTitleNormalized := strings.ToLower(strings.TrimSpace(studyTitle))
			
			// Формируем текстовое представление исследования для проверки дубликатов
			var formattedStudy strings.Builder
			formattedStudy.WriteString(studyTitle)
			formattedStudy.WriteString("\n\nКлючевые находки: ")
			if study.Findings != "" {
				formattedStudy.WriteString(study.Findings)
			} else {
				formattedStudy.WriteString("не выявлено")
			}
			formattedStudy.WriteString("\n\nЗаключение: ")
			if study.Conclusion != "" {
				formattedStudy.WriteString(study.Conclusion)
			} else {
				formattedStudy.WriteString("требуется дополнительное обследование")
			}
			studyText := formattedStudy.String()
			
			for _, existingSection := range sections {
				existingLines := strings.Split(existingSection, "\n")
				existingTitle := ""
				if len(existingLines) > 0 {
					existingTitle = strings.TrimSpace(existingLines[0])
				}
				existingTitleNormalized := strings.ToLower(strings.TrimSpace(existingTitle))
				
				// Сравниваем по нормализованным заголовкам
				if studyTitleNormalized != "" && existingTitleNormalized != "" {
					// Точное совпадение нормализованных заголовков
					if studyTitleNormalized == existingTitleNormalized {
						// Проверяем, не является ли это дубликатом по содержимому
						studyContent := strings.TrimSpace(study.Findings + " " + study.Conclusion)
						existingContent := strings.TrimSpace(strings.Join(existingLines[1:], "\n"))
						// Если содержимое похоже (более 80% совпадения) - это дубликат
						if len(studyContent) > 0 && len(existingContent) > 0 {
							similarity := calculateSimilarity(studyContent, existingContent)
							if similarity > 0.8 {
								isDuplicate = true
								break
							}
						} else {
							// Если заголовки совпадают, но содержимое пустое или очень короткое - считаем дубликатом
							if len(studyContent) < 50 && len(existingContent) < 50 {
								isDuplicate = true
								break
							}
						}
					} else if len(studyTitleNormalized) > 2 && len(existingTitleNormalized) > 2 {
						// Проверяем, не является ли один заголовок частью другого
						if strings.Contains(studyTitleNormalized, existingTitleNormalized) || strings.Contains(existingTitleNormalized, studyTitleNormalized) {
							// Проверяем содержимое для более точного определения
							studyContent := strings.TrimSpace(study.Findings + " " + study.Conclusion)
							existingContent := strings.TrimSpace(strings.Join(existingLines[1:], "\n"))
							if len(studyContent) > 0 && len(existingContent) > 0 {
								similarity := calculateSimilarity(studyContent, existingContent)
								if similarity > 0.9 {
									isDuplicate = true
									break
								}
							}
						}
					}
				}
			}
			
			if !isDuplicate {
				sections = append(sections, studyText)
			}
		}
	}

	// Объединяем все секции с пустой строкой между ними для четкого разделения
	result := strings.Join(sections, "\n\n")

	// Убираем лишние пустые строки в конце
	result = strings.TrimSpace(result)

	// ЛОГИРУЕМ ВСЕ TITLES ДОБАВЛЕННЫХ ИССЛЕДОВАНИЙ
	for _, section := range sections {
		sectionLines := strings.Split(section, "\n")
		title := ""
		if len(sectionLines) > 0 {
			title = strings.TrimSpace(sectionLines[0])
		}
		if title == "" {
			title = "(empty title)"
		}
	}

	return result
}

// getBaseFileName извлекает базовое имя файла (без расширения и номеров)
func (fas *FileAnalysisService) getBaseFileName(fileName string) string {
	// Убираем расширение
	base := strings.TrimSuffix(fileName, filepath.Ext(fileName))

	// Убираем номера и даты из WhatsApp Image
	base = regexp.MustCompile(`(?i)whatsapp\s+image`).ReplaceAllString(base, "whatsapp_image")
	base = regexp.MustCompile(`\d{4}-\d{2}-\d{2}`).ReplaceAllString(base, "")
	base = regexp.MustCompile(`\s+at\s+\d{2}\.\d{2}\.\d{2}`).ReplaceAllString(base, "")
	base = regexp.MustCompile(`\s+\d+$`).ReplaceAllString(base, "")

	return strings.TrimSpace(base)
}

// detectDocumentTypeFromAnalysis определяет тип документа из анализа
func (fas *FileAnalysisService) detectDocumentTypeFromAnalysis(analysis, fileName string) string {
	// ЛОГИРУЕМ ВХОДНЫЕ ДАННЫЕ
	analysisPreview := analysis
	if len(analysisPreview) > 200 {
		analysisPreview = analysisPreview[:200] + "..."
	}
	
	analysisLower := strings.ToLower(analysis)
	fileNameLower := strings.ToLower(fileName)

	// Сначала проверяем название исследования в начале анализа (если есть)
	// Ищем паттерн: "Тип исследования" в начале текста
	// Также проверяем заголовки типа "**Комплексный медицинский анализ..." 
	firstLine := strings.Split(analysis, "\n")[0]
	firstLineLower := strings.ToLower(strings.TrimSpace(firstLine))
	
	// Убираем markdown разметку из первой строки для анализа
	firstLineClean := regexp.MustCompile(`\*\*([^\*]+)\*\*`).ReplaceAllString(firstLine, "$1")
	firstLineClean = regexp.MustCompile(`\*([^\*]+)\*`).ReplaceAllString(firstLineClean, "$1")
	firstLineCleanLower := strings.ToLower(strings.TrimSpace(firstLineClean))

	// Проверяем, не является ли первая строка названием исследования
	// Также проверяем очищенную версию (без markdown)
	if !strings.Contains(firstLineLower, "ключевые находки") &&
		!strings.Contains(firstLineLower, "заключение") &&
		!strings.Contains(firstLineLower, "key findings") &&
		!strings.Contains(firstLineLower, "conclusion") {
		// Первая строка может быть названием исследования
		// Проверяем как оригинальную, так и очищенную версию
		checkLine := firstLineCleanLower
		
		// Проверяем паттерны "Комплексный медицинский анализ по результатам..."
		if strings.Contains(checkLine, "ультразвукового исследования органов брюшной") ||
		   strings.Contains(checkLine, "узи органов брюшной") ||
		   strings.Contains(checkLine, "узи брюшной полости") {
			return "УЗИ органов брюшной полости"
		}
		if strings.Contains(checkLine, "лабораторных исследований") ||
		   strings.Contains(checkLine, "лабораторное исследование") ||
		   (strings.Contains(checkLine, "комплексный") && strings.Contains(checkLine, "лабораторн")) {
			return "Анализ крови"
		}
		
		if strings.Contains(firstLineLower, "узи щитовидной") || strings.Contains(firstLineLower, "щитовидная") ||
		   strings.Contains(checkLine, "узи щитовидной") || strings.Contains(checkLine, "щитовидная") {
			return "УЗИ щитовидной железы"
		}
		if strings.Contains(firstLineLower, "узи органов брюшной") || strings.Contains(firstLineLower, "узи брюшной") ||
		   strings.Contains(checkLine, "узи органов брюшной") || strings.Contains(checkLine, "узи брюшной") {
			return "УЗИ органов брюшной полости"
		}
		if strings.Contains(firstLineLower, "узи") || strings.Contains(firstLineLower, "ультразвук") ||
		   strings.Contains(checkLine, "узи") || strings.Contains(checkLine, "ультразвук") {
			// По умолчанию общее УЗИ, но потом будет уточнено по содержимому
			return "УЗИ"
		}
		if strings.Contains(firstLineLower, "анализ мочи") || strings.Contains(firstLineLower, "моча") ||
		   strings.Contains(checkLine, "анализ мочи") || strings.Contains(checkLine, "моча") {
			return "Анализ мочи"
		}
		if strings.Contains(firstLineLower, "анализ крови") || strings.Contains(firstLineLower, "общий анализ") || strings.Contains(firstLineLower, "биохимия") ||
		   strings.Contains(checkLine, "анализ крови") || strings.Contains(checkLine, "общий анализ") || strings.Contains(checkLine, "биохимия") {
			return "Анализ крови"
		}
		if strings.Contains(firstLineLower, "экг") || strings.Contains(firstLineLower, "электрокардиограмма") ||
		   strings.Contains(checkLine, "экг") || strings.Contains(checkLine, "электрокардиограмма") {
			return "ЭКГ"
		}
		if strings.Contains(firstLineLower, "рентген") || strings.Contains(firstLineLower, "x-ray") ||
		   strings.Contains(checkLine, "рентген") || strings.Contains(checkLine, "x-ray") {
			return "Рентгенография"
		}
		// Проверяем "Мультиспиральная компьютерная томография" ПЕРЕД общей проверкой КТ
		if strings.Contains(firstLineLower, "мультиспиральная компьютерная томография") ||
		   strings.Contains(checkLine, "мультиспиральная компьютерная томография") {
			// Определяем область исследования
			if strings.Contains(firstLineLower, "органов грудной полости") ||
			   strings.Contains(checkLine, "органов грудной полости") {
				return "Мультиспиральная компьютерная томография органов грудной полости"
			}
			if strings.Contains(firstLineLower, "органов брюшной полости") ||
			   strings.Contains(checkLine, "органов брюшной полости") {
				return "Мультиспиральная компьютерная томография органов брюшной полости"
			}
			if strings.Contains(firstLineLower, "головного мозга") ||
			   strings.Contains(checkLine, "головного мозга") {
				return "Мультиспиральная компьютерная томография головного мозга"
			}
			// Общая мультиспиральная КТ
			return "Мультиспиральная компьютерная томография"
		}
		if strings.Contains(firstLineLower, "кт") || strings.Contains(firstLineLower, "компьютерная томография") ||
		   strings.Contains(checkLine, "кт") || strings.Contains(checkLine, "компьютерная томография") {
			// Определяем область исследования для обычной КТ
			if strings.Contains(firstLineLower, "органов грудной полости") ||
			   strings.Contains(checkLine, "органов грудной полости") {
				return "Компьютерная томография органов грудной полости"
			}
			if strings.Contains(firstLineLower, "органов брюшной полости") ||
			   strings.Contains(checkLine, "органов брюшной полости") {
				return "Компьютерная томография органов брюшной полости"
			}
			if strings.Contains(firstLineLower, "головного мозга") ||
			   strings.Contains(checkLine, "головного мозга") {
				return "Компьютерная томография головного мозга"
			}
			if strings.Contains(firstLineLower, "коленного сустава") ||
			   strings.Contains(checkLine, "коленного сустава") {
				return "Компьютерная томография коленного сустава"
			}
			return "КТ"
		}
		if strings.Contains(firstLineLower, "мрт") || strings.Contains(firstLineLower, "магнитно-резонансная томография") ||
		   strings.Contains(checkLine, "мрт") || strings.Contains(checkLine, "магнитно-резонансная томография") {
			return "МРТ"
		}
	}

	// Определяем по ключевым словам в анализе (приоритет - упоминания органов и методов)
	// ВАЖНО: Анализ мочи проверяем ПЕРВЫМ, чтобы не перепутать с УЗИ
	// Анализ мочи - приоритет перед всеми остальными (более специфичный)
	if strings.Contains(analysisLower, "анализ мочи") || strings.Contains(analysisLower, "общий анализ мочи") ||
		strings.Contains(analysisLower, "лабораторные исследования мочи") || strings.Contains(analysisLower, "лабораторное исследование мочи") ||
		strings.Contains(analysisLower, "мочевыделительной") || strings.Contains(analysisLower, "мочевыделительная система") ||
		strings.Contains(analysisLower, "гемоглобин в моче") || strings.Contains(analysisLower, "микрогематурия") ||
		strings.Contains(analysisLower, "эритроциты в моче") || strings.Contains(analysisLower, "лейкоциты в моче") ||
		strings.Contains(analysisLower, "функция почек") ||
		(strings.Contains(analysisLower, "моча") && !strings.Contains(analysisLower, "щитовидная") && !strings.Contains(analysisLower, "эхогенность")) ||
		strings.Contains(fileNameLower, "моча") || strings.Contains(fileNameLower, "urine") {
		return "Анализ мочи"
	}

	// УЗИ предстательной железы - приоритет перед общим УЗИ (только для мужчин)
	if strings.Contains(analysisLower, "предстательная железа") || strings.Contains(analysisLower, "предстательной железы") ||
		strings.Contains(analysisLower, "простат") || strings.Contains(analysisLower, "prostate") ||
		strings.Contains(fileNameLower, "простат") || strings.Contains(fileNameLower, "prostate") {
		return "УЗИ предстательной железы"
	}

	// УЗИ щитовидной железы - приоритет перед общим УЗИ
	// Проверяем специфичные признаки УЗИ щитовидной железы
	// Если есть хотя бы один специфичный признак щитовидной железы - это УЗИ щитовидной железы
	hasThyroidSigns := strings.Contains(analysisLower, "щитовидная железа") ||
		strings.Contains(analysisLower, "щитовидной") ||
		strings.Contains(analysisLower, "щитовидка") ||
		strings.Contains(analysisLower, "тиреоид") ||
		strings.Contains(analysisLower, "доли щитовидной") ||
		strings.Contains(analysisLower, "перешеек") ||
		strings.Contains(analysisLower, "правая доля") ||
		strings.Contains(analysisLower, "левая доля") ||
		strings.Contains(analysisLower, "объем щитовидной") ||
		strings.Contains(analysisLower, "объем железы") ||
		strings.Contains(analysisLower, "см³") ||
		strings.Contains(analysisLower, "диффузные изменения щитовидной") ||
		strings.Contains(fileNameLower, "щитовид") ||
		strings.Contains(fileNameLower, "thyroid")

	// Если есть васкуляризация И нет признаков органов брюшной полости - это тоже может быть щитовидная
	hasVascularization := strings.Contains(analysisLower, "васкуляризация")
	hasAbdomenSigns := strings.Contains(analysisLower, "печень") ||
		strings.Contains(analysisLower, "желчный пузырь") ||
		strings.Contains(analysisLower, "гепатомегалия") ||
		strings.Contains(analysisLower, "холецистит") ||
		strings.Contains(analysisLower, "жировой гепатоз")

	if hasThyroidSigns || (hasVascularization && !hasAbdomenSigns) {
		return "УЗИ щитовидной железы"
	}

	// УЗИ органов брюшной полости - приоритет перед общим УЗИ
	if strings.Contains(analysisLower, "печень") || strings.Contains(analysisLower, "желчный пузырь") ||
		strings.Contains(analysisLower, "поджелудочная") || strings.Contains(analysisLower, "селезенка") ||
		strings.Contains(analysisLower, "селезёнка") || strings.Contains(analysisLower, "гепатомегалия") ||
		strings.Contains(analysisLower, "холецистит") || strings.Contains(analysisLower, "жировой гепатоз") ||
		strings.Contains(analysisLower, "застой желчи") || strings.Contains(analysisLower, "деформация желчного") ||
		strings.Contains(analysisLower, "утолщение стенки") || strings.Contains(analysisLower, "взвесь в желчном") ||
		strings.Contains(analysisLower, "осадок в полости") || strings.Contains(analysisLower, "органов брюшной полости") ||
		strings.Contains(analysisLower, "ультразвуковое исследование органов") ||
		strings.Contains(analysisLower, "ультразвукового исследования органов брюшной") ||
		strings.Contains(analysisLower, "комплексный медицинский анализ по результатам ультразвукового исследования органов брюшной") ||
		(strings.Contains(analysisLower, "почки") && !strings.Contains(analysisLower, "моче") && !strings.Contains(analysisLower, "щитовидной")) {
		return "УЗИ органов брюшной полости"
	}

	// Общее УЗИ - если упоминается ультразвуковое исследование, но не определено конкретно
	// НО НЕ если это про мочу, щитовидную или органы брюшной полости (уже проверили выше)
	// Проверяем, что это НЕ щитовидная (нет специфичных признаков)
	isNotThyroid := !strings.Contains(analysisLower, "щитовидной") &&
		!strings.Contains(analysisLower, "щитовидная") &&
		!strings.Contains(analysisLower, "перешеек") &&
		!strings.Contains(analysisLower, "правая доля") &&
		!strings.Contains(analysisLower, "левая доля") &&
		!strings.Contains(analysisLower, "объем щитовидной") &&
		!strings.Contains(analysisLower, "объем железы") &&
		!strings.Contains(analysisLower, "см³")

	// Проверяем, что это НЕ органы брюшной полости (нет специфичных признаков)
	isNotAbdomen := !strings.Contains(analysisLower, "печень") &&
		!strings.Contains(analysisLower, "желчный пузырь") &&
		!strings.Contains(analysisLower, "гепатомегалия") &&
		!strings.Contains(analysisLower, "холецистит") &&
		!strings.Contains(analysisLower, "жировой гепатоз") &&
		!strings.Contains(analysisLower, "застой желчи")

	if isNotThyroid && isNotAbdomen && ((strings.Contains(analysisLower, "эхогенность") && !strings.Contains(analysisLower, "моче")) ||
		strings.Contains(analysisLower, "эхоструктура") ||
		(strings.Contains(analysisLower, "узи") && !strings.Contains(analysisLower, "моче")) ||
		(strings.Contains(analysisLower, "ультразвук") && !strings.Contains(analysisLower, "моче")) ||
		(strings.Contains(analysisLower, "ultrasound") && !strings.Contains(analysisLower, "urine")) ||
		(strings.Contains(fileNameLower, "узи") && !strings.Contains(fileNameLower, "моча")) ||
		(strings.Contains(fileNameLower, "ultrasound") && !strings.Contains(fileNameLower, "urine"))) {
		return "УЗИ"
	}

	// ЭКГ
	if strings.Contains(analysisLower, "экг") || strings.Contains(analysisLower, "электрокардиограмма") ||
		strings.Contains(analysisLower, "синусовый ритм") || strings.Contains(analysisLower, "зубец") ||
		strings.Contains(fileNameLower, "ecg") || strings.Contains(fileNameLower, "ekg") {
		return "ЭКГ"
	}

	// Анализ состава тела
	if strings.Contains(analysisLower, "анализ состава тела") || strings.Contains(analysisLower, "inbody") ||
		strings.Contains(fileNameLower, "inbody") {
		return "Анализ состава тела"
	}

	// Анализ крови - упоминания показателей крови, гемоглобин, лейкоциты, эритроциты, СОЭ
	// НО НЕ если это про мочу (уже проверили выше)
	if strings.Contains(analysisLower, "анализ крови") || strings.Contains(analysisLower, "общий анализ крови") ||
		strings.Contains(analysisLower, "биохимия") ||
		strings.Contains(analysisLower, "комплексный медицинский анализ лабораторных исследований") ||
		strings.Contains(analysisLower, "лабораторных исследований") ||
		(strings.Contains(analysisLower, "гемоглобин") && !strings.Contains(analysisLower, "моче")) ||
		(strings.Contains(analysisLower, "лейкоциты") && !strings.Contains(analysisLower, "моче")) ||
		(strings.Contains(analysisLower, "эритроциты") && !strings.Contains(analysisLower, "моче")) ||
		strings.Contains(analysisLower, "соэ") || strings.Contains(analysisLower, "эозинофилы") ||
		(strings.Contains(analysisLower, "лабораторные данные") && !strings.Contains(analysisLower, "моче")) ||
		(strings.Contains(analysisLower, "лабораторное обследование") && !strings.Contains(analysisLower, "моче")) {
		return "Анализ крови"
	}

	// Рентген
	if strings.Contains(analysisLower, "рентген") || strings.Contains(analysisLower, "x-ray") ||
		strings.Contains(analysisLower, "рентгенография") {
		return "Рентгенография"
	}

	// КТ - проверяем "Мультиспиральная компьютерная томография" ПЕРЕД общей проверкой КТ
	if strings.Contains(analysisLower, "мультиспиральная компьютерная томография") ||
		strings.Contains(analysisLower, "мультиспиральная компьютерная томограмма") {
		// Определяем область исследования
		if strings.Contains(analysisLower, "органов грудной полости") {
			return "Мультиспиральная компьютерная томография органов грудной полости"
		}
		if strings.Contains(analysisLower, "органов брюшной полости") {
			return "Мультиспиральная компьютерная томография органов брюшной полости"
		}
		if strings.Contains(analysisLower, "головного мозга") {
			return "Мультиспиральная компьютерная томография головного мозга"
		}
		// Общая мультиспиральная КТ
		return "Мультиспиральная компьютерная томография"
	}
	// КТ
	if strings.Contains(analysisLower, "кт") || strings.Contains(analysisLower, "компьютерная томография") ||
		strings.Contains(analysisLower, "компьютерная томограмма") {
		// Определяем область исследования для обычной КТ
		if strings.Contains(analysisLower, "органов грудной полости") {
			return "Компьютерная томография органов грудной полости"
		}
		if strings.Contains(analysisLower, "органов брюшной полости") {
			return "Компьютерная томография органов брюшной полости"
		}
		if strings.Contains(analysisLower, "головного мозга") {
			return "Компьютерная томография головного мозга"
		}
		if strings.Contains(analysisLower, "коленного сустава") {
			return "Компьютерная томография коленного сустава"
		}
		return "КТ"
	}

	// МРТ
	if strings.Contains(analysisLower, "мрт") || strings.Contains(analysisLower, "магнитно-резонансная томография") ||
		strings.Contains(analysisLower, "магнитно-резонансная томограмма") {
		result := "МРТ"
		return result
	}

	// Если не определили - возвращаем общий тип
	result := "Медицинское исследование"
	return result
}

// extractDateFromAnalysis извлекает дату из анализа
func (fas *FileAnalysisService) extractDateFromAnalysis(analysis string) string {
	// Удаляем фразы про отсутствие даты перед поиском
	analysis = regexp.MustCompile(`(?i)(дата\s+не\s+указана|date\s+not\s+specified|не\s+указана)`).ReplaceAllString(analysis, "")

	// Ищем паттерны даты: дд.мм.гггг, дд/мм/гггг, гггг-мм-дд
	datePatterns := []*regexp.Regexp{
		regexp.MustCompile(`\d{2}\.\d{2}\.\d{4}`),
		regexp.MustCompile(`\d{2}/\d{2}/\d{4}`),
		regexp.MustCompile(`\d{4}-\d{2}-\d{2}`),
	}

	for _, pattern := range datePatterns {
		matches := pattern.FindString(analysis)
		if matches != "" {
			return matches
		}
	}

	return ""
}

// combineSimilarAnalyses объединяет анализы похожих файлов в один
func (fas *FileAnalysisService) combineSimilarAnalyses(analyses []string, docType, date string) string {
	if len(analyses) == 0 {
		return ""
	}

	if len(analyses) == 1 {
		// Один файл - просто очищаем и возвращаем
		return fas.cleanAndFormatAnalysis(analyses[0], docType, date)
	}

	// Несколько файлов - объединяем информацию
	var allFindings []string
	var allConclusions []string

	for _, analysis := range analyses {
		findings, conclusion := fas.extractFindingsAndConclusion(analysis)
		if findings != "" {
			allFindings = append(allFindings, findings)
		}
		if conclusion != "" {
			allConclusions = append(allConclusions, conclusion)
		}
	}

	// Объединяем находки (убираем дубликаты)
	uniqueFindings := fas.mergeUniqueFindings(allFindings)

	// Объединяем заключения
	combinedConclusion := fas.mergeConclusions(allConclusions)

	// Форматируем результат с улучшенным оформлением
	return fas.formatAnalysisWithStyle(docType, date, uniqueFindings, combinedConclusion)
}

// splitMultipleStudies разделяет несколько анализов в одном файле
// Ищет все вхождения "Ключевые находки:" и "Заключение:" для разделения
// Также пытается найти анализы по заголовкам разделов
func (fas *FileAnalysisService) splitMultipleStudies(analysis, fileName string) []string {
	var studies []string
	
	// Очищаем от невалидных UTF-8 символов
	analysis = cleanInvalidUTF8(analysis)
	
	// Сохраняем оригинальный анализ для поиска по заголовкам
	originalAnalysis := analysis
	
	// Убираем markdown заголовки и форматирование (но сохраняем структуру для поиска)
	analysisWithoutMarkdown := analysis
	analysisWithoutMarkdown = regexp.MustCompile(`#{1,6}\s+`).ReplaceAllString(analysisWithoutMarkdown, "")
	analysisWithoutMarkdown = regexp.MustCompile(`\*\*([^*]+)\*\*`).ReplaceAllString(analysisWithoutMarkdown, "$1")
	analysisWithoutMarkdown = regexp.MustCompile(`\*([^*]+)\*`).ReplaceAllString(analysisWithoutMarkdown, "$1")
	
	// Ищем все вхождения "Ключевые находки:" или "Key findings:"
	findingsPattern := regexp.MustCompile(`(?i)(?:ключевые\s+находки|key\s+findings)[:\s]+`)
	findingsMatches := findingsPattern.FindAllStringIndex(analysisWithoutMarkdown, -1)
	
	if len(findingsMatches) == 0 {
		// Нет структурированных находок - пытаемся найти анализы по другим паттернам
		// 1. Ищем по заголовкам разделов (### 1., ### 2., 1. ..., 2. ...)
		sectionPattern := regexp.MustCompile(`(?i)(?:^|\n)\s*(?:#{1,6}\s*)?\d+\.\s+[^\n]+`)
		sectionMatches := sectionPattern.FindAllStringIndex(originalAnalysis, -1)
		
		// 2. Ищем по типам исследований (ЭКГ, УЗИ, КТ, анализ крови и т.д.)
		// Ищем в начале строк или после разделителей
		studyTypePattern := regexp.MustCompile(`(?i)(?:^|\n\s*\n)\s*(?:электрокардиограмма|экг|ультразвуковое\s+исследование|ультразвуковое|узи|компьютерная\s+томография|кт|магнитно-резонансная\s+томография|мрт|анализ\s+крови|лабораторные\s+исследования|эхокардиография|эхокг|рентген|маммография|флюорография|гастроскопия|колоноскопия|комплексный\s+медицинский\s+анализ)[^\n]*`)
		studyTypeMatches := studyTypePattern.FindAllStringIndex(originalAnalysis, -1)
		
		// Также ищем упоминания типов исследований в тексте (не только в начале строк)
		// Это поможет найти анализы, которые упоминаются в середине текста
		studyTypeInTextPattern := regexp.MustCompile(`(?i)(?:электрокардиограмма|экг|ультразвуковое\s+исследование|ультразвуковое|узи\s+(?:органов|щитовидной|молочных)|компьютерная\s+томография|кт\s+(?:органов|головного|грудной)|магнитно-резонансная\s+томография|мрт|анализ\s+крови|лабораторные\s+исследования|эхокардиография|эхокг|рентген|маммография|флюорография|гастроскопия|колоноскопия)`)
		studyTypeInTextMatches := studyTypeInTextPattern.FindAllStringIndex(originalAnalysis, -1)
		
		// Объединяем результаты, убирая дубликаты (если один и тот же тип найден в начале строки и в тексте)
		allStudyTypeMatches := studyTypeMatches
		for _, textMatch := range studyTypeInTextMatches {
			// Проверяем, не является ли это дубликатом
			isDuplicate := false
			for _, existingMatch := range allStudyTypeMatches {
				// Если расстояние между совпадениями меньше 50 символов - это дубликат
				if math.Abs(float64(textMatch[0]-existingMatch[0])) < 50 {
					isDuplicate = true
					break
				}
			}
			if !isDuplicate {
				allStudyTypeMatches = append(allStudyTypeMatches, textMatch)
			}
		}
		
		// Сортируем по позиции в тексте
		sort.Slice(allStudyTypeMatches, func(i, j int) bool {
			return allStudyTypeMatches[i][0] < allStudyTypeMatches[j][0]
		})
		
		studyTypeMatches = allStudyTypeMatches
		
		// 3. Ищем по паттернам "---" или пустым строкам между разделами
		separatorPattern := regexp.MustCompile(`\n\s*\n\s*\n+`)
		separatorMatches := separatorPattern.FindAllStringIndex(originalAnalysis, -1)
		
		
		// Если нашли несколько типов исследований - проверяем, нужно ли разделять
		if len(studyTypeMatches) > 1 {
			// Проверяем расстояние между типами исследований
			// Если они слишком близко (меньше 500 символов) - возможно, это один анализ
			shouldSplit := true
			for i := 0; i < len(studyTypeMatches)-1; i++ {
				distance := studyTypeMatches[i+1][0] - studyTypeMatches[i][1]
				if distance < 500 {
					// Типы слишком близко - возможно, это упоминания в одном анализе
					shouldSplit = false
					break
				}
			}
			
			if shouldSplit {
				return fas.splitByStudyTypes(originalAnalysis, studyTypeMatches, fileName)
			}
		}
		
		// Если нашли несколько разделов с нумерацией - проверяем, не является ли это одним комплексным анализом
		if len(sectionMatches) > 1 {
			// Проверяем, есть ли в начале документа указание на комплексный анализ
			first500Chars := strings.ToLower(originalAnalysis[:min(500, len(originalAnalysis))])
			hasComplexAnalysisHeader := strings.Contains(first500Chars, "комплексный медицинский анализ") ||
				strings.Contains(first500Chars, "комплексный анализ") ||
				strings.Contains(first500Chars, "на основании всех представленных данных") ||
				strings.Contains(first500Chars, "по данным эхокардиографических исследований") ||
				strings.Contains(first500Chars, "по результатам")
			
			if hasComplexAnalysisHeader {
				// Не разделяем - это один комплексный анализ
				return []string{}
			}
			
			// Проверяем, все ли разделы имеют один и тот же тип исследования
			// Если да - это один анализ, разделенный на части
			allSameType := true
			var firstDocType string
			for i, match := range sectionMatches {
				start := match[0]
				end := len(originalAnalysis)
				if i < len(sectionMatches)-1 {
					end = sectionMatches[i+1][0]
				}
				sectionText := strings.TrimSpace(originalAnalysis[start:end])
				docType := fas.detectDocumentTypeFromAnalysis(sectionText, fileName)
				
				if i == 0 {
					firstDocType = docType
				} else if docType != firstDocType && docType != "" && firstDocType != "" {
					allSameType = false
					break
				}
			}
			
			if allSameType && firstDocType != "" {
				// Не разделяем - это один анализ
				return []string{}
			}
			
			return fas.splitByNumberedSections(originalAnalysis, sectionMatches, fileName)
		}
		
		// Если нашли несколько разделителей - возможно, это несколько анализов
		if len(separatorMatches) > 2 {
			return fas.splitBySeparators(originalAnalysis, separatorMatches, fileName)
		}
		
		// Не нашли явных разделений - пытаемся определить количество анализов по структуре
		// Анализируем длину документа, количество абзацев, наличие ключевых слов
		
		// Разделяем по двойным переносам строк (возможные разделы)
		paragraphs := strings.Split(originalAnalysis, "\n\n")
		nonEmptyParagraphs := 0
		for _, p := range paragraphs {
			if strings.TrimSpace(p) != "" && len(strings.TrimSpace(p)) > 50 {
				nonEmptyParagraphs++
			}
		}
		
		
		// Если документ очень длинный (>5000 символов) и много абзацев (>5) - возможно, это несколько анализов
		if len(originalAnalysis) > 5000 && nonEmptyParagraphs > 5 {
			splitStudies := fas.splitByDocumentStructure(originalAnalysis, fileName)
			if len(splitStudies) > 1 {
				return splitStudies
			}
		}
		
		// Не смогли разделить - возвращаем пустой массив, чтобы использовать весь анализ
		return studies
	}
	
	
	// Для каждого вхождения "Ключевые находки:" ищем соответствующее "Заключение:"
	// Используем originalAnalysis для извлечения текста, чтобы сохранить весь контент
	for i, findingsStart := range findingsMatches {
		// Находим начало "Ключевые находки:" в originalAnalysis
		// Нужно найти соответствующую позицию в originalAnalysis
		findingsTextStart := findingsStart[1]
		
		// Ищем соответствующее "Заключение:" после "Ключевые находки:"
		// Ищем в originalAnalysis, но используем индексы из analysisWithoutMarkdown
		textAfterFindings := analysisWithoutMarkdown[findingsTextStart:]
		conclusionPattern := regexp.MustCompile(`(?i)(?:\n\s*\n\s*|\n\s*)(?:Заключение|Conclusion)[:\s]+`)
		conclusionMatch := conclusionPattern.FindStringIndex(textAfterFindings)
		
		var findingsText, conclusionText string
		var analysisEnd int
		
		// Для извлечения текста используем originalAnalysis, но с учетом индексов из analysisWithoutMarkdown
		// Находим позицию "Ключевые находки:" в originalAnalysis
		findingsPatternInOriginal := regexp.MustCompile(`(?i)(?:ключевые\s+находки|key\s+findings)[:\s]+`)
		allFindingsInOriginal := findingsPatternInOriginal.FindAllStringIndex(originalAnalysis, -1)
		if len(allFindingsInOriginal) <= i {
			// Несоответствие индексов - пропускаем
			continue
		}
		originalFindingsStart := allFindingsInOriginal[i]
		originalFindingsTextStart := originalFindingsStart[1]
		
		if conclusionMatch != nil {
			// Нашли "Заключение:" - извлекаем находки и заключение из originalAnalysis
			// Находим "Заключение:" в originalAnalysis
			textAfterFindingsOriginal := originalAnalysis[originalFindingsTextStart:]
			conclusionMatchOriginal := conclusionPattern.FindStringIndex(textAfterFindingsOriginal)
			if conclusionMatchOriginal != nil {
				findingsText = strings.TrimSpace(textAfterFindingsOriginal[:conclusionMatchOriginal[0]])
				conclusionStart := originalFindingsTextStart + conclusionMatchOriginal[1]
				
				// Ищем конец заключения (до следующего "Ключевые находки:" или до конца)
				if i < len(findingsMatches)-1 {
					// Есть следующий анализ - берем до него
					nextFindingsStart := allFindingsInOriginal[i+1][0]
					conclusionText = strings.TrimSpace(originalAnalysis[conclusionStart:nextFindingsStart])
					analysisEnd = nextFindingsStart
				} else {
					// Последний анализ - берем до конца
					conclusionText = strings.TrimSpace(originalAnalysis[conclusionStart:])
					analysisEnd = len(originalAnalysis)
				}
			}
		} else {
			// Не нашли "Заключение:" - берем все до следующего "Ключевые находки:" или до конца
			if i < len(findingsMatches)-1 {
				nextFindingsStart := allFindingsInOriginal[i+1][0]
				findingsText = strings.TrimSpace(originalAnalysis[originalFindingsTextStart:nextFindingsStart])
				analysisEnd = nextFindingsStart
			} else {
				findingsText = strings.TrimSpace(originalAnalysis[originalFindingsTextStart:])
				analysisEnd = len(originalAnalysis)
			}
		}
		
		// Определяем название исследования (тип документа)
		// ВАЖНО: Всегда используем detectDocumentTypeFromAnalysis для определения типа документа,
		// а не берем весь текст между "Ключевые находки:", так как там может быть описание, которое должно быть в ключевых находках
		studyNameStart := 0
		if i > 0 {
			studyNameStart = allFindingsInOriginal[i-1][1]
		}
		
		// Используем весь текст анализа для определения типа документа
		analysisTextForTypeDetection := originalAnalysis[studyNameStart:analysisEnd]
		
		docType := fas.detectDocumentTypeFromAnalysis(analysisTextForTypeDetection, fileName)
		date := fas.extractDateFromAnalysis(analysisTextForTypeDetection)
		
		// Формируем название исследования только из типа документа и даты
		studyName := docType
		if date != "" {
			studyName += " (" + date + ")"
		}
		
		// ВСЕГДА очищаем studyName от описательного текста, даже если docType был определен
		// Извлекаем текст перед "Ключевые находки:" для проверки
		rawStudyName := originalAnalysis[studyNameStart:originalFindingsStart[0]]
		rawStudyName = strings.TrimSpace(rawStudyName)
		// Убираем лишние переносы строк
		rawStudyName = regexp.MustCompile(`\s+`).ReplaceAllString(rawStudyName, " ")
		rawStudyName = strings.TrimSpace(rawStudyName)
		
		// КРИТИЧЕСКАЯ ПРОВЕРКА: если rawStudyName слишком короткий (меньше 3 символов) или содержит только одну букву/символ
		// - это явно ошибка, используем docType вместо этого
		if len(rawStudyName) < 3 || (len(rawStudyName) == 1 && !strings.ContainsAny(rawStudyName, "АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯABCDEFGHIJKLMNOPQRSTUVWXYZ")) {
			rawStudyName = "" // Сбрасываем, чтобы использовать docType
		}
		
		// Проверяем, содержит ли rawStudyName описательный текст
		// Если да, то извлекаем только название типа исследования
		isDescription := false
		descriptionPatterns := []string{
			" уплотнена", " склерозирована", " расширена", " не ", " см", " увеличен", " снижен", 
			" повышен", " понижен", " кальцинирован", " дилатация", " гипертрофия", " дисфункция",
			" регургитация", " стеноз", " уплотнен", " уплотнено", " уплотнены", " уплотнены",
			" мм рт. ст.", " уд/мин", " г/м", " мл", " см/с", " мм", " см", " мкмоль",
			" ммоль", " нг/мл", " пмоль", " мкг/л", " г/л", " %", " г", " кг",
			" диастола", " систола", " передне-задний", " апикальной", " размер", " размеры",
			" диаметр", " толщина", " объем", " масса", " индекс", " скорость", " поток",
			" клапан", " створки", " предсердие", " желудочек", " перегородка", " стенка",
			" аорта", " легочная", " митральный", " трикуспидальный", " аортальный",
		}
		
		for _, pattern := range descriptionPatterns {
			if strings.Contains(rawStudyName, pattern) {
				isDescription = true
				break
			}
		}
		
		// Если rawStudyName содержит описательный текст, пытаемся извлечь только название типа
		if isDescription && rawStudyName != "" {
			// Пытаемся найти название типа исследования в начале строки
			// Ищем паттерны типа "Эхокардиография", "ЭКГ", "КТ" и т.д. в начале
			studyTypePattern := regexp.MustCompile(`(?i)^\s*(?:электрокардиограмма|экг|ультразвуковое\s+исследование|ультразвуковое|узи|компьютерная\s+томография|кт|магнитно-резонансная\s+томография|мрт|эхокардиография|эхокг|рентген|маммография|флюорография|гастроскопия|колоноскопия|трансторакальная\s+эхокардиография|мультиспиральная\s+компьютерная\s+томография|анализ\s+крови|биохимический\s+анализ|общий\s+анализ|гематологические\s+исследования|иммунологические\s+исследования|общеклинические\s+исследования|общий\s+анализ\s+мочи)`)
			match := studyTypePattern.FindString(rawStudyName)
			if match != "" {
				extractedType := strings.TrimSpace(match)
				// Используем извлеченный тип, если docType пустой или не определен
				if studyName == "" || studyName == " ()" {
					studyName = extractedType
					if date != "" {
						studyName += " (" + date + ")"
					}
				} else {
					// Если docType уже определен, используем его, но проверяем, что он не содержит описания
					if !isDescriptionText(docType) {
						studyName = docType
						if date != "" {
							studyName += " (" + date + ")"
						}
					} else {
						// docType содержит описание - используем извлеченный тип
						studyName = extractedType
						if date != "" {
							studyName += " (" + date + ")"
						}
					}
				}
			} else {
				// Не смогли извлечь тип из rawStudyName - используем docType, если он не содержит описания
				if studyName == "" || studyName == " ()" {
					if !isDescriptionText(docType) {
						studyName = docType
						if date != "" {
							studyName += " (" + date + ")"
						}
					} else {
						// docType тоже содержит описание - пытаемся использовать только первое слово
						words := strings.Fields(docType)
						if len(words) > 0 {
							studyName = words[0]
							if date != "" {
								studyName += " (" + date + ")"
							}
						}
					}
				}
			}
		} else if studyName == "" || studyName == " ()" {
			// rawStudyName не содержит описания и может быть использован как название
			// НО: проверяем, что он не слишком короткий (минимум 3 символа) и не является одной буквой
			if rawStudyName != "" && len(rawStudyName) >= 3 && len(rawStudyName) < 100 {
				// Дополнительная проверка: не является ли это одной буквой или очень коротким текстом
				words := strings.Fields(rawStudyName)
				if len(words) > 0 && len(words[0]) >= 2 {
					studyName = rawStudyName
					if date != "" {
						studyName += " (" + date + ")"
					}
				} else {
					// rawStudyName слишком короткий - используем docType
					studyName = docType
					if date != "" {
						studyName += " (" + date + ")"
					}
				}
			} else {
				// rawStudyName пустой или слишком длинный - используем docType
				if rawStudyName != "" && len(rawStudyName) < 3 {
				}
				studyName = docType
				if date != "" {
					studyName += " (" + date + ")"
				}
			}
		} else {
			// studyName уже установлен из docType, но проверяем, что он не содержит описания
			if isDescriptionText(studyName) {
				// Пытаемся извлечь только название типа
				studyTypePattern := regexp.MustCompile(`(?i)^\s*(?:электрокардиограмма|экг|ультразвуковое\s+исследование|ультразвуковое|узи|компьютерная\s+томография|кт|магнитно-резонансная\s+томография|мрт|эхокардиография|эхокг|рентген|маммография|флюорография|гастроскопия|колоноскопия|трансторакальная\s+эхокардиография|мультиспиральная\s+компьютерная\s+томография|анализ\s+крови|биохимический\s+анализ|общий\s+анализ|гематологические\s+исследования|иммунологические\s+исследования|общеклинические\s+исследования|общий\s+анализ\s+мочи)`)
				match := studyTypePattern.FindString(studyName)
				if match != "" {
					studyName = strings.TrimSpace(match)
					if date != "" {
						studyName += " (" + date + ")"
					}
				} else {
					// Не смогли извлечь - используем только первое слово
					words := strings.Fields(studyName)
					if len(words) > 0 {
						studyName = words[0]
						if date != "" {
							studyName += " (" + date + ")"
						}
					}
				}
			}
		}
		
		// Финальная проверка: если studyName все еще содержит описательный текст, обрезаем до первого описательного слова
		if isDescriptionText(studyName) {
			words := strings.Fields(studyName)
			cleanWords := []string{}
			for _, word := range words {
				// Проверяем, не является ли слово описательным
				if isDescriptionText(word) {
					break
				}
				cleanWords = append(cleanWords, word)
			}
			if len(cleanWords) > 0 {
				studyName = strings.Join(cleanWords, " ")
			}
		}
		
		// КРИТИЧЕСКАЯ ФИНАЛЬНАЯ ПРОВЕРКА: если studyName слишком короткий (меньше 3 символов) или содержит только одну букву
		// - это явная ошибка, используем docType вместо этого
		studyNameTrimmed := strings.TrimSpace(studyName)
		if len(studyNameTrimmed) < 3 {
			studyName = docType
			if date != "" {
				studyName += " (" + date + ")"
			}
		} else if len(studyNameTrimmed) == 1 && strings.ContainsAny(studyNameTrimmed, "АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯABCDEFGHIJKLMNOPQRSTUVWXYZ") {
			// Если studyName содержит только одну букву (например, "М"), заменяем на docType
			studyName = docType
			if date != "" {
				studyName += " (" + date + ")"
			}
		}
		
		
		// Форматируем находки (убираем лишние переносы строк, но сохраняем структуру)
		findingsText = regexp.MustCompile(`\s+`).ReplaceAllString(findingsText, " ")
		findingsText = strings.TrimSpace(findingsText)
		
		// Форматируем заключение (сохраняем структуру)
		conclusionText = regexp.MustCompile(`\s+`).ReplaceAllString(conclusionText, " ")
		conclusionText = strings.TrimSpace(conclusionText)
		
		// Формируем отформатированный анализ
		var formattedStudy strings.Builder
		formattedStudy.WriteString(studyName)
		formattedStudy.WriteString("\n\n")
		formattedStudy.WriteString("Ключевые находки: ")
		if findingsText != "" {
			formattedStudy.WriteString(findingsText)
		} else {
			formattedStudy.WriteString("не выявлено")
		}
		formattedStudy.WriteString("\n\n")
		formattedStudy.WriteString("Заключение: ")
		if conclusionText != "" {
			formattedStudy.WriteString(conclusionText)
		} else {
			formattedStudy.WriteString("требуется дополнительное обследование")
		}
		formattedStudy.WriteString("\n\n")
		
		studies = append(studies, formattedStudy.String())
		
		// ЛОГИРУЕМ ПЕРВУЮ СТРОКУ СФОРМИРОВАННОГО АНАЛИЗА ДЛЯ ПРОВЕРКИ TITLE
		formattedLines := strings.Split(formattedStudy.String(), "\n")
		if len(formattedLines) > 0 {
		}
	}
	
	return studies
}

// splitByStudyTypes разделяет анализы по типам исследований (ЭКГ, УЗИ, КТ и т.д.)
func (fas *FileAnalysisService) splitByStudyTypes(analysis string, studyTypeMatches [][]int, fileName string) []string {
	var studies []string
	
	for i, match := range studyTypeMatches {
		start := match[0]
		end := len(analysis)
		if i < len(studyTypeMatches)-1 {
			end = studyTypeMatches[i+1][0]
		}
		
		studyText := strings.TrimSpace(analysis[start:end])
		if studyText == "" || len(studyText) < 100 {
			// Пропускаем слишком короткие разделы (меньше 100 символов)
			continue
		}
		
		// Определяем тип исследования из текста
		docType := fas.detectDocumentTypeFromAnalysis(studyText, fileName)
		date := fas.extractDateFromAnalysis(studyText)
		
		// Очищаем docType от описательного текста
		cleanDocType := docType
		if isDescriptionText(cleanDocType) {
			studyTypePattern := regexp.MustCompile(`(?i)^\s*(?:электрокардиограмма|экг|ультразвуковое\s+исследование|ультразвуковое|узи|компьютерная\s+томография|кт|магнитно-резонансная\s+томография|мрт|эхокардиография|эхокг|рентген|маммография|флюорография|гастроскопия|колоноскопия|трансторакальная\s+эхокардиография|мультиспиральная\s+компьютерная\s+томография|анализ\s+крови|биохимический\s+анализ|общий\s+анализ|гематологические\s+исследования|иммунологические\s+исследования|общеклинические\s+исследования|общий\s+анализ\s+мочи)`)
			match := studyTypePattern.FindString(cleanDocType)
			if match != "" {
				cleanDocType = strings.TrimSpace(match)
			} else {
				words := strings.Fields(cleanDocType)
				if len(words) > 0 {
					cleanDocType = words[0]
				}
			}
		}
		
		// Пытаемся извлечь структурированные данные
		findings, conclusion := fas.extractFindingsAndConclusion(studyText)
		
		var formattedStudy strings.Builder
		
		if findings != "" || conclusion != "" {
			// Смогли извлечь структурированные данные
			formattedStudy.WriteString(cleanDocType)
			if date != "" {
				formattedStudy.WriteString(" (")
				formattedStudy.WriteString(date)
				formattedStudy.WriteString(")")
			}
			formattedStudy.WriteString("\n\n")
			formattedStudy.WriteString("Ключевые находки: ")
			if findings != "" {
				formattedStudy.WriteString(findings)
			} else {
				formattedStudy.WriteString("не выявлено")
			}
			formattedStudy.WriteString("\n\n")
			formattedStudy.WriteString("Заключение: ")
			if conclusion != "" {
				formattedStudy.WriteString(conclusion)
			} else {
				formattedStudy.WriteString("требуется дополнительное обследование")
			}
		} else {
			// Не смогли извлечь - используем весь текст
			if cleanDocType != "" {
				formattedStudy.WriteString(cleanDocType)
				if date != "" {
					formattedStudy.WriteString(" (")
					formattedStudy.WriteString(date)
					formattedStudy.WriteString(")")
				}
				formattedStudy.WriteString("\n\n")
			}
			formattedStudy.WriteString(studyText)
		}
		
		studies = append(studies, formattedStudy.String())
	}
	
	return studies
}

// splitByNumberedSections разделяет анализы по нумерованным разделам (1., 2., 3. и т.д.)
func (fas *FileAnalysisService) splitByNumberedSections(analysis string, sectionMatches [][]int, fileName string) []string {
	var studies []string
	
	for i, match := range sectionMatches {
		start := match[0]
		end := len(analysis)
		if i < len(sectionMatches)-1 {
			end = sectionMatches[i+1][0]
		}
		
		studyText := strings.TrimSpace(analysis[start:end])
		if studyText == "" {
			continue
		}
		
		// Определяем тип исследования из текста
		docType := fas.detectDocumentTypeFromAnalysis(studyText, fileName)
		date := fas.extractDateFromAnalysis(studyText)
		
		// Очищаем docType от описательного текста
		cleanDocType := docType
		if isDescriptionText(cleanDocType) {
			studyTypePattern := regexp.MustCompile(`(?i)^\s*(?:электрокардиограмма|экг|ультразвуковое\s+исследование|ультразвуковое|узи|компьютерная\s+томография|кт|магнитно-резонансная\s+томография|мрт|эхокардиография|эхокг|рентген|маммография|флюорография|гастроскопия|колоноскопия|трансторакальная\s+эхокардиография|мультиспиральная\s+компьютерная\s+томография|анализ\s+крови|биохимический\s+анализ|общий\s+анализ|гематологические\s+исследования|иммунологические\s+исследования|общеклинические\s+исследования|общий\s+анализ\s+мочи)`)
			match := studyTypePattern.FindString(cleanDocType)
			if match != "" {
				cleanDocType = strings.TrimSpace(match)
			} else {
				words := strings.Fields(cleanDocType)
				if len(words) > 0 {
					cleanDocType = words[0]
				}
			}
		}
		
		// Пытаемся извлечь структурированные данные
		findings, conclusion := fas.extractFindingsAndConclusion(studyText)
		
		var formattedStudy strings.Builder
		
		if findings != "" || conclusion != "" {
			// Смогли извлечь структурированные данные
			formattedStudy.WriteString(cleanDocType)
			if date != "" {
				formattedStudy.WriteString(" (")
				formattedStudy.WriteString(date)
				formattedStudy.WriteString(")")
			}
			formattedStudy.WriteString("\n\n")
			formattedStudy.WriteString("Ключевые находки: ")
			if findings != "" {
				formattedStudy.WriteString(findings)
			} else {
				formattedStudy.WriteString("не выявлено")
			}
			formattedStudy.WriteString("\n\n")
			formattedStudy.WriteString("Заключение: ")
			if conclusion != "" {
				formattedStudy.WriteString(conclusion)
			} else {
				formattedStudy.WriteString("требуется дополнительное обследование")
			}
		} else {
			// Не смогли извлечь - используем весь текст
			if cleanDocType != "" {
				formattedStudy.WriteString(cleanDocType)
				if date != "" {
					formattedStudy.WriteString(" (")
					formattedStudy.WriteString(date)
					formattedStudy.WriteString(")")
				}
				formattedStudy.WriteString("\n\n")
			}
			formattedStudy.WriteString(studyText)
		}
		
		studies = append(studies, formattedStudy.String())
	}
	
	return studies
}

// splitBySeparators разделяет анализы по разделителям (пустые строки, --- и т.д.)
func (fas *FileAnalysisService) splitBySeparators(analysis string, separatorMatches [][]int, fileName string) []string {
	var studies []string
	
	// Разделяем по разделителям, но только если между ними достаточно текста
	var sections []string
	lastEnd := 0
	
	for _, match := range separatorMatches {
		section := strings.TrimSpace(analysis[lastEnd:match[0]])
		if len(section) > 100 { // Минимум 100 символов для отдельного анализа
			sections = append(sections, section)
		}
		lastEnd = match[1]
	}
	
	// Добавляем последний раздел
	lastSection := strings.TrimSpace(analysis[lastEnd:])
	if len(lastSection) > 100 {
		sections = append(sections, lastSection)
	}
	
	// Если разделили на слишком много частей (больше 10) - возможно, это один анализ
	if len(sections) > 10 {
		return studies
	}
	
	// Форматируем каждый раздел
	for _, section := range sections {
		docType := fas.detectDocumentTypeFromAnalysis(section, fileName)
		date := fas.extractDateFromAnalysis(section)
		
		findings, conclusion := fas.extractFindingsAndConclusion(section)
		
		var formattedStudy strings.Builder
		
		if findings != "" || conclusion != "" {
			formattedStudy.WriteString(docType)
			if date != "" {
				formattedStudy.WriteString(" (")
				formattedStudy.WriteString(date)
				formattedStudy.WriteString(")")
			}
			formattedStudy.WriteString("\n\n")
			formattedStudy.WriteString("Ключевые находки: ")
			if findings != "" {
				formattedStudy.WriteString(findings)
			} else {
				formattedStudy.WriteString("не выявлено")
			}
			formattedStudy.WriteString("\n\n")
			formattedStudy.WriteString("Заключение: ")
			if conclusion != "" {
				formattedStudy.WriteString(conclusion)
			} else {
				formattedStudy.WriteString("требуется дополнительное обследование")
			}
		} else {
			if docType != "" {
				formattedStudy.WriteString(docType)
				if date != "" {
					formattedStudy.WriteString(" (")
					formattedStudy.WriteString(date)
					formattedStudy.WriteString(")")
				}
				formattedStudy.WriteString("\n\n")
			}
			formattedStudy.WriteString(section)
		}
		
		studies = append(studies, formattedStudy.String())
	}
	
	return studies
}

// splitByDocumentStructure умное разделение анализов по структуре документа
// Анализирует длину разделов, наличие ключевых слов, структуру текста
func (fas *FileAnalysisService) splitByDocumentStructure(analysis, fileName string) []string {
	var studies []string
	
	// Разделяем по двойным переносам строк
	paragraphs := strings.Split(analysis, "\n\n")
	
	// Группируем абзацы в потенциальные анализы
	var currentStudy strings.Builder
	
	studyKeywords := []string{
		"электрокардиограмма", "экг", "ультразвуковое", "узи", "компьютерная томография", "кт",
		"магнитно-резонансная", "мрт", "анализ крови", "лабораторные исследования",
		"эхокардиография", "эхокг", "рентген", "маммография", "флюорография",
		"гастроскопия", "колоноскопия", "комплексный медицинский анализ",
	}
	
	for _, paragraph := range paragraphs {
		paragraph = strings.TrimSpace(paragraph)
		if paragraph == "" {
			continue
		}
		
		paragraphLower := strings.ToLower(paragraph)
		
		// Проверяем, содержит ли абзац ключевые слова типа исследования
		containsStudyType := false
		for _, keyword := range studyKeywords {
			if strings.Contains(paragraphLower, keyword) {
				containsStudyType = true
				break
			}
		}
		
		// Если абзац содержит тип исследования и текущий анализ уже достаточно длинный
		if containsStudyType && currentStudy.Len() > 500 {
			// Сохраняем текущий анализ и начинаем новый
			studyText := currentStudy.String()
			if len(studyText) > 200 {
				docType := fas.detectDocumentTypeFromAnalysis(studyText, fileName)
				date := fas.extractDateFromAnalysis(studyText)
				
				var formattedStudy strings.Builder
				if docType != "" {
					formattedStudy.WriteString(docType)
					if date != "" {
						formattedStudy.WriteString(" (")
						formattedStudy.WriteString(date)
						formattedStudy.WriteString(")")
					}
					formattedStudy.WriteString("\n\n")
				}
				formattedStudy.WriteString(studyText)
				studies = append(studies, formattedStudy.String())
			}
			
			// Начинаем новый анализ
			currentStudy.Reset()
		}
		
		// Добавляем абзац к текущему анализу
		if currentStudy.Len() > 0 {
			currentStudy.WriteString("\n\n")
		}
		currentStudy.WriteString(paragraph)
	}
	
	// Добавляем последний анализ
	if currentStudy.Len() > 200 {
		studyText := currentStudy.String()
		docType := fas.detectDocumentTypeFromAnalysis(studyText, fileName)
		date := fas.extractDateFromAnalysis(studyText)
		
		var formattedStudy strings.Builder
		if docType != "" {
			formattedStudy.WriteString(docType)
			if date != "" {
				formattedStudy.WriteString(" (")
				formattedStudy.WriteString(date)
				formattedStudy.WriteString(")")
			}
			formattedStudy.WriteString("\n\n")
		}
		formattedStudy.WriteString(studyText)
		studies = append(studies, formattedStudy.String())
	}
	
	// Если разделили на слишком много частей (больше 10) или слишком мало (1) - возвращаем пустой массив
	if len(studies) > 10 || len(studies) == 0 {
		return []string{}
	}
	
	return studies
}

// cleanAndFormatAnalysis очищает и форматирует анализ одного файла
func (fas *FileAnalysisService) cleanAndFormatAnalysis(analysis, docType, date string) string {
	findings, conclusion := fas.extractFindingsAndConclusion(analysis)

	// Форматируем результат с улучшенным оформлением
	return fas.formatAnalysisWithStyle(docType, date, findings, conclusion)
}

// formatAnalysisWithStyle форматирует анализ с профессиональным оформлением
// Формат: Название исследования, Ключевые находки (в одну строку через ;), Заключение
func (fas *FileAnalysisService) formatAnalysisWithStyle(docType, date, findings, conclusion string) string {
	var result strings.Builder

	// Название исследования (простой текст, БЕЗ markdown)
	result.WriteString(docType)
	if date != "" {
		result.WriteString(" (")
		result.WriteString(date)
		result.WriteString(")")
	}
	result.WriteString("\n\n")

	// Ключевые находки (в одну строку через точку с запятой)
	// ВСЕГДА выводим "Ключевые находки:", даже если находок нет
	result.WriteString("Ключевые находки: ")
	if findings != "" {
		// Форматируем находки в одну строку через точку с запятой
		findingsFormatted := fas.formatFindingsListProfessional(findings)
		result.WriteString(findingsFormatted)
	} else {
		// Если находок нет, пишем "не выявлено"
		result.WriteString("не выявлено")
	}
	result.WriteString("\n\n")

	// Заключение (полный текст)
	// ВСЕГДА выводим "Заключение:", даже если заключения нет
	result.WriteString("Заключение: ")
	if conclusion != "" {
		// Исправляем ошибки с полом в заключении
		conclusion = fas.fixGenderMismatches(conclusion)
		result.WriteString(conclusion)
	} else {
		// Если заключения нет, пишем "требуется дополнительное обследование"
		result.WriteString("требуется дополнительное обследование")
	}
	result.WriteString("\n\n")

	return result.String()
}

// fixGenderMismatches исправляет ошибки с полом в тексте анализа
// Заменяет "для мужчины" на "для женщины" и наоборот, если это явная ошибка
func (fas *FileAnalysisService) fixGenderMismatches(text string) string {
	// Исправляем явные ошибки типа "для мужчины" когда должно быть "для женщины"
	// Это базовая проверка - в будущем можно добавить передачу пола пациента
	text = regexp.MustCompile(`(?i)для\s+мужчины`).ReplaceAllStringFunc(text, func(match string) string {
		// Если в тексте есть упоминания женских органов или женских терминов - заменяем
		if strings.Contains(strings.ToLower(text), "женщин") || 
		   strings.Contains(strings.ToLower(text), "женский") ||
		   strings.Contains(strings.ToLower(text), "пациентка") {
			return "для женщины"
		}
		return match
	})
	
	// Исправляем "для женщины" когда речь идет о мужских исследованиях
	text = regexp.MustCompile(`(?i)для\s+женщины`).ReplaceAllStringFunc(text, func(match string) string {
		// Если в тексте есть упоминания предстательной железы - это ошибка
		if strings.Contains(strings.ToLower(text), "предстательной") || 
		   strings.Contains(strings.ToLower(text), "простат") {
			return "для мужчины"
		}
		return match
	})
	
	return text
}

// getDocumentIcon возвращает иконку для типа документа
func (fas *FileAnalysisService) getDocumentIcon(docType string) string {
	docTypeLower := strings.ToLower(docType)

	switch {
	case strings.Contains(docTypeLower, "экг") || strings.Contains(docTypeLower, "электрокардиограмма"):
		return "📊"
	case strings.Contains(docTypeLower, "анализ состава тела") || strings.Contains(docTypeLower, "inbody"):
		return "⚖️"
	case strings.Contains(docTypeLower, "анализ крови") || strings.Contains(docTypeLower, "биохимия"):
		return "🧪"
	case strings.Contains(docTypeLower, "рентген") || strings.Contains(docTypeLower, "x-ray"):
		return "📷"
	case strings.Contains(docTypeLower, "узи") || strings.Contains(docTypeLower, "ультразвук"):
		return "🔬"
	case strings.Contains(docTypeLower, "кт") || strings.Contains(docTypeLower, "компьютерная томография"):
		return "💻"
	case strings.Contains(docTypeLower, "мрт") || strings.Contains(docTypeLower, "магнитно-резонансная"):
		return "🔍"
	case strings.Contains(docTypeLower, "анализ") || strings.Contains(docTypeLower, "исследование"):
		return "📄"
	default:
		return "📋"
	}
}

// formatFindingsListProfessional форматирует список находок в профессиональном стиле (в одну строку через точку с запятой)
func (fas *FileAnalysisService) formatFindingsListProfessional(findings string) string {
	// Убираем лишние пробелы
	findings = regexp.MustCompile(`\s+`).ReplaceAllString(findings, " ")
	findings = strings.TrimSpace(findings)

	// Если находки уже в формате через точку с запятой - нормализуем и возвращаем
	if strings.Contains(findings, ";") {
		// Разбиваем по точке с запятой
		items := strings.Split(findings, ";")
		var cleanedItems []string
		for _, item := range items {
			item = strings.TrimSpace(item)
			if item != "" {
				cleanedItems = append(cleanedItems, item)
			}
		}
		return strings.Join(cleanedItems, "; ")
	}

	// Если находки через запятую - конвертируем в точку с запятой
	if strings.Contains(findings, ",") {
		// Разбиваем по запятой с пробелом после (не разбиваем числа с запятыми)
		items := regexp.MustCompile(`,\s+`).Split(findings, -1)

		if len(items) <= 1 {
			return findings
		}

		// Форматируем в одну строку через точку с запятой
		var cleanedItems []string
		for _, item := range items {
			item = strings.TrimSpace(item)
			if item != "" {
				cleanedItems = append(cleanedItems, item)
			}
		}
		return strings.Join(cleanedItems, "; ")
	}

	// Если находки уже в хорошем формате (одна строка) - возвращаем как есть
	return findings
}

// cleanInvalidUTF8 удаляет невалидные UTF-8 символы из строки
func cleanInvalidUTF8(s string) string {
	// Удаляем только невалидные UTF-8 символы (0xFFFD - replacement character, 0x00 - null)
	// Сохраняем все валидные символы, включая кириллицу и другие Unicode символы
	var result strings.Builder
	for _, r := range s {
		// Пропускаем только невалидные символы
		if r != 0xFFFD && r != 0x00 {
			result.WriteRune(r)
		}
	}
	return result.String()
}

// parseJSONResponse парсит JSON ответ от OpenAI
// Возвращает массив StudyData и ошибку (nil если успешно)
func parseJSONResponse(response string) ([]StudyData, error) {
	cleaned := strings.TrimSpace(response)
	
	markdownJsonPattern := regexp.MustCompile("(?s)```json\\s*")
	cleaned = markdownJsonPattern.ReplaceAllString(cleaned, "")
	markdownCodePattern := regexp.MustCompile("(?s)```\\s*")
	cleaned = markdownCodePattern.ReplaceAllString(cleaned, "")
	cleaned = strings.TrimSpace(cleaned)
	
	var jsonStr string
	
	if len(cleaned) > 0 && (cleaned[0] == '{' || cleaned[0] == '[') {
		jsonStr = cleaned
	} else {
		arrayStart := strings.Index(cleaned, "[")
		if arrayStart >= 0 {
			// Найден массив - ищем закрывающую скобку с учетом вложенности
			bracketCount := 0
			arrayEnd := -1
			for i := arrayStart; i < len(cleaned); i++ {
				if cleaned[i] == '[' {
					bracketCount++
				} else if cleaned[i] == ']' {
					bracketCount--
					if bracketCount == 0 {
						arrayEnd = i
						break
					}
				}
			}
			if arrayEnd > arrayStart {
				jsonStr = cleaned[arrayStart : arrayEnd+1]
			}
		}
		
		if jsonStr == "" {
			jsonStart := strings.Index(cleaned, "{")
			if jsonStart >= 0 {
				braceCount := 0
				jsonEnd := -1
				for i := jsonStart; i < len(cleaned); i++ {
					if cleaned[i] == '{' {
						braceCount++
					} else if cleaned[i] == '}' {
						braceCount--
						if braceCount == 0 {
							jsonEnd = i
							break
						}
					}
				}
				if jsonEnd > jsonStart {
					jsonStr = cleaned[jsonStart : jsonEnd+1]
				}
			}
			
			if jsonStr == "" {
				jsonStr = cleaned
			}
		}
	}
	
	if jsonStr == "" {
		return nil, fmt.Errorf("no JSON found in response")
	}
	
	var studiesArray []StudyData
	if err := json.Unmarshal([]byte(jsonStr), &studiesArray); err == nil {
		if len(studiesArray) > 0 {
			for i := range studiesArray {
				studiesArray[i].Title = cleanStudyTitle(studiesArray[i].Title)
				studiesArray[i].Findings = strings.TrimSpace(studiesArray[i].Findings)
				studiesArray[i].Conclusion = strings.TrimSpace(studiesArray[i].Conclusion)
			}
			return studiesArray, nil
		}
	}
	
	var singleStudy StudyData
	if err := json.Unmarshal([]byte(jsonStr), &singleStudy); err == nil {
		singleStudy.Title = cleanStudyTitle(singleStudy.Title)
		singleStudy.Findings = strings.TrimSpace(singleStudy.Findings)
		singleStudy.Conclusion = strings.TrimSpace(singleStudy.Conclusion)
		
		if singleStudy.Title != "" {
			return []StudyData{singleStudy}, nil
		}
	}
	
	return nil, fmt.Errorf("failed to parse JSON: invalid format")
}

// cleanStudyTitle очищает заголовок исследования от лишнего текста
func cleanStudyTitle(title string) string {
	title = strings.TrimSpace(title)
	if title == "" {
		return title
	}
	
	// Проверяем, является ли текст заголовком исследования, а не findings
	// Заголовки исследований обычно:
	// 1. Короткие (до 100 символов обычно)
	// 2. Содержат ключевые слова типа "исследования", "анализ", "томография" и т.д.
	// 3. Не содержат числовых значений с единицами измерения в начале
	// 4. Не содержат длинных описательных фраз
	
	titleLower := strings.ToLower(title)
	
	// Ключевые слова, которые обычно есть в названиях исследований
	studyKeywords := []string{
		"исследован", "анализ", "томографи", "эхокардио", "электрокардио",
		"ультразвук", "рентген", "мрт", "кт", "экг", "эхокг",
		"гематолог", "биохимическ", "иммунолог", "общеклиническ",
		"эхокардиограф", "допплерэхокардиограф", "мультиспиральн",
	}
	
	hasStudyKeywords := false
	for _, keyword := range studyKeywords {
		if strings.Contains(titleLower, keyword) {
			hasStudyKeywords = true
			break
		}
	}
	
	// Если текст содержит ключевые слова исследований и не слишком длинный - это, вероятно, заголовок
	// Не обрезаем его агрессивно
	if hasStudyKeywords && len(title) <= 150 {
		// Только убираем явно лишнее в конце (например, после точки, если там описание)
		if idx := strings.Index(title, ". "); idx > 0 && idx < len(title)-10 {
			// Проверяем, не является ли текст после точки частью названия другого исследования
			afterDot := strings.TrimSpace(title[idx+1:])
			afterDotLower := strings.ToLower(afterDot)
			
			// Если после точки идет описание (содержит паттерны findings) - обрезаем
			hasDescriptionPattern := false
			descriptionPatterns := []string{
				"повышенный", "пониженный", "уровень", "мг/л", "ммоль", "мкмоль",
				"уплотнена", "расширена", "увеличен", "16.3", "203", "17.0",
				"мочевины", "креатинин", "билирубин", "холестерин",
			}
			for _, pattern := range descriptionPatterns {
				if strings.Contains(afterDotLower, pattern) {
					hasDescriptionPattern = true
					break
				}
			}
			
			if hasDescriptionPattern {
				title = strings.TrimSpace(title[:idx])
			}
		}
		
		return strings.TrimSpace(title)
	}
	
	// Если текст не содержит ключевых слов исследований или слишком длинный - это, вероятно, findings
	// Обрезаем описательные части более агрессивно
	descriptionPatterns := []string{
		" уплотнена", " склерозирована", " расширена", " не ", " см", " увеличен", " снижен",
		" повышен", " понижен", " кальцинирован", " дилатация", " гипертрофия", " дисфункция",
		" регургитация", " стеноз", " уплотнен", " уплотнено", " уплотнены",
		" мм рт. ст.", " уд/мин", " г/м", " мл", " см/с", " мм", " см", " мкмоль",
		" ммоль", " нг/мл", " пмоль", " мкг/л", " г/л", " %", " г", " кг",
		" диастола", " систола", " передне-задний", " апикальной", " размер", " размеры",
		" диаметр", " толщина", " объем", " масса", " индекс", " скорость", " поток",
		" клапан", " створки", " предсердие", " желудочек", " перегородка", " стенка",
		" аорта", " легочная", " митральный", " трикуспидальный", " аортальный",
		"неравномерное сужение", "повышенный уровень", "пониженный уровень",
		"мочевины", "моноцитов", "эозинофилов",
	}
	
	// Если заголовок содержит описательные паттерны и НЕ содержит ключевых слов исследований - обрезаем
	// Ищем самое раннее вхождение любого описательного паттерна
	earliestIdx := -1
	for _, pattern := range descriptionPatterns {
		patternLower := strings.ToLower(pattern)
		if idx := strings.Index(titleLower, patternLower); idx > 0 && idx < len(title) {
			// Нашли описательный паттерн - запоминаем самое раннее вхождение
			if earliestIdx == -1 || idx < earliestIdx {
				earliestIdx = idx
			}
		}
	}
	
	// Если нашли описательный паттерн и текст не содержит ключевых слов исследований - обрезаем до него
	if earliestIdx > 0 && earliestIdx < len(title) && !hasStudyKeywords {
		title = strings.TrimSpace(title[:earliestIdx])
		titleLower = strings.ToLower(title)
	}
	
	// Убираем даты в скобках в конце
	title = regexp.MustCompile(`\s*\(\d{2}\.\d{2}\.\d{4}\)\s*$`).ReplaceAllString(title, "")
	title = regexp.MustCompile(`\s*\(\d{4}-\d{2}-\d{2}\)\s*$`).ReplaceAllString(title, "")
	
	// Убираем лишние пробелы
	title = regexp.MustCompile(`\s+`).ReplaceAllString(title, " ")
	title = strings.TrimSpace(title)
	
	return title
}

// formatStudiesToText конвертирует массив StudyData в текстовый формат для обратной совместимости
func formatStudiesToText(studies []StudyData) string {
	if len(studies) == 0 {
		return ""
	}
	
	var result strings.Builder
	for i, study := range studies {
		if i > 0 {
			result.WriteString("\n\n")
		}
		result.WriteString(study.Title)
		result.WriteString("\n\nКлючевые находки: ")
		if study.Findings != "" {
			result.WriteString(study.Findings)
		} else {
			result.WriteString("не выявлено")
		}
		result.WriteString("\n\nЗаключение: ")
		if study.Conclusion != "" {
			result.WriteString(study.Conclusion)
		} else {
			result.WriteString("требуется дополнительное обследование")
		}
	}
	return result.String()
}

// extractStudiesFromText извлекает структурированные данные из текстового формата (fallback)
func extractStudiesFromText(text string) []StudyData {
	// Используем существующую функцию splitMultipleStudies для извлечения
	// Но упрощенную версию - просто ищем паттерны
	studies := []StudyData{}
	
	// Ищем все вхождения "Ключевые находки:"
	findingsPattern := regexp.MustCompile(`(?i)(?:ключевые\s+находки|key\s+findings)[:\s]+`)
	findingsMatches := findingsPattern.FindAllStringIndex(text, -1)
	
	if len(findingsMatches) == 0 {
		// Нет структурированных данных
		return studies
	}
	
	for i, findingsStart := range findingsMatches {
		// Находим начало названия (от предыдущего "Ключевые находки:" или от начала)
		titleStart := 0
		if i > 0 {
			// Ищем, где заканчивается предыдущее исследование
			// Предыдущее исследование заканчивается после его "Ключевые находки:" или после "Заключение:"
			prevFindingsStart := findingsMatches[i-1][1]
			
			// Ищем "Заключение:" после предыдущих findings
			prevConclusionPattern := regexp.MustCompile(`(?i)(?:заключение|conclusion)[:\s]+`)
			searchStart := prevFindingsStart
			searchEnd := findingsStart[0]
			if searchEnd > searchStart {
				if prevConclusionIdx := prevConclusionPattern.FindStringIndex(text[searchStart:searchEnd]); prevConclusionIdx != nil {
					// Нашли заключение предыдущего исследования
					conclusionEnd := searchStart + prevConclusionIdx[1]
					// Ищем конец заключения (пустую строку или начало нового исследования)
					nextEmptyLine := strings.Index(text[conclusionEnd:searchEnd], "\n\n")
					if nextEmptyLine >= 0 {
						titleStart = conclusionEnd + nextEmptyLine + 2
					} else {
						// Если нет пустой строки, ищем хотя бы один перенос строки
						nextNewline := strings.Index(text[conclusionEnd:searchEnd], "\n")
						if nextNewline >= 0 {
							titleStart = conclusionEnd + nextNewline + 1
						} else {
							titleStart = conclusionEnd
						}
					}
				} else {
					// Если не нашли заключение, ищем пустую строку после предыдущих findings
					nextEmptyLine := strings.Index(text[prevFindingsStart:searchEnd], "\n\n")
					if nextEmptyLine >= 0 {
						titleStart = prevFindingsStart + nextEmptyLine + 2
					} else {
						titleStart = prevFindingsStart
					}
				}
			} else {
				titleStart = prevFindingsStart
			}
		}
		
		// Извлекаем название (до "Ключевые находки:")
		titleText := strings.TrimSpace(text[titleStart:findingsStart[0]])
		
		// Улучшенное извлечение названия - ищем последнюю короткую строку, которая выглядит как заголовок исследования
		// Название исследования обычно короткое (до 150 символов), начинается с заглавной буквы, не содержит описательных паттернов
		lines := strings.Split(titleText, "\n")
		var title string
		
		// Определяем паттерны для проверки (выносим наружу, чтобы использовать позже)
		descriptivePatterns := []string{
			"повышен", "понижен", "уровень", "мг/л", "ммоль", "мкмоль", "нг/мл",
			"уплотнена", "расширена", "увеличен", "уменьшен", "снижен",
			"мм", "см", "мл", "г", "кг", "уд/мин", "%",
			"мочевины", "креатинин", "билирубин", "холестерин",
		}
		
		studyKeywords := []string{
			"исследован", "анализ", "томографи", "эхокардио", "электрокардио",
			"ультразвук", "рентген", "мрт", "кт", "экг", "эхокг",
			"гематолог", "биохимическ", "иммунолог", "общеклиническ",
		}
		
		// Идем с конца, чтобы найти последнее короткое предложение, которое может быть названием
		for j := len(lines) - 1; j >= 0; j-- {
			line := strings.TrimSpace(lines[j])
			if line == "" {
				continue
			}
			
			// Проверяем, выглядит ли строка как название исследования
			lineLower := strings.ToLower(line)
			
			// Название исследования обычно:
			// 1. Короткое (до 100 символов)
			// 2. Не содержит описательных паттернов (типа "повышен", "уровень", "мг/л" и т.д.)
			// 3. Может содержать слова типа "исследования", "анализ", "томография", "эхокардиография" и т.д.
			
			// Проверяем, содержит ли строка описательные паттерны из findings
			hasDescriptivePattern := false
			for _, pattern := range descriptivePatterns {
				if strings.Contains(lineLower, pattern) {
					hasDescriptivePattern = true
					break
				}
			}
			
			// Проверяем, содержит ли строка слова, которые обычно есть в названиях исследований
			hasStudyKeywords := false
			for _, keyword := range studyKeywords {
				if strings.Contains(lineLower, keyword) {
					hasStudyKeywords = true
					break
				}
			}
			
			// Если строка короткая, не содержит описательных паттернов, но содержит ключевые слова исследований - это заголовок
			if len(line) <= 100 && !hasDescriptivePattern && hasStudyKeywords {
				title = line
				break
			}
			
			// Если строка очень короткая (до 50 символов) и не содержит описательных паттернов - возможно заголовок
			if len(line) <= 50 && !hasDescriptivePattern {
				title = line
				break
			}
		}
		
		// Если не нашли подходящую строку, берем первую непустую строку
		if title == "" {
			for _, line := range lines {
				line = strings.TrimSpace(line)
				if line != "" {
					title = line
					break
				}
			}
		}
		
		// Если все еще пусто, берем весь текст, но обрезаем описательные части
		if title == "" {
			title = titleText
		}
		
		// Убираем лишние переносы строк и пробелы
		title = regexp.MustCompile(`\s+`).ReplaceAllString(title, " ")
		title = strings.TrimSpace(title)
		
		// Обрезаем, если название слишком длинное и содержит описательные части
		if len(title) > 150 {
			// Пытаемся найти конец названия по описательным паттернам
			titleLower := strings.ToLower(title)
			for _, pattern := range descriptivePatterns {
				if idx := strings.Index(titleLower, pattern); idx > 0 && idx < 100 {
					title = strings.TrimSpace(title[:idx])
					break
				}
			}
		}
		
		// Извлекаем находки (от "Ключевые находки:" до "Заключение:" или до следующего "Ключевые находки:")
		findingsEnd := len(text)
		if i < len(findingsMatches)-1 {
			findingsEnd = findingsMatches[i+1][0]
		}
		
		conclusionPattern := regexp.MustCompile(`(?i)(?:\n\s*\n\s*|\n\s*)(?:Заключение|Conclusion)[:\s]+`)
		conclusionMatch := conclusionPattern.FindStringIndex(text[findingsStart[1]:findingsEnd])
		
		var findings, conclusion string
		if conclusionMatch != nil {
			findings = strings.TrimSpace(text[findingsStart[1] : findingsStart[1]+conclusionMatch[0]])
			conclusionStart := findingsStart[1] + conclusionMatch[1]
			if i < len(findingsMatches)-1 {
				conclusion = strings.TrimSpace(text[conclusionStart:findingsMatches[i+1][0]])
			} else {
				conclusion = strings.TrimSpace(text[conclusionStart:])
			}
		} else {
			findings = strings.TrimSpace(text[findingsStart[1]:findingsEnd])
		}
		
		// Проверяем, не содержит ли заключение название следующего исследования
		// Название следующего исследования обычно короткое, начинается с заглавной буквы, содержит ключевые слова исследований
		if conclusion != "" {
			studyKeywords := []string{
				"исследован", "анализ", "томографи", "эхокардио", "электрокардио",
				"ультразвук", "рентген", "мрт", "кт", "экг", "эхокг",
				"гематолог", "биохимическ", "иммунолог", "общеклиническ",
				"эхокардиограф", "допплерэхокардиограф", "мультиспиральн", "протокол",
			}
			descriptivePatterns := []string{
				"повышен", "понижен", "уровень", "мг/л", "ммоль", "мкмоль", "нг/мл",
				"уплотнена", "расширена", "увеличен", "уменьшен", "снижен",
				"мм", "см", "мл", "г", "кг", "уд/мин", "%",
				"мочевины", "креатинин", "билирубин", "холестерин",
			}
			
			conclusionLines := strings.Split(conclusion, "\n")
			
			// Ищем в заключении строки, которые могут быть названием следующего исследования
			for j, line := range conclusionLines {
				line = strings.TrimSpace(line)
				if line == "" {
					continue
				}
				
				// Проверяем, является ли строка названием исследования
				lineLower := strings.ToLower(line)
				hasStudyKeywords := false
				for _, keyword := range studyKeywords {
					if strings.Contains(lineLower, keyword) {
						hasStudyKeywords = true
						break
					}
				}
				
				hasDescriptivePattern := false
				for _, pattern := range descriptivePatterns {
					if strings.Contains(lineLower, pattern) {
						hasDescriptivePattern = true
						break
					}
				}
				
				// Если строка короткая, содержит ключевые слова исследований и не содержит описательных паттернов - это название следующего исследования
				if len(line) <= 150 && hasStudyKeywords && !hasDescriptivePattern {
					// Обрезаем заключение до этой строки
					conclusion = strings.TrimSpace(strings.Join(conclusionLines[:j], "\n"))
					break
				}
			}
			
			// Также проверяем, не заканчивается ли заключение названием следующего исследования (например, "...печени. Гематологические исследования")
			// Ищем паттерн: точка, пробел, затем название исследования
			studyNamePatterns := []string{
				`\.\s+(Гематологические исследования|Иммунологические исследования|Биохимические исследования|Общеклинические исследования)`,
				`\.\s+(Электрокардиограмма|ЭКГ|Эхокардиография|Трансторакальная эхокардиография)`,
				`\.\s+(Компьютерная томография|Протокол компьютерной томографии|Мультиспиральная компьютерная томография)`,
				`\.\s+(Протокол[^.]{0,100})`,
			}
			
			for _, pattern := range studyNamePatterns {
				re := regexp.MustCompile(`(?i)` + pattern)
				if match := re.FindStringIndex(conclusion); match != nil {
					// Обрезаем заключение до точки перед названием следующего исследования
					conclusion = strings.TrimSpace(conclusion[:match[0]+1])
					break
				}
			}
		}
		
		// Нормализуем пробелы
		findings = regexp.MustCompile(`\s+`).ReplaceAllString(findings, " ")
		conclusion = regexp.MustCompile(`\s+`).ReplaceAllString(conclusion, " ")
		
		if title != "" {
			studies = append(studies, StudyData{
				Title:      title,
				Findings:   findings,
				Conclusion: conclusion,
			})
		}
	}
	
	return studies
}

// isDescriptionText проверяет, содержит ли текст описательные элементы (измерения, характеристики и т.д.)
func isDescriptionText(text string) bool {
	if text == "" {
		return false
	}
	
	descriptionPatterns := []string{
		" уплотнена", " склерозирована", " расширена", " не ", " см", " увеличен", " снижен", 
		" повышен", " понижен", " кальцинирован", " дилатация", " гипертрофия", " дисфункция",
		" регургитация", " стеноз", " уплотнен", " уплотнено", " уплотнены",
		" мм рт. ст.", " уд/мин", " г/м", " мл", " см/с", " мм", " см", " мкмоль",
		" ммоль", " нг/мл", " пмоль", " мкг/л", " г/л", " %", " г", " кг",
		" диастола", " систола", " передне-задний", " апикальной", " размер", " размеры",
		" диаметр", " толщина", " объем", " масса", " индекс", " скорость", " поток",
		" клапан", " створки", " предсердие", " желудочек", " перегородка", " стенка",
		" аорта", " легочная", " митральный", " трикуспидальный", " аортальный",
	}
	
	textLower := strings.ToLower(text)
	for _, pattern := range descriptionPatterns {
		if strings.Contains(textLower, strings.ToLower(pattern)) {
			return true
		}
	}
	
	return false
}

// extractFindingsAndConclusion извлекает находки и заключение из анализа
func (fas *FileAnalysisService) extractFindingsAndConclusion(analysis string) (string, string) {
	var findings, conclusion string

	// Очищаем от невалидных UTF-8 символов
	analysis = cleanInvalidUTF8(analysis)

	// Убираем markdown заголовки и форматирование
	analysis = regexp.MustCompile(`#{1,6}\s+`).ReplaceAllString(analysis, "")         // Убираем ### заголовки
	analysis = regexp.MustCompile(`\*\*([^*]+)\*\*`).ReplaceAllString(analysis, "$1") // Убираем **жирный текст**
	analysis = regexp.MustCompile(`\*([^*]+)\*`).ReplaceAllString(analysis, "$1")     // Убираем *курсив*

	// Ищем паттерн "Ключевые находки:" или "Key findings:"
	// Ищем до "Заключение:" или до конца текста
	// Используем более точный паттерн с учетом возможных переносов строк
	// Ищем все до "Заключение:" включительно, но не включая его
	findingsStart := regexp.MustCompile(`(?i)(?:ключевые\s+находки|key\s+findings)[:\s]+`).FindStringIndex(analysis)
	if findingsStart != nil {
		// Находим начало "Заключение:"
		conclusionStart := regexp.MustCompile(`(?i)(?:\n\s*\n\s*|\n\s*)(?:Заключение|Conclusion)[:\s]+`).FindStringIndex(analysis[findingsStart[1]:])
		if conclusionStart != nil {
			// Извлекаем текст между "Ключевые находки:" и "Заключение:"
			findings = analysis[findingsStart[1] : findingsStart[1]+conclusionStart[0]]
		} else {
			// Если "Заключение:" не найдено, берем все до конца
			findings = analysis[findingsStart[1]:]
		}
		findings = strings.TrimSpace(findings)
		// Убираем переносы строк, заменяем на пробелы
		findings = regexp.MustCompile(`\s+`).ReplaceAllString(findings, " ")
		// НЕ обрезаем текст - оставляем полный текст находок
		findings = strings.TrimSpace(findings)
	}

	// Ищем паттерн "Заключение:" или "Conclusion:"
	// Ищем до конца текста или до следующего заголовка/раздела/рекомендаций
	// Более точное регулярное выражение - останавливаемся перед нумерованными списками или "Рекомендации"
	reConclusion := regexp.MustCompile(`(?i)(?:заключение|conclusion)[:\s]+(.+?)(?:\n\s*\d+\.\s+[Рр]екомендации?|\n\s*[Рр]екомендации?[:\s]|\n\s*\d+\.\s+[А-ЯЁA-Z]|\n\n[А-ЯЁA-Z][^\n]*:|\n---|$)`)
	if matches := reConclusion.FindStringSubmatch(analysis); len(matches) >= 2 {
		conclusion = strings.TrimSpace(matches[1])
		// Убираем нумерованные списки и рекомендации из заключения (если они попали)
		conclusion = regexp.MustCompile(`\s*\d+\.\s+[Рр]екомендации?[^\n]*`).ReplaceAllString(conclusion, "")
		conclusion = regexp.MustCompile(`\s*\d+\.\s+[А-ЯЁA-Z][^\n]*`).ReplaceAllString(conclusion, "")
		conclusion = regexp.MustCompile(`\s*[Рр]екомендации?[:\s][^\n]*`).ReplaceAllString(conclusion, "")
		// Нормализуем пробелы, но сохраняем структуру предложений
		conclusion = regexp.MustCompile(`\s+`).ReplaceAllString(conclusion, " ")
		conclusion = strings.TrimSpace(conclusion)
	}

	// Если находки не найдены или указаны как "не выявлено", но есть заключение - пытаемся извлечь находки из заключения
	findingsLower := strings.ToLower(strings.TrimSpace(findings))
	isNoFindings := findings == "" ||
		findingsLower == "не выявлено" ||
		findingsLower == "не выявлены" ||
		findingsLower == "отсутствуют" ||
		findingsLower == "отсутствует" ||
		findingsLower == "показатели в пределах нормы" ||
		findingsLower == "требуется дополнительное обследование" ||
		strings.Contains(findingsLower, "не обнаружено") ||
		strings.Contains(findingsLower, "не обнаружены") ||
		strings.Contains(findingsLower, "не выявлено признаков")

	if isNoFindings && conclusion != "" {
		// Ищем патологии и отклонения в заключении
		conclusionLower := strings.ToLower(conclusion)

		// Список патологий и отклонений для поиска
		pathologyKeywords := []string{
			"гепатомегалия", "холецистит", "отклонение", "патология", "нарушение",
			"повышен", "понижен", "снижен", "увеличен", "уменьшен", "деформирован",
			"изменение", "признак", "выявлен", "обнаружен", "отмечается", "определяется",
			"положительный", "отрицательный", "отсутствует", "присутствует",
			"эозинофилы", "гемоглобин", "соэ", "лейкоциты", "эритроциты",
			"взвесь", "осадок", "уплотнен", "эхогенность", "диффузные",
			"перетяжка", "хронический", "воспалительный", "застой",
			"обнаружение гемоглобина", "гемоглобин в моче", "микрогематурия",
			"снижение эозинофилов", "незначительное снижение",
			"жировой гепатоз", "застой желчи", "хронический холецистит",
			"деформация желчного пузыря", "утолщение стенки", "мелкодисперсная взвесь",
			"комплексное ультразвуковое исследование", "выявлены", "выявлено",
		}

		// Если в заключении есть упоминания патологий, извлекаем их
		hasPathology := false
		for _, keyword := range pathologyKeywords {
			if strings.Contains(conclusionLower, keyword) {
				hasPathology = true
				break
			}
		}

		if hasPathology {
			// Извлекаем ключевые фразы из заключения, содержащие патологии
			// Ищем предложения с патологиями и извлекаем конкретные патологии
			sentences := regexp.MustCompile(`[.!?]\s+`).Split(conclusion, -1)
			var pathologyPhrases []string

			// Конкретные патологии для извлечения
			specificPathologies := []string{
				"гепатомегалия", "холецистит", "эозинофилы", "гемоглобин в моче",
				"положительный гемоглобин", "снижение эозинофилов", "деформирован желчный пузырь",
				"деформация желчного пузыря", "уплотнена стенка", "утолщение стенки",
				"взвесь", "мелкодисперсная взвесь", "осадок", "перетяжка", "диффузные изменения",
				"гемоглобин в моче", "обнаружение гемоглобина", "микрогематурия",
				"снижение эозинофилов", "незначительное снижение эозинофилов",
				"жировой гепатоз", "застой желчи", "хронический холецистит",
				"не выявлено признаков воспаления", "бактериальной или грибковой инфекции",
				"комплексное ультразвуковое исследование", "выявлены", "выявлено",
				"умеренная гепатомегалия", "диффузные изменения паренхимы печени",
			}

			for _, sentence := range sentences {
				sentence = strings.TrimSpace(sentence)
				if sentence == "" {
					continue
				}
				sentenceLower := strings.ToLower(sentence)
				foundSpecific := false

				// Сначала ищем конкретные патологии
				for _, pathology := range specificPathologies {
					if strings.Contains(sentenceLower, strings.ToLower(pathology)) {
						// Извлекаем полное предложение с патологией (берем все предложение целиком)
						// Берем все предложение, а не ограниченный фрагмент
						start := 0
						end := len(sentence)
						phrase := strings.TrimSpace(sentence[start:end])
						// Очищаем от невалидных UTF-8 символов
						phrase = cleanInvalidUTF8(phrase)
						// НЕ ограничиваем длину - берем полную фразу
						if len(phrase) > 10 {
							// Убираем лишние слова в начале/конце
							phrase = regexp.MustCompile(`^(?:у\s+пациента|в\s+документе|в\s+анализе|отмечается|выявлено|обнаружено)[\s,]+`).ReplaceAllString(phrase, "")
							phrase = regexp.MustCompile(`\s+`).ReplaceAllString(phrase, " ")
							phrase = strings.TrimSpace(phrase)
							// Убираем только невалидные символы в начале/конце, но не обрезаем текст
							phrase = regexp.MustCompile(`^[^\p{L}\p{N}\s]+`).ReplaceAllString(phrase, "")
							phrase = regexp.MustCompile(`[^\p{L}\p{N}\s.,;:]+$`).ReplaceAllString(phrase, "")
							if phrase != "" && len(phrase) > 10 {
								pathologyPhrases = append(pathologyPhrases, phrase)
								foundSpecific = true
							}
						}
						break
					}
				}

				// Если не нашли конкретную патологию в этом предложении, ищем по ключевым словам
				if !foundSpecific {
					for _, keyword := range pathologyKeywords {
						if strings.Contains(sentenceLower, keyword) {
							// Извлекаем полное предложение с ключевым словом
							// Берем все предложение, а не ограниченный фрагмент
							start := 0
							end := len(sentence)
							phrase := strings.TrimSpace(sentence[start:end])
							// Очищаем от невалидных UTF-8 символов
							phrase = cleanInvalidUTF8(phrase)
							// НЕ ограничиваем длину - берем полную фразу
							if len(phrase) > 10 {
								phrase = regexp.MustCompile(`\s+`).ReplaceAllString(phrase, " ")
								phrase = strings.TrimSpace(phrase)
								// Убираем только невалидные символы в начале/конце, но не обрезаем текст
								phrase = regexp.MustCompile(`^[^\p{L}\p{N}\s]+`).ReplaceAllString(phrase, "")
								phrase = regexp.MustCompile(`[^\p{L}\p{N}\s.,;:]+$`).ReplaceAllString(phrase, "")
								if phrase != "" && len(phrase) > 10 {
									pathologyPhrases = append(pathologyPhrases, phrase)
								}
							}
							break
						}
					}
				}
			}

			// Убираем дубликаты
			uniquePhrases := make(map[string]bool)
			var finalPhrases []string
			for _, phrase := range pathologyPhrases {
				phraseLower := strings.ToLower(phrase)
				if !uniquePhrases[phraseLower] && len(phrase) > 10 {
					uniquePhrases[phraseLower] = true
					finalPhrases = append(finalPhrases, phrase)
				}
			}

			if len(finalPhrases) > 0 {
				// Объединяем находки через точку с запятой
				findings = strings.Join(finalPhrases, "; ")
				// Очищаем финальный результат от невалидных символов
				findings = cleanInvalidUTF8(findings)
				// НЕ обрезаем текст - оставляем полный текст находок
			}
		}
	}

	// Если не нашли через регулярные выражения, используем старый метод
	if findings == "" && conclusion == "" {
		lines := strings.Split(analysis, "\n")
		var currentSection string

		for _, line := range lines {
			line = strings.TrimSpace(line)
			if line == "" {
				continue
			}

			lineLower := strings.ToLower(line)

			// Определяем секцию
			if strings.Contains(lineLower, "ключевые находки") || strings.Contains(lineLower, "key findings") {
				currentSection = "findings"
				// Извлекаем текст после двоеточия
				if idx := strings.Index(line, ":"); idx >= 0 {
					findings = strings.TrimSpace(line[idx+1:])
				}
				continue
			}

			if strings.Contains(lineLower, "заключение") || strings.Contains(lineLower, "conclusion") {
				currentSection = "conclusion"
				// Извлекаем текст после двоеточия
				if idx := strings.Index(line, ":"); idx >= 0 {
					conclusion = strings.TrimSpace(line[idx+1:])
				}
				continue
			}

			// Проверяем, не начался ли новый раздел (рекомендации, нумерованный список)
			if currentSection == "conclusion" {
				// Останавливаемся, если встретили рекомендации или нумерованный список
				if matched, _ := regexp.MatchString(`^\d+\.\s+[Рр]екомендации?`, line); matched {
					break
				}
				if matched, _ := regexp.MatchString(`^[Рр]екомендации?[:\s]`, line); matched {
					break
				}
				if matched, _ := regexp.MatchString(`^\d+\.\s+[А-ЯЁA-Z]`, line); matched {
					break
				}
			}

			// Добавляем к текущей секции
			if currentSection == "findings" && findings == "" {
				findings = line
			} else if currentSection == "findings" {
				findings += "; " + line
			} else if currentSection == "conclusion" && conclusion == "" {
				conclusion = line
			} else if currentSection == "conclusion" {
				conclusion += " " + line
			}
		}
	}

	// Очищаем от многоточий, фраз про отсутствие данных и лишних символов
	findings = strings.ReplaceAll(findings, "...", "")
	findings = regexp.MustCompile(`(?i)(дата\s+не\s+указана|date\s+not\s+specified|не\s+указана|нет\s+данных|no\s+data)`).ReplaceAllString(findings, "")
	findings = strings.TrimSpace(findings)

	conclusion = strings.ReplaceAll(conclusion, "...", "")
	conclusion = regexp.MustCompile(`(?i)(дата\s+не\s+указана|date\s+not\s+specified|не\s+указана|нет\s+данных|no\s+data)`).ReplaceAllString(conclusion, "")
	// Убираем нумерованные списки и рекомендации из заключения (если они все еще есть)
	conclusion = regexp.MustCompile(`\d+\.\s+[Рр]екомендации?[^\n]*`).ReplaceAllString(conclusion, "")
	conclusion = regexp.MustCompile(`\d+\.\s+[А-ЯЁA-Z][^\n]*`).ReplaceAllString(conclusion, "")
	conclusion = regexp.MustCompile(`[Рр]екомендации?[^\n]*`).ReplaceAllString(conclusion, "")
	// Убираем множественные точки в конце
	conclusion = regexp.MustCompile(`\.{2,}`).ReplaceAllString(conclusion, ".")
	conclusion = strings.TrimSpace(conclusion)

	return findings, conclusion
}

// mergeUniqueFindings объединяет находки, убирая дубликаты
func (fas *FileAnalysisService) mergeUniqueFindings(findingsList []string) string {
	seen := make(map[string]bool)
	var unique []string

	for _, findings := range findingsList {
		// Разбиваем по запятым
		items := strings.Split(findings, ",")
		for _, item := range items {
			item = strings.TrimSpace(item)
			if item != "" && !seen[item] {
				seen[item] = true
				unique = append(unique, item)
			}
		}
	}

	return strings.Join(unique, ", ")
}

// mergeConclusions объединяет заключения
func (fas *FileAnalysisService) mergeConclusions(conclusions []string) string {
	if len(conclusions) == 0 {
		return ""
	}

	if len(conclusions) == 1 {
		return conclusions[0]
	}

	// Объединяем заключения, убирая повторения
	var merged strings.Builder
	seen := make(map[string]bool)

	for _, conclusion := range conclusions {
		// Упрощенная проверка на дубликаты (по первым словам)
		words := strings.Fields(conclusion)
		if len(words) > 0 {
			key := strings.ToLower(words[0])
			if len(words) > 1 {
				key += " " + strings.ToLower(words[1])
			}
			if !seen[key] {
				seen[key] = true
				if merged.Len() > 0 {
					merged.WriteString(" ")
				}
				merged.WriteString(conclusion)
			}
		}
	}

	result := merged.String()
	// Удаляем многоточия
	result = strings.ReplaceAll(result, "...", "")
	// НЕ ограничиваем длину - показываем весь текст полностью

	return result
}

// compactAnalysisForHealthPassport дополнительно сокращает и очищает анализ для паспорта здоровья
func (fas *FileAnalysisService) compactAnalysisForHealthPassport(analysis, fileName string) string {
	// Удаляем все упоминания названия файла и его расширения
	fileNameWithoutExt := strings.TrimSuffix(fileName, filepath.Ext(fileName))
	analysis = strings.ReplaceAll(analysis, fileName, "")
	analysis = strings.ReplaceAll(analysis, fileNameWithoutExt, "")

	// Удаляем паттерны с упоминанием файлов
	analysis = regexp.MustCompile(`(?i)\*\*?[Фф]айл[:\s]*[^\n\*]*\*\*?`).ReplaceAllString(analysis, "")
	analysis = regexp.MustCompile(`(?i)[Фф]айл[:\s]+[^\n]*`).ReplaceAllString(analysis, "")
	analysis = regexp.MustCompile(`(?i)File[:\s]+[^\n]*`).ReplaceAllString(analysis, "")

	// Удаляем технические паттерны (расширения файлов, WhatsApp и т.д.)
	analysis = regexp.MustCompile(`(?i)(\.jpeg|\.jpg|\.png|\.pdf|\.docx|\.txt)[\s:]*`).ReplaceAllString(analysis, "")
	analysis = regexp.MustCompile(`(?i)WhatsApp\s+Image[^\n]*`).ReplaceAllString(analysis, "")
	analysis = regexp.MustCompile(`(?i)Image\s+\d{4}-\d{2}-\d{2}[^\n]*`).ReplaceAllString(analysis, "")

	// Удаляем фразы про отсутствие данных
	analysis = regexp.MustCompile(`(?i)(дата\s+не\s+указана|date\s+not\s+specified|не\s+указана|нет\s+данных|no\s+data|не\s+указано|not\s+specified)[\s,\.]*`).ReplaceAllString(analysis, "")

	// Удаляем многоточия
	analysis = strings.ReplaceAll(analysis, "...", "")
	analysis = regexp.MustCompile(`\.{2,}`).ReplaceAllString(analysis, ".")

	lines := strings.Split(analysis, "\n")
	var compactLines []string
	var inTable bool
	var foundContent bool
	var skipNextEmpty bool

	for i, line := range lines {
		line = strings.TrimSpace(line)

		// Пропускаем пустые строки в начале
		if line == "" {
			if !foundContent {
				continue
			}
			// Пропускаем множественные пустые строки
			if skipNextEmpty {
				continue
			}
			skipNextEmpty = true
			// Добавляем одну пустую строку для разделения
			if len(compactLines) > 0 && i < len(lines)-1 {
				compactLines = append(compactLines, "")
			}
			continue
		}
		skipNextEmpty = false

		// Удаляем упоминания файлов из строки
		lineLower := strings.ToLower(line)
		if strings.Contains(lineLower, "файл:") ||
			strings.Contains(lineLower, "file:") ||
			strings.Contains(line, fileName) ||
			strings.Contains(line, fileNameWithoutExt) ||
			regexp.MustCompile(`(?i)(WhatsApp|Image|\.jpeg|\.jpg|\.png)`).MatchString(line) {
			continue
		}

		// Пропускаем большие таблицы
		if strings.Contains(line, "|") {
			if !inTable {
				inTable = true
				continue
			}
			continue
		}
		inTable = false

		// Удаляем технические заголовки с названиями файлов
		if (strings.HasPrefix(line, "**") || strings.HasPrefix(line, "*")) &&
			(strings.Contains(line, fileName) ||
				strings.Contains(line, fileNameWithoutExt) ||
				strings.Contains(lineLower, "файл") ||
				strings.Contains(lineLower, "file") ||
				regexp.MustCompile(`(?i)(WhatsApp|Image)`).MatchString(line)) {
			continue
		}

		// Обрабатываем заголовки разделов - убираем markdown разметку
		if strings.HasPrefix(line, "##") || strings.HasPrefix(line, "#") {
			// Убираем # и оставляем только текст
			headerText := strings.TrimSpace(strings.TrimPrefix(strings.TrimPrefix(strings.TrimPrefix(line, "#"), "#"), "#"))
			if headerText != "" && len(headerText) <= 60 {
				// Пропускаем заголовки с техническими словами
				headerLower := strings.ToLower(headerText)
				if !strings.Contains(headerLower, "файл") &&
					!strings.Contains(headerLower, "file") &&
					!regexp.MustCompile(`(?i)(WhatsApp|Image|\.jpeg|\.jpg|\.png)`).MatchString(headerText) {
					// Форматируем как обычный текст (без markdown)
					compactLines = append(compactLines, headerText)
					foundContent = true
				}
			}
			continue
		}

		// Удаляем markdown разметку из строк
		line = regexp.MustCompile(`\*\*([^\*]+)\*\*`).ReplaceAllString(line, "$1") // **текст** -> текст
		line = regexp.MustCompile(`\*([^\*]+)\*`).ReplaceAllString(line, "$1")     // *текст* -> текст
		line = strings.TrimPrefix(line, "- ")
		line = strings.TrimPrefix(line, "• ")
		line = strings.TrimPrefix(line, "* ")

		// НЕ ограничиваем длину строки - показываем весь текст

		// Пропускаем повторяющиеся разделители
		if strings.HasPrefix(line, "---") || strings.HasPrefix(line, "***") || strings.HasPrefix(line, "===") {
			continue
		}

		// НЕ ограничиваем количество строк - показываем весь текст

		if line != "" {
			compactLines = append(compactLines, line)
			foundContent = true
		}
	}

	result := strings.Join(compactLines, "\n")

	// Очищаем от лишних пробелов и переносов
	result = regexp.MustCompile(`\n{3,}`).ReplaceAllString(result, "\n\n")
	result = regexp.MustCompile(`[ \t]+`).ReplaceAllString(result, " ")
	result = strings.TrimSpace(result)

	// Финальная очистка от упоминаний файлов
	result = regexp.MustCompile(`(?i)(файл|file)[\s:]*[^\n\.]*[\.\n]?`).ReplaceAllString(result, "")

	// Удаляем все многоточия
	result = strings.ReplaceAll(result, "...", "")
	result = regexp.MustCompile(`\.{2,}`).ReplaceAllString(result, ".")

	// НЕ обрезаем результат - показываем весь текст полностью

	return result
}

// extractVitalSignsFromResponse извлекает витальные показатели из ответа OpenAI и удаляет их из текста
func extractVitalSignsFromResponse(response string) (*VitalSigns, string) {
	// Ищем JSON объект с витальными показателями в конце ответа
	// Паттерн: {"vital_signs": {...}}
	vitalSignsPattern := regexp.MustCompile(`(?s)\{[\s]*"vital_signs"[\s]*:[\s]*\{[^}]*\}\s*\}`)
	matches := vitalSignsPattern.FindString(response)
	
	if matches == "" {
		// Пробуем найти без пробелов
		vitalSignsPattern2 := regexp.MustCompile(`(?s)\{"vital_signs":\{[^}]*\}\}`)
		matches = vitalSignsPattern2.FindString(response)
	}
	
	if matches == "" {
		return nil, response
	}
	
	// Парсим JSON
	var vitalData struct {
		VitalSigns VitalSigns `json:"vital_signs"`
	}
	
	if err := json.Unmarshal([]byte(matches), &vitalData); err != nil {
		// Удаляем найденный JSON из текста, даже если не удалось распарсить
		cleaned := vitalSignsPattern.ReplaceAllString(response, "")
		return nil, strings.TrimSpace(cleaned)
	}
	
	// Проверяем, есть ли хотя бы один показатель
	hasData := vitalData.VitalSigns.Temperature != nil ||
		vitalData.VitalSigns.SystolicBP != nil ||
		vitalData.VitalSigns.DiastolicBP != nil ||
		vitalData.VitalSigns.Pulse != nil ||
		vitalData.VitalSigns.Saturation != nil
	
	if !hasData {
		// Все показатели null, удаляем JSON из текста
		cleaned := vitalSignsPattern.ReplaceAllString(response, "")
		return nil, strings.TrimSpace(cleaned)
	}
	
	// Удаляем JSON из основного текста анализа
	cleaned := vitalSignsPattern.ReplaceAllString(response, "")
	cleaned = strings.TrimSpace(cleaned)
	
	return &vitalData.VitalSigns, cleaned
}

func getFileExtension(fileName string) string {
	ext := filepath.Ext(fileName)
	if len(ext) > 0 {
		return strings.ToLower(ext[1:])
	}
	return ""
}

func getFileType(fileName string) string {
	ext := getFileExtension(fileName)
	switch ext {
	case "pdf":
		return "pdf"
	case "jpg", "jpeg", "png", "gif", "bmp", "tiff", "webp":
		return "image"
	case "txt", "doc", "docx":
		return "document"
	case "csv":
		return "spreadsheet"
	default:
		return "unknown"
	}
}

func getFileTypeWithMimeType(fileName, mimeType string) string {
	fileType := getFileType(fileName)
	if fileType != "unknown" {
		return fileType
	}

	switch {
	case mimeType == "application/pdf":
		return "pdf"
	case mimeType == "image/jpeg" || mimeType == "image/jpg":
		return "image"
	case mimeType == "image/png" || mimeType == "image/gif" || mimeType == "image/bmp" ||
		mimeType == "image/tiff" || mimeType == "image/webp":
		return "image"
	case mimeType == "text/plain":
		return "document"
	case mimeType == "application/msword" || mimeType == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
		return "document"
	case mimeType == "text/csv" || mimeType == "application/csv":
		return "spreadsheet"
	default:
		return "unknown"
	}
}

func (fas *FileAnalysisService) calculateOptimalBatchSize(files []FileReference) int {
	if len(files) == 0 {
		return 1
	}

	complexFiles := 0
	simpleFiles := 0
	totalSize := int64(0)

	for _, file := range files {
		fileType := getFileTypeWithMimeType(file.FileName, file.MimeType)
		size := file.Size

		totalSize += size

		switch fileType {
		case "pdf", "document":
			if size > 5*1024*1024 {
				complexFiles += 2
			} else {
				complexFiles++
			}
		case "image":
			if size > 2*1024*1024 {
				complexFiles++
			} else {
				simpleFiles++
			}
		default:
			simpleFiles++
		}
	}

	baseSize := fas.config.MaxConcurrent

	complexityRatio := float64(complexFiles) / float64(len(files))

	var optimalSize int
	if complexityRatio > 0.7 {
		optimalSize = max(2, baseSize/2)
	} else if complexityRatio > 0.3 {
		optimalSize = max(3, baseSize*2/3)
	} else {
		optimalSize = min(baseSize*2, 10)
	}

	avgFileSize := totalSize / int64(len(files))
	if avgFileSize > 8*1024*1024 {
		optimalSize = max(2, optimalSize/2)
	}

	return min(optimalSize, len(files))
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func getLocalizedMessage(key, language string) string {
	messages := map[string]map[string]string{
		"no_results": {
			"ru": "Нет результатов анализа",
			"en": "No analysis results",
			"kz": "Талдау нәтижелері жоқ",
		},
		"file": {
			"ru": "Файл",
			"en": "File",
			"kz": "Файл",
		},
		"error": {
			"ru": "Ошибка",
			"en": "Error",
			"kz": "Қате",
		},
		"summary": {
			"ru": "Итого",
			"en": "Summary",
			"kz": "Қорытынды",
		},
		"successful": {
			"ru": "успешно",
			"en": "successful",
			"kz": "сәтті",
		},
		"failed": {
			"ru": "ошибок",
			"en": "failed",
			"kz": "қателер",
		},
		"files_not_found": {
			"ru": "Не удалось получить список файлов назначения.",
			"en": "Failed to retrieve appointment files.",
			"kz": "Тағайындау файлдарын алу мүмкін болмады.",
		},
		"no_files": {
			"ru": "Файлы для анализа не найдены.",
			"en": "No files found for analysis.",
			"kz": "Талдауға арналған файлдар табылмады.",
		},
		"found_files": {
			"ru": "Найдено",
			"en": "Found",
			"kz": "Табылды",
		},
		"files_but_analysis_failed": {
			"ru": "файлов, но анализ не удался",
			"en": "files, but analysis failed",
			"kz": "файл, бірақ талдау сәтсіз аяқталды",
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
