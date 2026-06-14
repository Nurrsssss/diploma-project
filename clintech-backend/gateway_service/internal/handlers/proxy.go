package handlers

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
	"github.com/printprince/vitalem/gateway_service/internal/config"
)

// ProxyHandler структура для проксирования запросов
type ProxyHandler struct {
	config     *config.Config
	httpClient *http.Client
}

// NewProxyHandler создает новый proxy handler
func NewProxyHandler(cfg *config.Config) *ProxyHandler {
	return &ProxyHandler{
		config: cfg,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// ProxyToIdentity проксирует запросы к Identity Service
func (p *ProxyHandler) ProxyToIdentity(c echo.Context) error { return p.proxyRequest(c, "identity") }

// ProxyToPatient проксирует запросы к Patient Service
func (p *ProxyHandler) ProxyToPatient(c echo.Context) error { return p.proxyRequest(c, "patient") }

// ProxyToSpecialist проксирует запросы к Specialist Service
func (p *ProxyHandler) ProxyToSpecialist(c echo.Context) error {
	return p.proxyRequest(c, "specialist")
}

// ProxyToAppointment проксирует запросы к Appointment Service
func (p *ProxyHandler) ProxyToAppointment(c echo.Context) error {
	return p.proxyRequest(c, "appointment")
}

// ProxyToNotification проксирует запросы к Notification Service
func (p *ProxyHandler) ProxyToNotification(c echo.Context) error {
	return p.proxyRequest(c, "notification")
}

// ProxyToFileServer проксирует запросы к FileServer Service
func (p *ProxyHandler) ProxyToFileServer(c echo.Context) error {
	return p.proxyRequest(c, "fileserver")
}

// ProxyToLogger проксирует запросы к Logger Service
func (p *ProxyHandler) ProxyToLogger(c echo.Context) error { return p.proxyRequest(c, "logger") }

// proxyRequest основная логика проксирования (без бизнес-логики!)
func (p *ProxyHandler) proxyRequest(c echo.Context, serviceName string) error {
	serviceURL := strings.TrimRight(p.config.GetServiceURL(serviceName), "/")
	if serviceURL == "" {
		return echo.NewHTTPError(http.StatusServiceUnavailable,
			fmt.Sprintf("Service %s not configured", serviceName))
	}

	requestURI := c.Request().RequestURI

	// specialist_service ожидает protected routes под /api
	if serviceName == "specialist" && strings.HasPrefix(requestURI, "/doctors") {
		requestURI = "/api" + requestURI
	}

	targetURL := serviceURL + requestURI

	req, err := http.NewRequestWithContext(
		c.Request().Context(),
		c.Request().Method,
		targetURL,
		c.Request().Body,
	)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, fmt.Sprintf("Failed to create request: %v", err))
	}

	p.copyHeaders(c.Request().Header, req.Header)
	p.applyForwardHeaders(c, req)
	req.Host = stripSchemeHost(serviceURL)

	resp, err := p.httpClient.Do(req)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadGateway, fmt.Sprintf("Failed to proxy request: %v", err))
	}
	defer resp.Body.Close()

	p.copyHeaders(resp.Header, c.Response().Header())
	c.Response().WriteHeader(resp.StatusCode)
	_, copyErr := io.Copy(c.Response().Writer, resp.Body)
	return copyErr
}
func (p *ProxyHandler) applyForwardHeaders(c echo.Context, req *http.Request) {
	// X-Forwarded-For
	ip := c.RealIP()
	if ip != "" {
		xff := req.Header.Get("X-Forwarded-For")
		if xff == "" {
			req.Header.Set("X-Forwarded-For", ip)
		} else {
			req.Header.Set("X-Forwarded-For", xff+", "+ip)
		}
	}

	// X-Forwarded-Proto
	if c.Scheme() != "" {
		req.Header.Set("X-Forwarded-Proto", c.Scheme())
	}

	// X-Forwarded-Host
	host := c.Request().Host
	if host != "" {
		req.Header.Set("X-Forwarded-Host", host)
	}
}

// copyHeaders копирует HTTP заголовки
func (p *ProxyHandler) copyHeaders(src, dst http.Header) {
	for key, values := range src {
		if p.shouldSkipHeader(key) {
			continue
		}
		// Сначала удалим, потом добавим — чтобы не задваивать
		dst.Del(key)
		for _, value := range values {
			dst.Add(key, value)
		}
	}
}

// shouldSkipHeader проверяет нужно ли пропустить заголовок
func (p *ProxyHandler) shouldSkipHeader(header string) bool {
	skipHeaders := []string{
		"Content-Length",
		"Transfer-Encoding",
		"Connection",
		"Upgrade",
		"Proxy-Authenticate",
		"Proxy-Authorization",
	}

	h := strings.ToLower(header)
	for _, s := range skipHeaders {
		if h == strings.ToLower(s) {
			return true
		}
	}
	return false
}

