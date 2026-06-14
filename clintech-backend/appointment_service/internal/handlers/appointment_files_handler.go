package handlers

import (
	"net/http"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"

	"github.com/printprince/vitalem/appointment_service/internal/models"
)

// UploadAppointmentFile - POST /appointments/{appointmentID}/files
func (h *AppointmentHandler) UploadAppointmentFile(c echo.Context) error {
	userID, ok := getTokenUUID(c)
	if !ok {
		return c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Error:   "Unauthorized",
		})
	}

	userRole := getRole(c)
	if userRole == "" {
		return c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Error:   "Role not found in token",
		})
	}

	appointmentIDStr := c.Param("appointmentID")
	appointmentID, err := uuid.Parse(appointmentIDStr)
	if err != nil {
		return c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Error:   "Invalid appointment ID",
		})
	}

	// multipart
	if err := c.Request().ParseMultipartForm(50 << 20); err != nil {
		return c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Error:   "Cannot parse form: " + err.Error(),
		})
	}

	file, fileHeader, err := c.Request().FormFile("file")
	if err != nil {
		return c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Error:   "File not found in request",
		})
	}
	defer file.Close()

	fileData := make([]byte, fileHeader.Size)
	_, err = file.Read(fileData)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Error:   "Cannot read file: " + err.Error(),
		})
	}

	fileType := c.FormValue("file_type")
	name := c.FormValue("name")
	if name == "" {
		name = fileHeader.Filename
	}

	resp, err := h.service.UploadAppointmentFile(
		userID,
		userRole,
		appointmentID,
		fileData,
		fileHeader.Filename,
		fileHeader.Header.Get("Content-Type"),
		fileType,
		name,
	)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Error:   err.Error(),
		})
	}

	return c.JSON(http.StatusCreated, models.APIResponse{
		Success: true,
		Data:    resp,
	})
}

// GetAppointmentFiles - GET /appointments/{appointmentID}/files
func (h *AppointmentHandler) GetAppointmentFiles(c echo.Context) error {
	userID, ok := getTokenUUID(c)
	if !ok {
		return c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Error:   "Unauthorized",
		})
	}

	userRole := getRole(c)
	if userRole == "" {
		return c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Error:   "Role not found in token",
		})
	}

	appointmentIDStr := c.Param("appointmentID")
	appointmentID, err := uuid.Parse(appointmentIDStr)
	if err != nil {
		return c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Error:   "Invalid appointment ID",
		})
	}

	files, err := h.service.GetAppointmentFiles(userID, userRole, appointmentID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Error:   err.Error(),
		})
	}

	return c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    files,
	})
}

// DeleteAppointmentFile - DELETE /appointments/{appointmentID}/files/{fileID}
func (h *AppointmentHandler) DeleteAppointmentFile(c echo.Context) error {
	userID, ok := getTokenUUID(c)
	if !ok {
		return c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Error:   "Unauthorized",
		})
	}

	userRole := getRole(c)
	if userRole == "" {
		return c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Error:   "Role not found in token",
		})
	}

	appointmentIDStr := c.Param("appointmentID")
	appointmentID, err := uuid.Parse(appointmentIDStr)
	if err != nil {
		return c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Error:   "Invalid appointment ID",
		})
	}

	fileIDStr := c.Param("fileID")
	fileID, err := uuid.Parse(fileIDStr)
	if err != nil {
		return c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Error:   "Invalid file ID",
		})
	}

	if err := h.service.DeleteAppointmentFile(userID, userRole, appointmentID, fileID); err != nil {
		return c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Error:   err.Error(),
		})
	}

	return c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    map[string]string{"message": "File deleted successfully"},
	})
}

// DownloadAppointmentFile - GET /appointments/{appointmentID}/files/{fileID}/download
func (h *AppointmentHandler) DownloadAppointmentFile(c echo.Context) error {
	userID, ok := getTokenUUID(c)
	if !ok {
		return c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Error:   "Unauthorized",
		})
	}

	userRole := getRole(c)
	if userRole == "" {
		return c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Error:   "Role not found in token",
		})
	}

	appointmentIDStr := c.Param("appointmentID")
	appointmentID, err := uuid.Parse(appointmentIDStr)
	if err != nil {
		return c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Error:   "Invalid appointment ID",
		})
	}

	fileIDStr := c.Param("fileID")
	fileID, err := uuid.Parse(fileIDStr)
	if err != nil {
		return c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Error:   "Invalid file ID",
		})
	}

	fileData, fileName, mimeType, err := h.service.DownloadAppointmentFile(userID, userRole, appointmentID, fileID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Error:   err.Error(),
		})
	}

	c.Response().Header().Set("Content-Type", mimeType)
	c.Response().Header().Set("Content-Disposition", "attachment; filename=\""+fileName+"\"")
	return c.Blob(http.StatusOK, mimeType, fileData)
}

// AddAppointmentFiles - POST /appointments/{appointmentID}/files/add
func (h *AppointmentHandler) AddAppointmentFiles(c echo.Context) error {
	userID, ok := getTokenUUID(c)
	if !ok {
		return c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Error:   "Unauthorized",
		})
	}

	userRole := getRole(c)
	if userRole == "" {
		return c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Error:   "Role not found in token",
		})
	}

	appointmentIDStr := c.Param("appointmentID")
	appointmentID, err := uuid.Parse(appointmentIDStr)
	if err != nil {
		return c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Error:   "Invalid appointment ID",
		})
	}

	var req models.AddAppointmentFilesRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Error:   "Invalid request body",
		})
	}
	if err := c.Validate(&req); err != nil {
		return c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Error:   err.Error(),
		})
	}

	resp, err := h.service.AddAppointmentFiles(userID, userRole, appointmentID, &req)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Error:   err.Error(),
		})
	}

	return c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    resp,
	})
}
