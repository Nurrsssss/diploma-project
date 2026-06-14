package handlers

import (
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"
	"github.com/printprince/vitalem/appointment_service/internal/models"
	"github.com/printprince/vitalem/appointment_service/internal/service"
)

type ServiceCatalogHandler struct {
	service *service.ServiceCatalogService
}

func NewServiceCatalogHandler(service *service.ServiceCatalogService) *ServiceCatalogHandler {
	return &ServiceCatalogHandler{service: service}
}

func (h *ServiceCatalogHandler) GetAllServices(c echo.Context) error {
	search := c.QueryParam("search")

	var (
		result models.ServiceCatalog
		err    error
	)

	if search != "" {
		result, err = h.service.Search(search)
	} else {
		result, err = h.service.GetAll()
	}

	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"error":   err.Error(),
		})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    result,
	})
}

func (h *ServiceCatalogHandler) GetCategories(c echo.Context) error {
	categories, err := h.service.GetCategories()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"error":   err.Error(),
		})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    categories,
	})
}

func (h *ServiceCatalogHandler) CreateService(c echo.Context) error {
	var req models.CreateServiceRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"error":   "invalid request body",
		})
	}

	result, err := h.service.Create(req)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"error":   err.Error(),
		})
	}

	return c.JSON(http.StatusCreated, map[string]interface{}{
		"success": true,
		"data":    result,
	})
}

func (h *ServiceCatalogHandler) UpdateService(c echo.Context) error {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"error":   "invalid service id",
		})
	}

	var req models.UpdateServiceRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"error":   "invalid request body",
		})
	}

	result, err := h.service.Update(id, req)
	if err != nil {
		status := http.StatusBadRequest
		if err.Error() == "service not found" {
			status = http.StatusNotFound
		}

		return c.JSON(status, map[string]interface{}{
			"success": false,
			"error":   err.Error(),
		})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    result,
	})
}

func (h *ServiceCatalogHandler) DeleteService(c echo.Context) error {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"error":   "invalid service id",
		})
	}

	result, err := h.service.Delete(id)
	if err != nil {
		status := http.StatusBadRequest
		if err.Error() == "service not found" {
			status = http.StatusNotFound
		}

		return c.JSON(status, map[string]interface{}{
			"success": false,
			"error":   err.Error(),
		})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    result,
	})
}
