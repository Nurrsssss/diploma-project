package handlers

import (
	"crypto/rand"
	"encoding/json"
	"fmt"
	"math/big"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/beereket/vitalem-api-client/internal/client"
	"github.com/beereket/vitalem-api-client/internal/middleware"
	"github.com/beereket/vitalem-api-client/internal/models"
	"github.com/beereket/vitalem-api-client/internal/services"
	"github.com/gin-gonic/gin"
)

type HealthPassportHandler struct {
	healthPassportService *services.HealthPassportService
}

func NewHealthPassportHandler(healthPassportService *services.HealthPassportService) *HealthPassportHandler {
	return &HealthPassportHandler{
		healthPassportService: healthPassportService,
	}
}

func (h *HealthPassportHandler) GenerateHealthPassport(c *gin.Context) {
	var req models.HealthPassportRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid request body",
			"message": err.Error(),
		})
		return
	}

	token := c.GetHeader("Authorization")
	if token == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":   "Unauthorized",
			"message": "Authorization token is required",
		})
		return
	}

	healthPassport, err := h.healthPassportService.GenerateHealthPassport(c.Request.Context(), &req, token)
	if err != nil {
		
		// Определяем тип ошибки для более понятного сообщения
		errMsg := err.Error()
		errorType := "Ошибка при генерации паспорта здоровья"
		
		if strings.Contains(errMsg, "недоступен") || strings.Contains(errMsg, "таймаут") || 
		   strings.Contains(errMsg, "fetch failed") || strings.Contains(errMsg, "network error") ||
		   strings.Contains(errMsg, "connection") || strings.Contains(errMsg, "timeout") {
			errorType = "Ошибка сети при генерации паспорта здоровья"
		} else if strings.Contains(errMsg, "аутентификации") || strings.Contains(errMsg, "401") {
			errorType = "Ошибка аутентификации"
		} else if strings.Contains(errMsg, "не найден") || strings.Contains(errMsg, "404") {
			errorType = "Ресурс не найден"
		}
		
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   errorType,
			"message": errMsg,
			"details": errMsg,
		})
		return
	}

	// Правильно обрабатываем file_id (это указатель *string)
	var fileIDValue interface{}
	if healthPassport.FileID != nil && *healthPassport.FileID != "" {
		fileIDValue = *healthPassport.FileID
	} else {
		fileIDValue = nil
	}
	
	// Получаем метаданные файла для детального логирования
	responseData := gin.H{
		"id":                healthPassport.ID,
		"patient_id":        healthPassport.PatientID,
		"doctor_id":         healthPassport.DoctorID,
		"appointment_id":    healthPassport.AppointmentID,
		"analysis_id":      healthPassport.AnalysisID,
		"file_id":           fileIDValue, // Теперь это строка или nil, а не указатель
		"created_at":        healthPassport.CreatedAt,
		"updated_at":        healthPassport.UpdatedAt,
		"content":           healthPassport.Content,
		"transcription_text": healthPassport.TranscriptionText,
		"file_info":         nil,
		"generation_log":    []string{},
		"download_url":      nil, // Будет установлено ниже, если file_id есть
	}
	
	// Добавляем метаданные файла и правильный URL для скачивания, если file_id есть
	if healthPassport.FileID != nil && *healthPassport.FileID != "" {
		logs := []string{
			"✅ DOCX file generated successfully",
			fmt.Sprintf("📄 File ID: %s", *healthPassport.FileID),
		}
		
		// ВАЖНО: Добавляем правильный URL для скачивания через наш обработчик
		// Это гарантирует, что файл будет скачан с правильным Content-Type
		downloadURL := fmt.Sprintf("/health-passport/%s/download", healthPassport.ID)
		responseData["download_url"] = downloadURL
		logs = append(logs, 
			fmt.Sprintf("🔗 Download URL: %s (use this URL instead of direct file server URL)", downloadURL),
			"💡 IMPORTANT: Use /health-passport/:id/download to ensure correct Content-Type",
		)
		
		if metadata, err := h.healthPassportService.GetFileMetadata(c.Request.Context(), *healthPassport.FileID, token); err == nil {
			logs = append(logs, 
				fmt.Sprintf("📋 File name: %s", metadata.OriginalName),
				fmt.Sprintf("📦 File size: %d bytes", metadata.Size),
				fmt.Sprintf("🔖 MIME type: %s", metadata.MimeType),
			)
			
			// Проверяем формат файла
			isDocx := strings.HasSuffix(strings.ToLower(metadata.OriginalName), ".docx") ||
			         strings.Contains(strings.ToLower(metadata.MimeType), "word") ||
			         strings.Contains(strings.ToLower(metadata.MimeType), "docx") ||
			         strings.Contains(strings.ToLower(metadata.MimeType), "officedocument")
			
			isPdf := strings.HasSuffix(strings.ToLower(metadata.OriginalName), ".pdf") ||
			         strings.Contains(strings.ToLower(metadata.MimeType), "pdf")
			
			if isPdf {
				logs = append(logs, 
					"🚨 CRITICAL ERROR: File server returned PDF instead of DOCX!",
					"💡 This means the file server may have cached an old PDF file or determined the wrong MIME type",
					"💡 Solution: Try regenerating the health passport or check file server configuration",
				)
			} else if isDocx {
				logs = append(logs, "✅ File format: DOCX (correct)")
			} else {
				logs = append(logs, 
					fmt.Sprintf("⚠️  WARNING: File format may be incorrect! Expected DOCX, got: %s (MIME: %s)", 
						metadata.OriginalName, metadata.MimeType),
				)
			}
			
			responseData["file_info"] = gin.H{
				"id":            metadata.ID,
				"name":           metadata.Name,
				"original_name":  metadata.OriginalName,
				"mime_type":      metadata.MimeType,
				"size":           metadata.Size,
				"is_docx":        isDocx,
				"is_pdf":         isPdf,
				"format_correct": isDocx && !isPdf,
			}
		} else {
			logs = append(logs, fmt.Sprintf("⚠️  Could not get file metadata: %v", err))
		}
		
		responseData["generation_log"] = logs
	} else {
		responseData["generation_log"] = []string{"⚠️  File ID is missing - file may not have been generated"}
	}
	
	// Детальное логирование ответа перед отправкой
	if fileInfo, ok := responseData["file_info"].(gin.H); ok && fileInfo != nil {
	}
	
	c.JSON(http.StatusOK, responseData)
}

