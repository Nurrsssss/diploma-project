package handlers

import (
	"fmt"
	"net/http"
	"net/url"
	"strings"

	"github.com/beereket/vitalem-api-client/internal/models"
	"github.com/beereket/vitalem-api-client/internal/services"
	"github.com/gin-gonic/gin"
)

type PatientRecommendationsHandler struct {
	service *services.PatientRecommendationsService
}

func NewPatientRecommendationsHandler(service *services.PatientRecommendationsService) *PatientRecommendationsHandler {
	return &PatientRecommendationsHandler{service: service}
}

// GenerateRecommendations генерирует DOCX с рекомендациями для пациента по итогам приёма.
func (h *PatientRecommendationsHandler) GenerateRecommendations(c *gin.Context) {
	var req models.PatientRecommendationsRequest
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

	result, err := h.service.Generate(c.Request.Context(), &req, token)
	if err != nil {
		errMsg := err.Error()
		errorType := "Ошибка при генерации рекомендаций для пациента"

		if strings.Contains(errMsg, "недоступен") || strings.Contains(errMsg, "таймаут") ||
			strings.Contains(errMsg, "fetch failed") || strings.Contains(errMsg, "network error") ||
			strings.Contains(errMsg, "connection") || strings.Contains(errMsg, "timeout") {
			errorType = "Ошибка сети при генерации рекомендаций"
		} else if strings.Contains(errMsg, "validation failed") {
			errorType = "Приём не найден или не принадлежит этому врачу"
		}

		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   errorType,
			"message": errMsg,
		})
		return
	}

	c.JSON(http.StatusOK, result)
}

// DownloadRecommendationsFile отдаёт сгенерированный DOCX с рекомендациями для пациента.
func (h *PatientRecommendationsHandler) DownloadRecommendationsFile(c *gin.Context) {
	fileID := c.Param("fileId")
	if fileID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid request",
			"message": "File ID is required",
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

	fileData, metadata, err := h.service.DownloadFile(c.Request.Context(), fileID, token)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to download file",
			"message": err.Error(),
		})
		return
	}

	contentType := "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

	fileName := metadata.OriginalName
	if fileName == "" {
		fileName = fmt.Sprintf("Рекомендации_пациенту_%05d.docx", generateRandomID())
	}

	fileNameASCII := strings.ReplaceAll(transliterateFileName(fileName), "\"", "_")

	hasNonASCII := false
	for _, r := range fileName {
		if r > 127 {
			hasNonASCII = true
			break
		}
	}

	var contentDisposition string
	if hasNonASCII {
		contentDisposition = fmt.Sprintf(`attachment; filename="%s"; filename*=UTF-8''%s`, fileNameASCII, url.PathEscape(fileName))
	} else {
		contentDisposition = fmt.Sprintf(`attachment; filename="%s"`, fileNameASCII)
	}

	c.Header("Content-Type", contentType)
	c.Header("Content-Disposition", contentDisposition)
	c.Header("Content-Length", fmt.Sprintf("%d", len(fileData)))
	c.Header("Cache-Control", "no-cache, no-store, must-revalidate")

	c.Data(http.StatusOK, contentType, fileData)
}
