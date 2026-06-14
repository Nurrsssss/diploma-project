package models

import (
	"time"

	"github.com/google/uuid"
)

// SendOTPRequest запрос на отправку OTP
type SendOTPRequest struct {
	Phone string `json:"phone" validate:"required,min=10,max=20"`
}

// VerifyOTPRequest запрос на верификацию OTP
type VerifyOTPRequest struct {
	Phone string `json:"phone" validate:"required,min=10,max=20"`
	Code  string `json:"code" validate:"required,min=4,max=6"`
}

// ResendOTPRequest запрос на повторную отправку OTP
type ResendOTPRequest struct {
	Phone string `json:"phone" validate:"required,min=10,max=20"`
}

// OTPResponse ответ с информацией об OTP
type OTPResponse struct {
	ID          uuid.UUID `json:"id"`
	Phone       string    `json:"phone"`
	ExpiresAt   time.Time `json:"expires_at"`
	Attempts    int       `json:"attempts"`
	MaxAttempts int       `json:"max_attempts"`
	IsVerified  bool      `json:"is_verified"`
	IsExpired   bool      `json:"is_expired"`
	CanAttempt  bool      `json:"can_attempt"`
	CreatedAt   time.Time `json:"created_at"`
}

// VerifyOTPResponse ответ на верификацию OTP
type VerifyOTPResponse struct {
	Success           bool      `json:"success"`
	Message           string    `json:"message"`
	VerifiedAt        time.Time `json:"verified_at,omitempty"`
	RemainingAttempts int       `json:"remaining_attempts,omitempty"`
}

// SendOTPResponse ответ на отправку OTP
type SendOTPResponse struct {
	Success     bool          `json:"success"`
	Message     string        `json:"message"`
	ExpiresAt   time.Time     `json:"expires_at"`
	ResendAfter time.Duration `json:"resend_after,omitempty"`
}