func (h *HealthPassportHandler) GetHealthPassport(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid ID",
			"message": "Health passport ID is required",
		})
		return
	}

	healthPassport, err := h.healthPassportService.GetHealthPassport(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error":   "Health passport not found",
			"message": err.Error(),
		})
		return
	}

	// Добавляем download_url в ответ, если file_id есть
	if healthPassport.FileID != nil && *healthPassport.FileID != "" {
		// Преобразуем в map для добавления поля
		responseMap := make(map[string]interface{})
		// Используем JSON marshal/unmarshal для преобразования структуры в map
		jsonData, _ := json.Marshal(healthPassport)
		json.Unmarshal(jsonData, &responseMap)
		responseMap["download_url"] = fmt.Sprintf("/health-passport/%s/download", id)
		c.JSON(http.StatusOK, responseMap)
	} else {
		c.JSON(http.StatusOK, healthPassport)
	}
}

func (h *HealthPassportHandler) GetHealthPassportsByPatient(c *gin.Context) {
	patientID := c.Param("patient_id")
	if patientID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid patient ID",
			"message": "Patient ID is required",
		})
		return
	}

	healthPassports, err := h.healthPassportService.GetHealthPassportsByPatient(c.Request.Context(), patientID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to get health passports",
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, healthPassports)
}

