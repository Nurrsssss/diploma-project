package repository

import (
	"github.com/google/uuid"
	"github.com/printprince/vitalem/identity_service/internal/models"

	"gorm.io/gorm"
)

type UserRepository struct {
	db *gorm.DB
}

func NewUserRepository(db *gorm.DB) *UserRepository {
	return &UserRepository{db: db}
}

// FindByEmail ищет пользователя по email в базе данных
func (r *UserRepository) FindByEmail(email string) (*models.Users, error) {
	var user models.Users
	result := r.db.Where("email = ?", email).First(&user)
	if result.Error != nil {
		return nil, result.Error
	}
	return &user, nil
}

// FindByPhone ищет пользователя по телефону в базе данных
func (r *UserRepository) FindByPhone(phone string) (*models.Users, error) {
	var user models.Users
	result := r.db.
		Where("phone = ? OR regexp_replace(phone, '[^0-9]', '', 'g') = ?", phone, phone).
		First(&user)
	if result.Error != nil {
		return nil, result.Error
	}
	return &user, nil
}

// ExistsByEmail проверяет существование пользователя по email
func (r *UserRepository) ExistsByEmail(email string) (bool, error) {
	var count int64
	if err := r.db.Model(&models.Users{}).Where("email = ?", email).Count(&count).Error; err != nil {
		return false, err
	}
	return count > 0, nil
}

// FindByID ищет пользователя по ID в базе данных
func (r *UserRepository) FindByID(id uuid.UUID) (*models.Users, error) {
	var user models.Users
	result := r.db.Where("id = ?", id).First(&user)
	if result.Error != nil {
		return nil, result.Error
	}
	return &user, nil
}

// Create создает нового пользователя в базе данных
func (r UserRepository) Create(user *models.Users) error {
	return r.db.Create(user).Error
}

// Update обновляет пользователя в базе данных
func (r UserRepository) Update(user *models.Users) error {
	return r.db.Save(user).Error
}
func (r UserRepository) Delete(user *models.Users) error {
	return r.db.Delete(user).Error
}
