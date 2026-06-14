package handlers

import (
	"net/http"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"

	"github.com/printprince/vitalem/appointment_service/internal/models"
)

// GetAppointmentTranscription - GET /appointments/:id/transcription
func (h *AppointmentHandler) GetAppointmentTranscription(c echo.Context) error {
	userID, ok := getTokenUUID(c)
	if !ok {
		return c.JSON(http.StatusUnauthorized, models.APIResponse{Success: false, Error: "Unauthorized"})
	}
	userRole := getRole(c)
	if userRole == "" {
		return c.JSON(http.StatusUnauthorized, models.APIResponse{Success: false, Error: "Role not found"})
	}

	appointmentID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: "Invalid appointment ID"})
	}

	resp, err := h.service.GetAppointmentTranscription(userID, userRole, appointmentID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
	}
	return c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: resp})
}

// UpdateAppointmentTranscription - PUT/POST /appointments/:id/transcription
func (h *AppointmentHandler) UpdateAppointmentTranscription(c echo.Context) error {
	userID, ok := getTokenUUID(c)
	if !ok {
		return c.JSON(http.StatusUnauthorized, models.APIResponse{Success: false, Error: "Unauthorized"})
	}
	userRole := getRole(c)
	if userRole == "" {
		return c.JSON(http.StatusUnauthorized, models.APIResponse{Success: false, Error: "Role not found"})
	}

	appointmentID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: "Invalid appointment ID"})
	}

	var req models.AppointmentTranscriptionUpdateRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: "Invalid request body"})
	}
	if err := c.Validate(&req); err != nil {
		return c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: err.Error()})
	}

	resp, err := h.service.UpdateAppointmentTranscription(userID, userRole, appointmentID, &req)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
	}
	return c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: resp})
}

// DeleteAppointmentTranscription - DELETE /appointments/:id/transcription
func (h *AppointmentHandler) DeleteAppointmentTranscription(c echo.Context) error {
	userID, ok := getTokenUUID(c)
	if !ok {
		return c.JSON(http.StatusUnauthorized, models.APIResponse{Success: false, Error: "Unauthorized"})
	}
	userRole := getRole(c)
	if userRole == "" {
		return c.JSON(http.StatusUnauthorized, models.APIResponse{Success: false, Error: "Role not found"})
	}

	appointmentID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: "Invalid appointment ID"})
	}

	if err := h.service.DeleteAppointmentTranscription(userID, userRole, appointmentID); err != nil {
		return c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
	}
	return c.JSON(http.StatusOK, models.APIResponse{Success: true})
}
