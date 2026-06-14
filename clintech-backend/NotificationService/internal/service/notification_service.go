package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"NotificationService/internal/domain/models"
	"NotificationService/internal/domain/repository"
	"NotificationService/internal/infrastructure/codegen"
	"NotificationService/internal/infrastructure/email"
	"NotificationService/internal/infrastructure/sms"
	"NotificationService/internal/infrastructure/telegram"
	"NotificationService/internal/infrastructure/whatsapp"

	"encoding/json"

	"github.com/google/uuid"
)

// LoggerInterface - интерфейс для логгера
type LoggerInterface interface {
	Info(msg string, keysAndValues ...interface{})
	Error(msg string, keysAndValues ...interface{})
	Fatal(msg string, keysAndValues ...interface{})
	Sugar() SugarInterface
}

// SugarInterface - интерфейс для Sugar логгера
type SugarInterface interface {
	Infow(msg string, keysAndValues ...interface{})
	Errorw(msg string, keysAndValues ...interface{})
	Fatalw(msg string, keysAndValues ...interface{})
	Warnw(msg string, keysAndValues ...interface{})
}

type NotificationService interface {
	Send(ctx context.Context, notification *models.Notification) error
	Get(ctx context.Context, id int64) (*models.Notification, error)
	List(ctx context.Context, recipientID uuid.UUID) ([]*models.Notification, error)
	MarkAsSent(ctx context.Context, id int64) error
}

type notificationService struct {
	repo            repository.NotificationRepository
	email           email.Sender
	sms             sms.Sender
	telegram        telegram.Sender
	whatsapp        whatsapp.Sender
	codegen         codegen.Generator
	log             LoggerInterface
	identity        *IdentityNotificationService
	patient         *PatientNotificationService
	specialist      *SpecialistNotificationService
	calendar        *CalendarNotificationService
	fileserver      *FileServerNotificationService
	formatter       *MessageFormatter
	whatsappEnabled bool
}

func NewNotificationService(
	repo repository.NotificationRepository,
	emailSender email.Sender,
	telegramSender telegram.Sender,
	whatsappSender whatsapp.Sender,
	codeGenerator codegen.Generator,
	log LoggerInterface,
	smsSender sms.Sender,
	whatsappEnabled bool,
) NotificationService {
	return &notificationService{
		repo:            repo,
		email:           emailSender,
		telegram:        telegramSender,
		whatsapp:        whatsappSender,
		codegen:         codeGenerator,
		log:             log,
		sms:             smsSender,
		identity:        NewIdentityNotificationService(codeGenerator),
		patient:         NewPatientNotificationService(),
		specialist:      NewSpecialistNotificationService(),
		calendar:        NewCalendarNotificationService(),
		fileserver:      NewFileServerNotificationService(),
		formatter:       NewMessageFormatter(),
		whatsappEnabled: whatsappEnabled,
	}
}