func (h *HealthPassportHandler) DeleteHealthPassport(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid ID",
			"message": "Health passport ID is required",
		})
		return
	}

	doctorID := c.Query("doctor_id")
	if doctorID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid doctor ID",
			"message": "Doctor ID is required",
		})
		return
	}

	err := h.healthPassportService.DeleteHealthPassport(c.Request.Context(), id, doctorID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to delete health passport",
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Health passport deleted successfully",
	})
}

func (h *HealthPassportHandler) GetHealthPassportsByDoctor(c *gin.Context) {
	doctorID := c.Param("doctor_id")
	if doctorID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid doctor ID",
			"message": "Doctor ID is required",
		})
		return
	}

	pageStr := c.DefaultQuery("page", "1")
	limitStr := c.DefaultQuery("limit", "10")

	page, err := strconv.Atoi(pageStr)
	if err != nil || page < 1 {
		page = 1
	}

	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit < 1 || limit > 100 {
		limit = 10
	}

	healthPassports, err := h.healthPassportService.GetHealthPassportsByPatient(c.Request.Context(), doctorID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to get health passports",
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, healthPassports)
}

func (h *HealthPassportHandler) GetHealthPassportContent(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid request",
			"message": "Health passport ID is required",
		})
		return
	}

	token := c.GetHeader("Authorization")

	content, err := h.healthPassportService.GetHealthPassportContent(c.Request.Context(), id, token)
	if err != nil {
		if err.Error() == "health passport not found" {
			c.JSON(http.StatusNotFound, gin.H{
				"error":   "Not found",
				"message": "Health passport not found",
			})
			return
		}
		if err.Error() == "access denied" {
			c.JSON(http.StatusForbidden, gin.H{
				"error":   "Access denied",
				"message": "You can only access health passports you created",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Internal server error",
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, content)
}

func (h *HealthPassportHandler) GetMyHealthPassports(c *gin.Context) {

	userInfo, exists := c.Request.Context().Value(middleware.UserContextKey).(*client.UserInfo)
	if !exists || userInfo == nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":   "Unauthorized",
			"message": "User not authenticated",
		})
		return
	}

	if userInfo.Role != "patient" {
		c.JSON(http.StatusForbidden, gin.H{
			"error":   "Access denied",
			"message": "Only patients can access their own health passports",
		})
		return
	}

	healthPassports, err := h.healthPassportService.GetHealthPassportsByPatient(c.Request.Context(), userInfo.UserID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to get health passports",
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, healthPassports)
}

