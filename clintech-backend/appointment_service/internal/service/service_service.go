package service

import (
	"errors"
	"strings"

	"github.com/google/uuid"
	"github.com/printprince/vitalem/appointment_service/internal/models"
	"github.com/printprince/vitalem/appointment_service/internal/repository"
)

type ServiceService struct {
	repo *repository.ServiceRepository
}

func NewServiceService(repo *repository.ServiceRepository) *ServiceService {
	return &ServiceService{repo: repo}
}

func (s *ServiceService) ListCategories() ([]models.ServiceCategory, error) {
	return s.repo.ListCategories()
}

func (s *ServiceService) CreateCategory(name string) (*models.ServiceCategory, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, errors.New("category name is required")
	}
	return s.repo.CreateCategory(name)
}

func (s *ServiceService) ListServices(search, categoryID string) ([]models.ServiceListItemResponse, error) {
	services, err := s.repo.ListServices(search, categoryID)
	if err != nil {
		return nil, err
	}

	result := make([]models.ServiceListItemResponse, 0, len(services))
	for _, item := range services {
		result = append(result, models.ServiceListItemResponse{
			ID:              item.ID,
			LegacyID:        item.LegacyID,
			CategoryID:      item.CategoryID,
			CategoryName:    item.Category.Name,
			ExternalCode:    item.ExternalCode,
			Name:            item.Name,
			ServiceName:     item.ServiceName,
			Price:           item.Price,
			DurationMinutes: item.DurationMinutes,
			IsActive:        item.IsActive,
		})
	}

	return result, nil
}

func (s *ServiceService) CreateService(req models.CreateServiceDBRequest) (*models.ServiceListItemResponse, error) {
	if strings.TrimSpace(req.Name) == "" {
		return nil, errors.New("name is required")
	}
	if strings.TrimSpace(req.ServiceName) == "" {
		return nil, errors.New("service_name is required")
	}

	var categoryID uuid.UUID

	if req.CategoryID != nil {
		categoryID = *req.CategoryID
	} else if strings.TrimSpace(req.CategoryName) != "" {
		category, err := s.repo.GetOrCreateCategoryByName(req.CategoryName)
		if err != nil {
			return nil, err
		}
		categoryID = category.ID
	} else {
		return nil, errors.New("category is required")
	}

	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	service := models.Service{
		LegacyID:        req.LegacyID,
		CategoryID:      categoryID,
		ExternalCode:    req.ExternalCode,
		Name:            strings.TrimSpace(req.Name),
		ServiceName:     strings.TrimSpace(req.ServiceName),
		Price:           req.Price,
		DurationMinutes: req.DurationMinutes,
		IsActive:        isActive,
	}

	if err := s.repo.CreateService(&service); err != nil {
		return nil, err
	}

	created, err := s.repo.GetServiceByID(service.ID)
	if err != nil {
		return nil, err
	}

	return &models.ServiceListItemResponse{
		ID:              created.ID,
		LegacyID:        created.LegacyID,
		CategoryID:      created.CategoryID,
		CategoryName:    created.Category.Name,
		ExternalCode:    created.ExternalCode,
		Name:            created.Name,
		ServiceName:     created.ServiceName,
		Price:           created.Price,
		DurationMinutes: created.DurationMinutes,
		IsActive:        created.IsActive,
	}, nil
}

func (s *ServiceService) UpdateService(id uint64, req models.UpdateServiceDBRequest) (*models.ServiceListItemResponse, error) {
	serviceItem, err := s.repo.GetServiceByID(id)
	if err != nil {
		return nil, err
	}

	if req.CategoryID != nil {
		serviceItem.CategoryID = *req.CategoryID
	} else if req.CategoryName != nil && strings.TrimSpace(*req.CategoryName) != "" {
		category, err := s.repo.GetOrCreateCategoryByName(*req.CategoryName)
		if err != nil {
			return nil, err
		}
		serviceItem.CategoryID = category.ID
	}

	if req.Name != nil {
		serviceItem.Name = strings.TrimSpace(*req.Name)
	}
	if req.ServiceName != nil {
		serviceItem.ServiceName = strings.TrimSpace(*req.ServiceName)
	}
	if req.Price != nil {
		serviceItem.Price = *req.Price
	}
	if req.DurationMinutes != nil {
		serviceItem.DurationMinutes = *req.DurationMinutes
	}
	if req.IsActive != nil {
		serviceItem.IsActive = *req.IsActive
	}
	if req.LegacyID != nil {
		serviceItem.LegacyID = req.LegacyID
	}
	if req.ExternalCode != nil {
		serviceItem.ExternalCode = req.ExternalCode
	}

	if err := s.repo.UpdateService(serviceItem); err != nil {
		return nil, err
	}

	updated, err := s.repo.GetServiceByID(serviceItem.ID)
	if err != nil {
		return nil, err
	}

	return &models.ServiceListItemResponse{
		ID:              updated.ID,
		LegacyID:        updated.LegacyID,
		CategoryID:      updated.CategoryID,
		CategoryName:    updated.Category.Name,
		ExternalCode:    updated.ExternalCode,
		Name:            updated.Name,
		ServiceName:     updated.ServiceName,
		Price:           updated.Price,
		DurationMinutes: updated.DurationMinutes,
		IsActive:        updated.IsActive,
	}, nil
}

func (s *ServiceService) DeleteService(id uint64) error {
	return s.repo.DeleteService(id)
}

func (s *ServiceService) GetCatalog() (*models.ServiceCatalogResponse, error) {
	services, err := s.repo.ListActiveServices()
	if err != nil {
		return nil, err
	}

	result := &models.ServiceCatalogResponse{
		Output: map[string][]models.ServiceCatalogItem{},
	}

	for _, item := range services {
		categoryName := item.Category.Name
		result.Output[categoryName] = append(result.Output[categoryName], models.ServiceCatalogItem{
			ID:   item.ID,
			Name: item.Name,
			Options: models.ServiceCatalogOption{
				DataPrice:       item.Price,
				DataDuration:    item.DurationMinutes,
				DataServiceName: item.ServiceName,
			},
		})
	}

	return result, nil
}
