package handlers

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/labstack/echo/v4"
	"github.com/printprince/vitalem/appointment_service/internal/models"
	servicepkg "github.com/printprince/vitalem/appointment_service/internal/service"
)

type ServiceHandler struct {
	service *servicepkg.ServiceService
}

func NewServiceHandler(service *servicepkg.ServiceService) *ServiceHandler {
	return &ServiceHandler{service: service}
}

func (h *ServiceHandler) ListServices(c echo.Context) error {
	search := c.QueryParam("search")
	categoryID := c.QueryParam("category_id")

	items, err := h.service.ListServices(search, categoryID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"error": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, items)
}

func (h *ServiceHandler) GetCatalog(c echo.Context) error {
	data, err := h.service.GetCatalog()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"error": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, data)
}

func (h *ServiceHandler) ListCategories(c echo.Context) error {
	items, err := h.service.ListCategories()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"error": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, items)
}

func (h *ServiceHandler) CreateCategory(c echo.Context) error {
	var req models.CreateServiceCategoryRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"error": err.Error(),
		})
	}

	item, err := h.service.CreateCategory(strings.TrimSpace(req.Name))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"error": err.Error(),
		})
	}

	return c.JSON(http.StatusCreated, item)
}

func (h *ServiceHandler) CreateService(c echo.Context) error {
	var req models.CreateServiceDBRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"error": err.Error(),
		})
	}

	item, err := h.service.CreateService(req)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"error": err.Error(),
		})
	}

	return c.JSON(http.StatusCreated, item)
}

func (h *ServiceHandler) UpdateService(c echo.Context) error {
	idRaw := c.Param("id")
	id, err := strconv.ParseUint(idRaw, 10, 64)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"error": "invalid id",
		})
	}

	var req models.UpdateServiceDBRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"error": err.Error(),
		})
	}

	item, err := h.service.UpdateService(id, req)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"error": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, item)
}

func (h *ServiceHandler) DeleteService(c echo.Context) error {
	idRaw := c.Param("id")
	id, err := strconv.ParseUint(idRaw, 10, 64)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"error": "invalid id",
		})
	}

	if err := h.service.DeleteService(id); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"error": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"message": "service deleted",
	})
}