func (s *notificationService) Send(ctx context.Context, notification *models.Notification) error {
	notification.CreatedAt = time.Now()
	notification.Status = models.StatusPending

	// Генерация сообщения, если не передано
	if notification.Message == "" {
		s.enrichMessage(notification)
	}

	// Сохраняем в БД
	err := s.repo.Create(ctx, notification)
	if err != nil {
		s.log.Error("failed to create notification", "error", err)
		return err
	}

	// Отправка
	var sendErr error
	switch notification.Channel {
	case models.ChannelEmail:
		if s.email == nil {
			s.log.Error("email sender not configured")
			sendErr = errors.New("email sender not configured")
		} else {
			// Используем обычное сообщение для email пока не добавим FormatForEmail
			sendErr = s.email.Send(notification.Recipient, "Уведомление", notification.Message)
		}
	case models.ChannelSMS:
		fmt.Printf("🐰 DEBUG: Начинаем отправку SMS\n")
		if s.sms == nil {
			fmt.Printf("🐰 DEBUG: SMS sender НЕ настроен!\n")
			s.log.Error("SMS sender not configured")
			sendErr = errors.New("SMS sender not configured")
		} else {
			fmt.Printf("🐰 DEBUG: SMS sender настроен, готовим данные\n")
			// Получаем данные из уведомления для форматирования
			var data map[string]interface{}
			if notification.Metadata != nil && *notification.Metadata != "" {
				// Пытаемся распарсить метаданные как обычный JSON
				var metadata map[string]interface{}
				if err := json.Unmarshal([]byte(*notification.Metadata), &metadata); err == nil {
					// Используем обычные метаданные
					data = metadata
					data["message"] = notification.Message
					fmt.Printf("🐰 DEBUG: Используем обычные метаданные: %+v\n", data)
				} else {
					// Если не удалось распарсить, пробуем AppointmentMetadata
					appointmentMeta, err := notification.GetAppointmentMetadata()
					if err == nil && appointmentMeta != nil {
						// Конвертируем AppointmentMetadata в map[string]interface{}
						data = map[string]interface{}{
							"doctor_name":      appointmentMeta.DoctorName,
							"patient_name":     appointmentMeta.PatientName,
							"appointment_date": appointmentMeta.DateTime.Format("02.01.2006"),
							"appointment_time": appointmentMeta.DateTime.Format("15:04"),
							"specialty":        appointmentMeta.Specialty,
							"duration":         appointmentMeta.Duration,
							"message":          notification.Message,
						}
						fmt.Printf("🐰 DEBUG: Используем AppointmentMetadata: %+v\n", data)
					} else {
						// Если не получилось, пробуем UserMetadata
						userMeta, err := notification.GetUserMetadata()
						if err != nil {
							// Если не удалось распарсить metadata, создаем базовые данные
							data = map[string]interface{}{
								"message": notification.Message,
							}
							fmt.Printf("🐰 DEBUG: Не удалось распарсить метаданные, используем базовые данные\n")
						} else if userMeta != nil {
							// Конвертируем UserMetadata в map[string]interface{}
							data = map[string]interface{}{
								"email":   userMeta.Email,
								"role":    userMeta.Role,
								"message": notification.Message,
							}
							fmt.Printf("🐰 DEBUG: Используем UserMetadata: %+v\n", data)
						} else {
							data = map[string]interface{}{
								"message": notification.Message,
							}
							fmt.Printf("🐰 DEBUG: Метаданные пустые, используем базовые данные\n")
						}
					}
				}
			} else {
				data = map[string]interface{}{
					"message": notification.Message,
				}
				fmt.Printf("🐰 DEBUG: Нет метаданных, используем базовые данные\n")
			}

			// Определяем тип уведомления для форматирования
			notificationType := s.getNotificationTypeString(notification.Type)
			fmt.Printf("🐰 DEBUG: Тип уведомления: %s\n", notificationType)
			formattedMessage := s.formatter.FormatForSMS(notificationType, data)
			fmt.Printf("🐰 DEBUG: Сформированное сообщение: %s\n", formattedMessage)
			fmt.Printf("🐰 DEBUG: Отправляем SMS на номер: %s\n", notification.Recipient)
			sendErr = s.sms.Send(notification.Recipient, formattedMessage)
			if sendErr != nil {
				fmt.Printf("🐰 DEBUG: Ошибка отправки SMS: %v\n", sendErr)
			} else {
				fmt.Printf("🐰 DEBUG: SMS отправлена успешно!\n")
			}
		}
	case models.ChannelTelegram:
		if s.telegram == nil {
			s.log.Error("telegram sender not configured")
			sendErr = errors.New("telegram sender not configured")
		} else {
			// Используем улучшенное форматирование для Telegram
			if telegramMsg, useMarkdown := s.formatter.FormatForTelegram(notification); useMarkdown {
				sendErr = s.telegram.SendMarkdown(telegramMsg)
			} else {
				sendErr = s.telegram.Send(notification.Message)
			}
		}
	case models.ChannelWhatsApp:
		if !s.whatsappEnabled {
			s.log.Error("WhatsApp notifications are disabled")
			sendErr = errors.New("WhatsApp notifications are disabled")
		} else if s.whatsapp == nil {
			s.log.Error("WhatsApp sender not configured")
			sendErr = errors.New("WhatsApp sender not configured")
		} else {
			// Проверяем, нужно ли использовать шаблон
			if strings.HasPrefix(notification.Message, "template:") {
				templateName := strings.TrimPrefix(notification.Message, "template:")

				// Получаем метаданные пользователя для переменных шаблона
				userMeta, err := notification.GetUserMetadata()
				if err != nil {
					s.log.Error("failed to get user metadata for template", "error", err)
					sendErr = errors.New("failed to get template variables")
				} else {
					// Подготавливаем переменные для шаблона
					variables := map[string]string{}

					// Проверяем что метаданные есть
					if userMeta != nil && userMeta.FullName != "" {
						variables["1"] = userMeta.FullName // {{1}} будет заменено на имя пользователя
					} else {
						variables["1"] = "Пользователь" // Значение по умолчанию
					}

					// Отправляем с использованием шаблона
					sendErr = s.whatsapp.SendWithTemplate(notification.Recipient, templateName, variables)
				}
			} else {
				// Используем улучшенное форматирование для обычных WhatsApp сообщений
				if whatsappMsg, useFormatting := s.formatter.FormatForWhatsApp(notification); useFormatting {
					sendErr = s.whatsapp.Send(notification.Recipient, whatsappMsg)
				} else {
					sendErr = s.whatsapp.Send(notification.Recipient, notification.Message)
				}
			}
		}
	default:
		sendErr = errors.New("unsupported notification channel")
	}

	// Обработка результата отправки
	if sendErr != nil {
		s.log.Error("failed to send notification", "error", sendErr)
		notification.Status = models.StatusFailed
		lastErr := sendErr.Error()
		notification.LastError = &lastErr
		notification.Attempts++
	} else {
		now := time.Now()
		notification.Status = models.StatusSent
		notification.SentAt = &now
	}

	// Обновляем статус в БД
	if err := s.repo.UpdateStatus(ctx, notification); err != nil {
		s.log.Error("failed to update notification status", "error", err)
		return err
	}

	return sendErr
}