func stripSchemeHost(serviceURL string) string {
	// serviceURL вида http://service:port
	u := serviceURL
	u = strings.TrimPrefix(u, "http://")
	u = strings.TrimPrefix(u, "https://")
	u = strings.TrimRight(u, "/")
	host, _, err := net.SplitHostPort(u)
	if err == nil && host != "" {
		// Вернем с портом (SplitHostPort отрезал порт)
		return u
	}
	return u
}

// ========== МЕТОДЫ ДЛЯ РАБОТЫ С АВАТАРКАМИ ==========

// UploadAvatar загружает аватарку пользователя
func (p *ProxyHandler) UploadAvatar(c echo.Context) error {
	userID, ok := c.Get("user_id").(uuid.UUID)
	if !ok {
		return echo.NewHTTPError(http.StatusUnauthorized, "User ID not found")
	}

	role, ok := c.Get("role").(string)
	if !ok {
		return echo.NewHTTPError(http.StatusUnauthorized, "Role not found")
	}

	// Разрешаем patient/doctor (как у тебя было)
	if role != "patient" && role != "doctor" {
		return echo.NewHTTPError(http.StatusForbidden, "Invalid role")
	}

	authHeader := c.Request().Header.Get("Authorization")
	if authHeader == "" {
		return echo.NewHTTPError(http.StatusUnauthorized, "Authorization header required")
	}

	file, err := c.FormFile("avatar")
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Avatar file required")
	}

	if err := p.validateAvatarFile(file); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	fileURL, err := p.uploadFileToFileServer(c, file, userID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, fmt.Sprintf("Failed to upload file: %v", err))
	}

	if err := p.updateUserAvatar(userID, role, fileURL, authHeader); err != nil {
		p.deleteFileFromFileServer(fileURL)
		return echo.NewHTTPError(http.StatusInternalServerError, fmt.Sprintf("Failed to update profile: %v", err))
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"avatar_url": fileURL,
		"message":    "Avatar uploaded successfully",
	})
}

// DeleteAvatar удаляет аватарку пользователя
func (p *ProxyHandler) DeleteAvatar(c echo.Context) error {
	userID, ok := c.Get("user_id").(uuid.UUID)
	if !ok {
		return echo.NewHTTPError(http.StatusUnauthorized, "User ID not found")
	}

	role, ok := c.Get("role").(string)
	if !ok {
		return echo.NewHTTPError(http.StatusUnauthorized, "Role not found")
	}

	if role != "patient" && role != "doctor" {
		return echo.NewHTTPError(http.StatusForbidden, "Invalid role")
	}

	authHeader := c.Request().Header.Get("Authorization")
	if authHeader == "" {
		return echo.NewHTTPError(http.StatusUnauthorized, "Authorization header required")
	}

	currentAvatarURL, err := p.getUserAvatarURL(userID, role, authHeader)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, fmt.Sprintf("Failed to get current avatar: %v", err))
	}

	if currentAvatarURL == "" {
		return echo.NewHTTPError(http.StatusNotFound, "No avatar set")
	}

	if err := p.updateUserAvatar(userID, role, "", authHeader); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, fmt.Sprintf("Failed to update profile: %v", err))
	}

	go p.deleteFileFromFileServer(currentAvatarURL)

	return c.JSON(http.StatusOK, map[string]interface{}{
		"message": "Avatar deleted successfully",
	})
}

// validateAvatarFile валидирует файл аватарки
func (p *ProxyHandler) validateAvatarFile(file *multipart.FileHeader) error {
	maxSize := int64(3 * 1024 * 1024) // 3MB
	if file.Size > maxSize {
		return errors.New("file too large (max 3MB)")
	}

	contentType := file.Header.Get("Content-Type")
	if !p.isValidImageType(contentType) {
		return errors.New("invalid file type (only JPEG and PNG allowed)")
	}
	return nil
}

// isValidImageType проверяет допустимый ли тип изображения
func (p *ProxyHandler) isValidImageType(contentType string) bool {
	validTypes := []string{"image/jpeg", "image/jpg", "image/png"}
	for _, t := range validTypes {
		if contentType == t {
			return true
		}
	}
	return false
}

