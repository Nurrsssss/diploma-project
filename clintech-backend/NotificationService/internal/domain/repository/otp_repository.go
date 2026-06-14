package repository

import (
	"time"

	"NotificationService/internal/domain/models"

	"gorm.io/gorm"
)

// OTPRepository интерфейс для работы с OTP кодами
type OTPRepository interface {
	Create(otp *models.OTPCode) error
	GetByPhone(phone string) (*models.OTPCode, error)
	GetActiveByPhone(phone string) (*models.OTPCode, error)
	Update(otp *models.OTPCode) error
	DeleteExpired() error
	DeleteByPhone(phone string) error
	GetResendTime(phone string) (time.Time, error)
}

// GormOTPRepository реализация репозитория OTP через GORM
type GormOTPRepository struct {
	db *gorm.DB
}

// NewGormOTPRepository создает новый репозиторий OTP
func NewGormOTPRepository(db *gorm.DB) *GormOTPRepository {
	return &GormOTPRepository{db: db}
}

// Create создает новый OTP код
func (r *GormOTPRepository) Create(otp *models.OTPCode) error {
	return r.db.Create(otp).Error
}

// GetByPhone получает OTP код по номеру телефона
func (r *GormOTPRepository) GetByPhone(phone string) (*models.OTPCode, error) {
	var otp models.OTPCode
	err := r.db.Where("phone = ?", phone).Order("created_at DESC").First(&otp).Error
	if err != nil {
		return nil, err
	}
	return &otp, nil
}

// GetActiveByPhone получает активный OTP код по номеру телефона
func (r *GormOTPRepository) GetActiveByPhone(phone string) (*models.OTPCode, error) {
	var otp models.OTPCode
	err := r.db.Where("phone = ? AND expires_at > ? AND verified_at IS NULL",
		phone, time.Now()).Order("created_at DESC").First(&otp).Error
	if err != nil {
		return nil, err
	}
	return &otp, nil
}

// Update обновляет OTP код
func (r *GormOTPRepository) Update(otp *models.OTPCode) error {
	return r.db.Save(otp).Error
}

// DeleteExpired удаляет истекшие OTP коды
func (r *GormOTPRepository) DeleteExpired() error {
	return r.db.Where("expires_at < ?", time.Now()).Delete(&models.OTPCode{}).Error
}

// DeleteByPhone удаляет все OTP коды для номера телефона
func (r *GormOTPRepository) DeleteByPhone(phone string) error {
	return r.db.Where("phone = ?", phone).Delete(&models.OTPCode{}).Error
}

// GetResendTime получает время последней отправки OTP для номера
func (r *GormOTPRepository) GetResendTime(phone string) (time.Time, error) {
	var otp models.OTPCode
	err := r.db.Where("phone = ?", phone).Order("created_at DESC").First(&otp).Error
	if err != nil {
		return time.Time{}, err
	}
	return otp.CreatedAt, nil
}