func (s *notificationService) enrichMessage(notification *models.Notification) {
	typ := string(notification.Type)

	switch {
	case strings.HasPrefix(typ, "user."):
		s.identity.Enrich(notification)
	case strings.HasPrefix(typ, "appointment."), strings.HasPrefix(typ, "lab."), strings.HasPrefix(typ, "patient."):
		s.patient.Enrich(notification)
	case strings.HasPrefix(typ, "specialist."):
		s.specialist.Enrich(notification)
	case strings.HasPrefix(typ, "calendar."):
		s.calendar.Enrich(notification)
	case strings.HasPrefix(typ, "file."):
		s.fileserver.Enrich(notification)
	default:
		s.log.Sugar().Warnw("unknown notification type; message left empty", "type", typ)

	}
}

func (s *notificationService) Get(ctx context.Context, id int64) (*models.Notification, error) {
	return s.repo.GetByID(ctx, id)
}

func (s *notificationService) List(ctx context.Context, recipientID uuid.UUID) ([]*models.Notification, error) {
	return s.repo.ListByRecipient(ctx, recipientID)
}

func (s *notificationService) MarkAsSent(ctx context.Context, id int64) error {
	return s.repo.MarkAsSent(ctx, id)
}

func (s *notificationService) getNotificationTypeString(notType models.NotificationType) string {
	switch notType {
	case models.UserRegistered:
		return "user_registered"
	case models.UserProfileUpdated:
		return "user_profile_updated"
	case models.AppointmentBooked:
		return "appointment_booked"
	case models.AppointmentNew:
		return "appointment_new"
	case models.AppointmentCanceled:
		return "appointment_canceled"
	case models.AppointmentReminder:
		return "appointment_reminder"
	default:
		return "generic"
	}
}
