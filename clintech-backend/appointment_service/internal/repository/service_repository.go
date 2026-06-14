package repository

import (
	"strings"

	"github.com/google/uuid"
	"github.com/printprince/vitalem/appointment_service/internal/models"
	"gorm.io/gorm"
)

type ServiceRepository struct {
	db *gorm.DB
}

func NewServiceRepository(db *gorm.DB) *ServiceRepository {
	return &ServiceRepository{db: db}
}

func (r *ServiceRepository) GetOrCreateCategoryByName(name string) (*models.ServiceCategory, error) {
	name = strings.TrimSpace(name)

	var category models.ServiceCategory
	err := r.db.Where("name = ?", name).First(&category).Error
	if err == nil {
		return &category, nil
	}
	if err != nil && err != gorm.ErrRecordNotFound {
		return nil, err
	}

	category = models.ServiceCategory{Name: name}
	if err := r.db.Create(&category).Error; err != nil {
		return nil, err
	}

	return &category, nil
}

func (r *ServiceRepository) ListCategories() ([]models.ServiceCategory, error) {
	var categories []models.ServiceCategory
	err := r.db.Order("name asc").Find(&categories).Error
	return categories, err
}

func (r *ServiceRepository) CreateCategory(name string) (*models.ServiceCategory, error) {
	category := models.ServiceCategory{Name: strings.TrimSpace(name)}
	if err := r.db.Create(&category).Error; err != nil {
		return nil, err
	}
	return &category, nil
}

func (r *ServiceRepository) CreateService(service *models.Service) error {
	return r.db.Create(service).Error
}

func (r *ServiceRepository) GetServiceByID(id uint64) (*models.Service, error) {
	var service models.Service
	err := r.db.Preload("Category").First(&service, id).Error
	if err != nil {
		return nil, err
	}
	return &service, nil
}

func (r *ServiceRepository) UpdateService(service *models.Service) error {
	return r.db.Save(service).Error
}

func (r *ServiceRepository) DeleteService(id uint64) error {
	return r.db.Delete(&models.Service{}, id).Error
}

func (r *ServiceRepository) ListServices(search string, categoryID string) ([]models.Service, error) {
	var services []models.Service

	q := r.db.Preload("Category").Model(&models.Service{})

	if strings.TrimSpace(search) != "" {
		like := "%" + strings.TrimSpace(search) + "%"
		q = q.Where(`
			name ILIKE ?
			OR service_name ILIKE ?
			OR external_code ILIKE ?
		`, like, like, like)
	}

	if strings.TrimSpace(categoryID) != "" {
		if parsed, err := uuid.Parse(categoryID); err == nil {
			q = q.Where("category_id = ?", parsed)
		}
	}

	q = q.Order("created_at desc")

	err := q.Find(&services).Error
	return services, err
}

func (r *ServiceRepository) ListActiveServices() ([]models.Service, error) {
	var services []models.Service
	err := r.db.Preload("Category").
		Where("is_active = ?", true).
		Order("name asc").
		Find(&services).Error
	return services, err
}
