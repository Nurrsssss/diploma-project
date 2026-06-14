package service

import (
	"fmt"
	"math/rand"
	"time"

	"NotificationService/internal/domain/models"
	"NotificationService/internal/domain/repository"
	"NotificationService/internal/infrastructure/sms"
)

// OTPService интерфейс для работы с OTP
type OTPService interface {
	SendOTP(phone string) (*models.SendOTPResponse, error)
	VerifyOTP(phone, code string) (*models.VerifyOTPResponse, error)
	ResendOTP(phone string) (*models.SendOTPResponse, error)
	CleanupExpired() error
}

// otpService реализация сервиса OTP
type otpService struct {
	otpRepo   repository.OTPRepository
	smsSender sms.Sender
	logger    LoggerInterface
}

// NewOTPService создает новый сервис OTP
func NewOTPService(otpRepo repository.OTPRepository, smsSender sms.Sender, logger LoggerInterface) OTPService {
	return &otpService{
		otpRepo:   otpRepo,
		smsSender: smsSender,
		logger:    logger,
	}
}

// SendOTP отправляет OTP код на телефон
func (s *otpService) SendOTP(phone string) (*models.SendOTPResponse, error) {
	// Проверяем, не слишком ли рано для повторной отправки
	if lastSent, err := s.otpRepo.GetResendTime(phone); err == nil {
		timeSinceLast := time.Since(lastSent)
		if timeSinceLast < 2*time.Minute {
			remaining := 2*time.Minute - timeSinceLast
			return &models.SendOTPResponse{
				Success:     false,
				Message:     "Подождите перед повторной отправкой",
				ResendAfter: remaining,
			}, nil
		}
	}

	// Проверяем, есть ли заблокированный код
	if otp, err := s.otpRepo.GetByPhone(phone); err == nil && otp.IsBlocked() {
		remaining := otp.GetBlockTimeRemaining()
		return &models.SendOTPResponse{
			Success:     false,
			Message:     fmt.Sprintf("Номер заблокирован на %v. Попробуйте позже.", remaining),
			ResendAfter: remaining,
		}, nil
	}

	// Проверяем, есть ли активный код (защита от дублирования)
	if activeOTP, err := s.otpRepo.GetActiveByPhone(phone); err == nil && activeOTP != nil {
		// Если есть активный код, возвращаем информацию о нем
		return &models.SendOTPResponse{
			Success:   true,
			Message:   "Код уже отправлен",
			ExpiresAt: activeOTP.ExpiresAt,
		}, nil
	}

	// Удаляем старые OTP коды для этого номера
	if err := s.otpRepo.DeleteByPhone(phone); err != nil {
		s.logger.Error("Failed to delete old OTP codes", "phone", phone, "error", err.Error())
	}

	// Генерируем новый OTP код
	code := s.generateOTPCode()
	expiresAt := time.Now().Add(10 * time.Minute) // 10 минут на верификацию

	otp := &models.OTPCode{
		Phone:       phone,
		Code:        code,
		ExpiresAt:   expiresAt,
		MaxAttempts: 3,
	}

	// Сохраняем в базу
	if err := s.otpRepo.Create(otp); err != nil {
		s.logger.Error("Failed to create OTP code", "phone", phone, "error", err.Error())
		return nil, fmt.Errorf("failed to create OTP code: %w", err)
	}

	// Отправляем SMS асинхронно (не блокируем ответ)
	go func() {
		message := fmt.Sprintf("Clintech: Ваш код подтверждения %s. Действует 10 минут.", code)
		if err := s.smsSender.Send(phone, message); err != nil {
			s.logger.Error("Failed to send OTP SMS", "phone", phone, "error", err.Error())
		} else {
			s.logger.Info("OTP SMS sent successfully", "phone", phone, "code", code)
		}
	}()

	s.logger.Info("OTP code created successfully", "phone", phone, "expires_at", expiresAt)

	return &models.SendOTPResponse{
		Success:   true,
		Message:   "OTP код отправлен",
		ExpiresAt: expiresAt,
	}, nil
}

// VerifyOTP верифицирует OTP код
func (s *otpService) VerifyOTP(phone, code string) (*models.VerifyOTPResponse, error) {
	// Получаем активный OTP код
	otp, err := s.otpRepo.GetActiveByPhone(phone)
	if err != nil {
		return &models.VerifyOTPResponse{
			Success: false,
			Message: "Код не найден или истек",
		}, nil
	}

	// Проверяем, можно ли еще попытаться
	if !otp.CanAttempt() {
		if otp.IsBlocked() {
			remaining := otp.GetBlockTimeRemaining()
			return &models.VerifyOTPResponse{
				Success: false,
				Message: fmt.Sprintf("Код заблокирован на %v. Попробуйте позже.", remaining),
			}, nil
		}
		return &models.VerifyOTPResponse{
			Success: false,
			Message: "Превышено количество попыток или код истек",
		}, nil
	}

	// Увеличиваем счетчик попыток
	otp.IncrementAttempts()

	// Проверяем код
	if otp.Code != code {
		// Сохраняем обновленный счетчик попыток
		if err := s.otpRepo.Update(otp); err != nil {
			s.logger.Error("Failed to update OTP attempts", "phone", phone, "error", err.Error())
		}

		remaining := otp.MaxAttempts - otp.Attempts
		message := fmt.Sprintf("Неверный код. Осталось попыток: %d", remaining)

		// Если заблокировали после этой попытки
		if otp.IsBlocked() {
			blockTime := otp.GetBlockTimeRemaining()
			message = fmt.Sprintf("Код заблокирован на %v. Попробуйте позже.", blockTime)
		}

		return &models.VerifyOTPResponse{
			Success:           false,
			Message:           message,
			RemainingAttempts: remaining,
		}, nil
	}

	// Код верный - отмечаем как верифицированный
	otp.MarkAsVerified()
	if err := s.otpRepo.Update(otp); err != nil {
		s.logger.Error("Failed to mark OTP as verified", "phone", phone, "error", err.Error())
		return nil, fmt.Errorf("failed to mark OTP as verified: %w", err)
	}

	s.logger.Info("OTP code verified successfully", "phone", phone)

	return &models.VerifyOTPResponse{
		Success:    true,
		Message:    "Код подтвержден",
		VerifiedAt: *otp.VerifiedAt,
	}, nil
}

// ResendOTP повторно отправляет OTP код
func (s *otpService) ResendOTP(phone string) (*models.SendOTPResponse, error) {
	// Проверяем время последней отправки
	if lastSent, err := s.otpRepo.GetResendTime(phone); err == nil {
		timeSinceLast := time.Since(lastSent)
		if timeSinceLast < 2*time.Minute {
			remaining := 2*time.Minute - timeSinceLast
			return &models.SendOTPResponse{
				Success:     false,
				Message:     "Подождите 2 минуты перед повторной отправкой",
				ResendAfter: remaining,
			}, nil
		}
	}

	// Отправляем новый OTP
	return s.SendOTP(phone)
}

// CleanupExpired удаляет истекшие OTP коды
func (s *otpService) CleanupExpired() error {
	return s.otpRepo.DeleteExpired()
}

// generateOTPCode генерирует 4-значный OTP код
func (s *otpService) generateOTPCode() string {
	rand.Seed(time.Now().UnixNano())
	return fmt.Sprintf("%04d", rand.Intn(10000))
}
