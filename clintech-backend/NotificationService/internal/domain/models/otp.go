package models

import (
	"time"

	"github.com/google/uuid"
)

// OTPCode представляет OTP код для SMS верификации
type OTPCode struct {
	ID          uuid.UUID  `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	Phone       string     `gorm:"type:varchar(20);not null;index" json:"phone"`
	Code        string     `gorm:"type:varchar(6);not null" json:"code"`
	Attempts    int        `gorm:"default:0" json:"attempts"`
	MaxAttempts int        `gorm:"default:3" json:"max_attempts"`
	ExpiresAt   time.Time  `gorm:"not null;index" json:"expires_at"`
	VerifiedAt  *time.Time `gorm:"index" json:"verified_at,omitempty"`
	BlockedAt   *time.Time `gorm:"index" json:"blocked_at,omitempty"` // Время блокировки после 3 попыток
	CreatedAt   time.Time  `gorm:"default:now()" json:"created_at"`
	UpdatedAt   time.Time  `gorm:"default:now()" json:"updated_at"`
}

// TableName возвращает имя таблицы
func (OTPCode) TableName() string {
	return "otp_codes"
}

// IsExpired проверяет, истек ли OTP код
func (o *OTPCode) IsExpired() bool {
	return time.Now().After(o.ExpiresAt)
}

// IsVerified проверяет, верифицирован ли OTP код
func (o *OTPCode) IsVerified() bool {
	return o.VerifiedAt != nil
}

// IsBlocked проверяет, заблокирован ли OTP код после неудачных попыток
func (o *OTPCode) IsBlocked() bool {
	if o.BlockedAt == nil {
		return false
	}
	// Блокировка на 5 минут после 3 попыток
	return time.Since(*o.BlockedAt) < 5*time.Minute
}

// CanAttempt проверяет, можно ли еще попытаться верифицировать код
func (o *OTPCode) CanAttempt() bool {
	return o.Attempts < o.MaxAttempts && !o.IsExpired() && !o.IsVerified() && !o.IsBlocked()
}

// IncrementAttempts увеличивает счетчик попыток
func (o *OTPCode) IncrementAttempts() {
	o.Attempts++
	o.UpdatedAt = time.Now()

	// Если достигли максимума попыток - блокируем
	if o.Attempts >= o.MaxAttempts {
		now := time.Now()
		o.BlockedAt = &now
	}
}

// MarkAsVerified отмечает код как верифицированный
func (o *OTPCode) MarkAsVerified() {
	now := time.Now()
	o.VerifiedAt = &now
	o.UpdatedAt = now
}

// GetBlockTimeRemaining возвращает оставшееся время блокировки
func (o *OTPCode) GetBlockTimeRemaining() time.Duration {
	if o.BlockedAt == nil {
		return 0
	}
	elapsed := time.Since(*o.BlockedAt)
	remaining := 5*time.Minute - elapsed
	if remaining < 0 {
		return 0
	}
	return remaining
}
