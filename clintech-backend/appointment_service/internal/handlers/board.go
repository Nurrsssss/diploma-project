package handlers

import (
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/printprince/vitalem/appointment_service/internal/models"
)

// GET /appointments/board?date=YYYY-MM-DD&from=HH:MM&to=HH:MM
func (h *AppointmentHandler) GetScheduleBoard(c echo.Context) error {
	date := c.QueryParam("date")
	from := c.QueryParam("from")
	to := c.QueryParam("to")

	if date == "" {
		return c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: "date is required"})
	}
	if from == "" {
		from = "08:00"
	}
	if to == "" {
		to = "20:00"
	}

	resp, err := h.service.GetScheduleBoard(date, from, to)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
	}

	return c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: resp})
}