// uploadFileToFileServer загружает файл в FileServer
func (p *ProxyHandler) uploadFileToFileServer(c echo.Context, file *multipart.FileHeader, userID uuid.UUID) (string, error) {
	fileExt := p.getFileExtension(file.Filename)
	fileName := fmt.Sprintf("avatar_%s%s", uuid.New().String(), fileExt)

	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)

	if err := writer.WriteField("filename", fileName); err != nil {
		return "", err
	}
	if err := writer.WriteField("category", "avatars"); err != nil {
		return "", err
	}

	fileWriter, err := writer.CreateFormFile("file", fileName)
	if err != nil {
		return "", err
	}

	src, err := file.Open()
	if err != nil {
		return "", err
	}
	defer src.Close()

	if _, err := io.Copy(fileWriter, src); err != nil {
		return "", err
	}

	_ = writer.Close()

	fileServerURL := strings.TrimRight(p.config.GetServiceURL("fileserver"), "/")
	if fileServerURL == "" {
		return "", errors.New("fileserver not configured")
	}

	req, err := http.NewRequest("POST", fileServerURL+"/files", &buf)
	if err != nil {
		return "", err
	}

	auth := c.Request().Header.Get("Authorization")
	if auth != "" {
		req.Header.Set("Authorization", auth)
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())

	resp, err := p.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("failed to upload file: status %d, body: %s", resp.StatusCode, string(body))
	}

	var files []struct {
		ID       string `json:"id"`
		Name     string `json:"name"`
		Path     string `json:"path"`
		IsPublic bool   `json:"is_public"`
	}

	if err = json.NewDecoder(resp.Body).Decode(&files); err != nil {
		return "", err
	}
	if len(files) == 0 {
		return "", errors.New("no files uploaded")
	}

	baseURL := strings.TrimRight(p.config.PublicBaseURL, "/")
	if baseURL == "" {
		baseURL = "https://clintech.nutristeppe.com"
	}

	if files[0].IsPublic {
		return fmt.Sprintf("%s/public/%s", baseURL, files[0].ID), nil
	}
	return fmt.Sprintf("%s/files/%s/download", baseURL, files[0].ID), nil
}

func (p *ProxyHandler) getFileExtension(filename string) string {
	parts := strings.Split(filename, ".")
	if len(parts) > 1 {
		return "." + parts[len(parts)-1]
	}
	return ""
}

func (p *ProxyHandler) updateUserAvatar(userID uuid.UUID, role, avatarURL, authHeader string) error {
	var serviceURL, path string

	if role == "patient" {
		serviceURL = strings.TrimRight(p.config.GetServiceURL("patient"), "/")
		path = fmt.Sprintf("/users/%s/patient", userID.String())
	} else if role == "doctor" || role == "reception" {
		serviceURL = strings.TrimRight(p.config.GetServiceURL("specialist"), "/")
		path = fmt.Sprintf("/users/%s/doctor", userID.String())
	} else {
		return errors.New("invalid role")
	}
	if serviceURL == "" {
		return fmt.Errorf("%s service not configured", role)
	}

	updateData := map[string]interface{}{"avatar_url": avatarURL}
	jsonData, err := json.Marshal(updateData)
	if err != nil {
		return err
	}

	req, err := http.NewRequest("PUT", serviceURL+path, bytes.NewBuffer(jsonData))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", authHeader)

	resp, err := p.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("failed to update profile: status %d, body: %s", resp.StatusCode, string(body))
	}
	return nil
}

func (p *ProxyHandler) getUserAvatarURL(userID uuid.UUID, role, authHeader string) (string, error) {
	var serviceURL, path string

	if role == "patient" {
		serviceURL = strings.TrimRight(p.config.GetServiceURL("patient"), "/")
		path = fmt.Sprintf("/users/%s/patient", userID.String())
	} else if role == "doctor" || role == "reception" {
		serviceURL = strings.TrimRight(p.config.GetServiceURL("specialist"), "/")
		path = fmt.Sprintf("/users/%s/doctor", userID.String())
	} else {
		return "", errors.New("invalid role")
	}
	if serviceURL == "" {
		return "", fmt.Errorf("%s service not configured", role)
	}

	req, err := http.NewRequest("GET", serviceURL+path, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", authHeader)

	resp, err := p.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("failed to get profile: status %d", resp.StatusCode)
	}

	var profile struct {
		AvatarURL string `json:"avatar_url"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&profile); err != nil {
		return "", err
	}
	return profile.AvatarURL, nil
}

func (p *ProxyHandler) deleteFileFromFileServer(fileURL string) {
	if fileURL == "" {
		return
	}
	parts := strings.Split(fileURL, "/")
	if len(parts) == 0 {
		return
	}
	fileID := parts[len(parts)-1]

	fileServerURL := strings.TrimRight(p.config.GetServiceURL("fileserver"), "/")
	if fileServerURL == "" {
		return
	}

	req, err := http.NewRequest("DELETE", fileServerURL+"/files/"+fileID, nil)
	if err != nil {
		return
	}
	resp, err := p.httpClient.Do(req)
	if err != nil {
		return
	}
	defer resp.Body.Close()
}