func (h *HealthPassportHandler) UpdateHealthPassportContent(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid request",
			"message": "Health passport ID is required",
		})
		return
	}

	var req models.HealthPassportContentUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid request body",
			"message": err.Error(),
		})
		return
	}

	token := c.GetHeader("Authorization")

	updatedPassport, err := h.healthPassportService.UpdateHealthPassportContentAndRegenerateDOCX(c.Request.Context(), id, &req, token)
	if err != nil {
		if err.Error() == "health passport not found" {
			c.JSON(http.StatusNotFound, gin.H{
				"error":   "Not found",
				"message": "Health passport not found",
			})
			return
		}
		if err.Error() == "access denied" {
			c.JSON(http.StatusForbidden, gin.H{
				"error":   "Access denied",
				"message": "You can only edit health passports you created",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Internal server error",
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, updatedPassport)
}

func (h *HealthPassportHandler) UpdateHealthPassportContentOnly(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid request",
			"message": "Health passport ID is required",
		})
		return
	}

	var req models.HealthPassportContentUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid request body",
			"message": err.Error(),
		})
		return
	}

	token := c.GetHeader("Authorization")

	updatedContent, err := h.healthPassportService.UpdateHealthPassportContent(c.Request.Context(), id, &req, token)
	if err != nil {
		if err.Error() == "health passport not found" {
			c.JSON(http.StatusNotFound, gin.H{
				"error":   "Not found",
				"message": "Health passport not found",
			})
			return
		}
		if err.Error() == "access denied" {
			c.JSON(http.StatusForbidden, gin.H{
				"error":   "Access denied",
				"message": "You can only edit health passports you created",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Internal server error",
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, updatedContent)
}

func (h *HealthPassportHandler) RegenerateHealthPassportDOCX(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid request",
			"message": "Health passport ID is required",
		})
		return
	}

	var req models.HealthPassportRegenerateRequest
	if err := c.ShouldBindJSON(&req); err != nil {

		req.Lang = "ru"
	}

	if req.Lang == "" {
		req.Lang = "ru"
	}

	token := c.GetHeader("Authorization")

	updatedPassport, err := h.healthPassportService.RegenerateHealthPassportDOCX(c.Request.Context(), id, req.Lang, token)
	if err != nil {
		if err.Error() == "health passport not found" {
			c.JSON(http.StatusNotFound, gin.H{
				"error":   "Not found",
				"message": "Health passport not found",
			})
			return
		}
		if err.Error() == "access denied" {
			c.JSON(http.StatusForbidden, gin.H{
				"error":   "Access denied",
				"message": "You can only regenerate health passports you created",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Internal server error",
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, updatedPassport)
}

func (h *HealthPassportHandler) DownloadHealthPassportFile(c *gin.Context) {
	id := c.Param("id")
	
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid request",
			"message": "Health passport ID is required",
		})
		return
	}

	token := c.GetHeader("Authorization")
	if token == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":   "Unauthorized",
			"message": "Authorization token is required",
		})
		return
	}

	// Сначала проверяем, существует ли health passport и есть ли file_id
	passport, err := h.healthPassportService.GetHealthPassport(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error":   "Not found",
			"message": "Health passport not found",
			"details": err.Error(),
		})
		return
	}
	
	if passport.FileID == nil || *passport.FileID == "" {
		c.JSON(http.StatusNotFound, gin.H{
			"error":   "File not found",
			"message": "Health passport file has not been generated yet. Please generate the health passport first.",
			"health_passport_id": id,
			"file_id": nil,
		})
		return
	}
	
	fileData, metadata, err := h.healthPassportService.DownloadHealthPassportFile(c.Request.Context(), id, token)
	if err != nil {
		if strings.Contains(err.Error(), "not found") || strings.Contains(err.Error(), "has not been generated") {
			c.JSON(http.StatusNotFound, gin.H{
				"error":   "Not found",
				"message": err.Error(),
				"health_passport_id": id,
				"file_id": passport.FileID,
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to download file",
			"message": err.Error(),
			"health_passport_id": id,
			"file_id": passport.FileID,
		})
		return
	}
	
	// Детальное логирование в ответе
	downloadLog := []string{
		fmt.Sprintf("📥 Downloading file for health passport: %s", id),
		fmt.Sprintf("📄 File ID: %s", metadata.ID),
		fmt.Sprintf("📋 File name: %s", metadata.OriginalName),
		fmt.Sprintf("📦 File size: %d bytes", metadata.Size),
		fmt.Sprintf("🔖 MIME type: %s", metadata.MimeType),
	}

	// Проверяем формат файла
	isDocx := strings.HasSuffix(strings.ToLower(metadata.OriginalName), ".docx") ||
	         strings.Contains(strings.ToLower(metadata.MimeType), "word") ||
	         strings.Contains(strings.ToLower(metadata.MimeType), "docx") ||
	         strings.Contains(strings.ToLower(metadata.MimeType), "officedocument")
	
	isPdf := strings.HasSuffix(strings.ToLower(metadata.OriginalName), ".pdf") ||
	         strings.Contains(strings.ToLower(metadata.MimeType), "pdf")

	if isDocx {
		downloadLog = append(downloadLog, "✅ File format: DOCX (correct)")
	} else if isPdf {
		downloadLog = append(downloadLog, 
			"⚠️  WARNING: File is PDF, but expected DOCX!",
			"💡 This may be an old file. Try regenerating the health passport.",
		)
	} else {
		downloadLog = append(downloadLog, 
			fmt.Sprintf("⚠️  WARNING: Unknown file format! Name: %s, MIME: %s", 
				metadata.OriginalName, metadata.MimeType),
		)
	}

	// КРИТИЧЕСКАЯ ПРОВЕРКА: Проверяем содержимое файла
	var actualFileFormat string
	if len(fileData) >= 4 {
		header := fileData[:4]
		isPdfContent := string(header) == "%PDF"
		isDocxContent := (header[0] == 0x50 && header[1] == 0x4B && 
		                 (header[2] == 0x03 || header[2] == 0x05 || header[2] == 0x07))
		
		if isPdfContent {
			actualFileFormat = "PDF"
			downloadLog = append(downloadLog, 
				"🚨 🚨 🚨 CRITICAL: File content is PDF, but expected DOCX!",
				fmt.Sprintf("🚨 File header: %x (PDF signature)", header),
			)
		} else if isDocxContent {
			actualFileFormat = "DOCX"
			downloadLog = append(downloadLog, 
				fmt.Sprintf("✅ File content verified: DOCX (ZIP signature: %x)", header),
			)
		} else {
			actualFileFormat = "UNKNOWN"
			downloadLog = append(downloadLog, 
				fmt.Sprintf("⚠️  WARNING: Unknown file format (header: %x)", header),
			)
		}
	}

	// Определяем Content-Type и имя файла для скачивания
	// ВАЖНО: Используем реальный формат файла, а не MIME-тип от файл-сервера
	// (файл-сервер может вернуть application/octet-stream даже для DOCX)
	contentType := metadata.MimeType
	if actualFileFormat == "DOCX" || (isDocx && actualFileFormat != "PDF") {
		// Файл действительно DOCX - устанавливаем правильный Content-Type
		contentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
		downloadLog = append(downloadLog, 
			"✅ Content-Type set to: application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		)
	} else if actualFileFormat == "PDF" || isPdf {
		contentType = "application/pdf"
		downloadLog = append(downloadLog, 
			"⚠️  WARNING: File is PDF, but expected DOCX!",
		)
	} else if contentType == "" || contentType == "application/octet-stream" {
		// Если файл-сервер вернул application/octet-stream, но файл имеет расширение .docx
		if isDocx {
			contentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
			downloadLog = append(downloadLog, 
				"✅ Content-Type corrected from application/octet-stream to DOCX",
			)
		} else {
			contentType = "application/octet-stream"
		}
	}

	fileName := metadata.OriginalName
	if fileName == "" {
		// Генерируем рандомный 5-значный ID для различения версий
		randomID := generateRandomID()
		// Используем название файла с рандомным ID для различения версий
		fileName = fmt.Sprintf("Медицинский_документ_пациента_%05d_%s.docx", randomID, id)
	}

	// Правильная кодировка имени файла для Content-Disposition (RFC 5987)
	// Создаем транслитерированное fallback имя для старых браузеров
	fileNameASCII := transliterateFileName(fileName)
	fileNameASCII = strings.ReplaceAll(fileNameASCII, "\"", "_")
	
	// Проверяем наличие не-ASCII символов
	hasNonASCII := false
	for _, r := range fileName {
		if r > 127 {
			hasNonASCII = true
			break
		}
	}
	
	var contentDisposition string
	if hasNonASCII {
		// Используем RFC 5987 для UTF-8 имен файлов
		// Формат: attachment; filename="fallback"; filename*=UTF-8''encoded
		// Правильная кодировка для RFC 5987: каждый байт UTF-8 кодируется как %XX
		encodedFileName := url.PathEscape(fileName)
		// Заменяем / на %2F для правильной кодировки (PathEscape уже это делает)
		contentDisposition = fmt.Sprintf(`attachment; filename="%s"; filename*=UTF-8''%s`, 
			fileNameASCII, encodedFileName)
	} else {
		contentDisposition = fmt.Sprintf(`attachment; filename="%s"`, fileNameASCII)
	}
	

	// Отправляем файл - устанавливаем все заголовки ПЕРЕД отправкой данных
	
	// ВАЖНО: Устанавливаем заголовки ПЕРЕД вызовом c.Data()
	// Порядок установки заголовков критичен для правильной работы браузеров
	
	// Основные заголовки для скачивания файла
	c.Header("Content-Type", contentType)
	c.Header("Content-Disposition", contentDisposition)
	c.Header("Content-Length", fmt.Sprintf("%d", len(fileData)))
	
	// Дополнительные заголовки для совместимости с браузерами
	c.Header("Cache-Control", "no-cache, no-store, must-revalidate")
	c.Header("Pragma", "no-cache")
	c.Header("Expires", "0")
	c.Header("Accept-Ranges", "bytes")
	
	// Диагностические заголовки (для отладки)
	c.Header("X-File-Info", fmt.Sprintf(`{"id":"%s","name":"%s","mime_type":"%s","size":%d,"is_docx":%v}`, 
		metadata.ID, metadata.OriginalName, metadata.MimeType, metadata.Size, isDocx))
	c.Header("X-Download-Log", strings.Join(downloadLog, " | "))
	
	
	// ВАЖНО: c.Data() отправляет данные с указанным Content-Type и статусом
	// Все заголовки уже установлены выше, c.Data() только устанавливает статус и Content-Type (если не был установлен)
	c.Data(http.StatusOK, contentType, fileData)
	
}

// transliterateFileName транслитерирует кириллицу в латиницу для fallback имени файла
func transliterateFileName(fileName string) string {
	translitMap := map[rune]string{
		'А': "A", 'а': "a", 'Б': "B", 'б': "b", 'В': "V", 'в': "v",
		'Г': "G", 'г': "g", 'Д': "D", 'д': "d", 'Е': "E", 'е': "e",
		'Ё': "Yo", 'ё': "yo", 'Ж': "Zh", 'ж': "zh", 'З': "Z", 'з': "z",
		'И': "I", 'и': "i", 'Й': "Y", 'й': "y", 'К': "K", 'к': "k",
		'Л': "L", 'л': "l", 'М': "M", 'м': "m", 'Н': "N", 'н': "n",
		'О': "O", 'о': "o", 'П': "P", 'п': "p", 'Р': "R", 'р': "r",
		'С': "S", 'с': "s", 'Т': "T", 'т': "t", 'У': "U", 'у': "u",
		'Ф': "F", 'ф': "f", 'Х': "Kh", 'х': "kh", 'Ц': "Ts", 'ц': "ts",
		'Ч': "Ch", 'ч': "ch", 'Ш': "Sh", 'ш': "sh", 'Щ': "Shch", 'щ': "shch",
		'Ъ': "", 'ъ': "", 'Ы': "Y", 'ы': "y", 'Ь': "", 'ь': "",
		'Э': "E", 'э': "e", 'Ю': "Yu", 'ю': "yu", 'Я': "Ya", 'я': "ya",
	}
	
	var result strings.Builder
	for _, r := range fileName {
		if translit, ok := translitMap[r]; ok {
			result.WriteString(translit)
		} else if (r >= 'A' && r <= 'Z') || (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '_' || r == '-' || r == '.' {
			// Оставляем латиницу, цифры и допустимые символы как есть
			result.WriteRune(r)
		} else if r == ' ' {
			// Пробелы заменяем на подчеркивания
			result.WriteRune('_')
		} else {
			// Остальные символы заменяем на подчеркивания
			result.WriteRune('_')
		}
	}
	return result.String()
}

// generateRandomID генерирует случайный 5-значный ID (от 10000 до 99999)
func generateRandomID() int {
	// Генерируем случайное число от 0 до 89999, затем добавляем 10000
	n, err := rand.Int(rand.Reader, big.NewInt(90000))
	if err != nil {
		// В случае ошибки используем простое решение на основе времени
		return 10000 + (int(time.Now().UnixNano()) % 90000)
	}
	return int(n.Int64()) + 10000
}
