package messaging

import (
	"context"
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
	"time"

	"NotificationService/internal/domain/models"
	"NotificationService/internal/service"

	"github.com/google/uuid"
	amqp "github.com/rabbitmq/amqp091-go"
)

// normalizePhoneNumber нормализует номер телефона в международный формат
// Поддерживает форматы: +77071234567, 87071234567, 77071234567, 7071234567
func normalizePhoneNumber(phone string) string {
	// Убираем все пробелы, дефисы и скобки
	phone = regexp.MustCompile(`[\s\-\(\)]`).ReplaceAllString(phone, "")

	// Убираем + если есть
	phone = strings.TrimPrefix(phone, "+")

	// Если номер начинается с 8, заменяем на 7
	if strings.HasPrefix(phone, "8") && len(phone) == 11 {
		phone = "7" + phone[1:]
	}

	// Если номер уже начинается с 7 и имеет правильную длину - возвращаем как есть
	if strings.HasPrefix(phone, "7") && len(phone) == 11 {
		return phone
	}

	// Если номер 10 цифр, добавляем 7 в начало
	if len(phone) == 10 {
		phone = "7" + phone
	}

	return phone
}

// LoggerInterface интерфейс для логгера
type LoggerInterface interface {
	Info(msg string, keysAndValues ...interface{})
	Error(msg string, keysAndValues ...interface{})
}

// Consumer обрабатывает сообщения из RabbitMQ
type Consumer struct {
	conn            *amqp.Connection
	channel         *amqp.Channel
	notificationSvc service.NotificationService
	logger          LoggerInterface
}

// UserCreatedEvent событие создания пользователя
type UserCreatedEvent struct {
	UserID string `json:"user_id"`
	Email  string `json:"email"`
	Role   string `json:"role"`
	Phone  string `json:"phone"` // Номер телефона (обязательно)
}

// AppointmentBookedEvent событие бронирования записи к врачу
type AppointmentBookedEvent struct {
	Type            string    `json:"type"`
	AppointmentID   uuid.UUID `json:"appointment_id"`
	PatientID       uuid.UUID `json:"patient_id"`
	DoctorID        uuid.UUID `json:"doctor_id"`
	PatientEmail    string    `json:"patient_email"`
	DoctorEmail     string    `json:"doctor_email"`
	PatientPhone    string    `json:"patient_phone"`
	DoctorPhone     string    `json:"doctor_phone"`
	PatientName     string    `json:"patient_name"`
	DoctorName      string    `json:"doctor_name"`
	StartTime       time.Time `json:"start_time"`
	EndTime         time.Time `json:"end_time"`
	AppointmentType string    `json:"appointment_type"`
	PatientNotes    string    `json:"patient_notes"`
}

type AppointmentCanceledEvent struct {
	Type            string    `json:"type"`
	AppointmentID   uuid.UUID `json:"appointment_id"`
	PatientID       uuid.UUID `json:"patient_id"`
	DoctorID        uuid.UUID `json:"doctor_id"`
	PatientEmail    string    `json:"patient_email"`
	DoctorEmail     string    `json:"doctor_email"`
	PatientPhone    string    `json:"patient_phone"`
	DoctorPhone     string    `json:"doctor_phone"`
	PatientName     string    `json:"patient_name"`
	DoctorName      string    `json:"doctor_name"`
	StartTime       time.Time `json:"start_time"`
	EndTime         time.Time `json:"end_time"`
	AppointmentType string    `json:"appointment_type"`
	CancelReason    string    `json:"cancel_reason,omitempty"`
}

// AppointmentRescheduledEvent событие переноса записи
// Поддерживается appointment_service
// Публикуется с routing_key, настроенным в appointment_service (по умолчанию appointment.booked)
type AppointmentRescheduledEvent struct {
	Type            string    `json:"type"`
	AppointmentID   uuid.UUID `json:"appointment_id"`
	PatientID       uuid.UUID `json:"patient_id"`
	DoctorID        uuid.UUID `json:"doctor_id"`
	PatientPhone    string    `json:"patient_phone"`
	DoctorPhone     string    `json:"doctor_phone"`
	PatientName     string    `json:"patient_name"`
	DoctorName      string    `json:"doctor_name"`
	OldStartTime    time.Time `json:"old_start_time"`
	OldEndTime      time.Time `json:"old_end_time"`
	NewStartTime    time.Time `json:"new_start_time"`
	NewEndTime      time.Time `json:"new_end_time"`
	AppointmentType string    `json:"appointment_type"`
	Reason          string    `json:"reason,omitempty"`
}

func NewConsumer(rabbitMQURL string, notificationSvc service.NotificationService, logger LoggerInterface) (*Consumer, error) {
	conn, err := amqp.Dial(rabbitMQURL)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to RabbitMQ: %w", err)
	}

	channel, err := conn.Channel()
	if err != nil {
		conn.Close()
		return nil, fmt.Errorf("failed to open channel: %w", err)
	}

	// Declare exchange
	err = channel.ExchangeDeclare(
		"clintech", // name
		"topic",   // type
		true,      // durable
		false,     // auto-deleted
		false,     // internal
		false,     // no-wait
		nil,       // arguments
	)
	if err != nil {
		channel.Close()
		conn.Close()
		return nil, fmt.Errorf("failed to declare exchange: %w", err)
	}

	// Declare notification.events exchange для событий записи
	err = channel.ExchangeDeclare(
		"notification.events", // name
		"topic",               // type
		true,                  // durable
		false,                 // auto-deleted
		false,                 // internal
		false,                 // no-wait
		nil,                   // arguments
	)
	if err != nil {
		channel.Close()
		conn.Close()
		return nil, fmt.Errorf("failed to declare notification.events exchange: %w", err)
	}

	// Declare queue for user events
	userQueue, err := channel.QueueDeclare(
		"notification.user.events", // name
		true,                       // durable
		false,                      // delete when unused
		false,                      // exclusive
		false,                      // no-wait
		nil,                        // arguments
	)
	if err != nil {
		channel.Close()
		conn.Close()
		return nil, fmt.Errorf("failed to declare user events queue: %w", err)
	}

	// Bind queue to exchange
	err = channel.QueueBind(
		userQueue.Name, // queue name
		"user.created", // routing key
		"clintech",      // exchange
		false,
		nil,
	)
	if err != nil {
		channel.Close()
		conn.Close()
		return nil, fmt.Errorf("failed to bind user events queue: %w", err)
	}

	// Declare queue for appointment events
	appointmentQueue, err := channel.QueueDeclare(
		"notification.appointment.events", // name
		true,                              // durable
		false,                             // delete when unused
		false,                             // exclusive
		false,                             // no-wait
		nil,                               // arguments
	)
	if err != nil {
		channel.Close()
		conn.Close()
		return nil, fmt.Errorf("failed to declare appointment events queue: %w", err)
	}

	// Bind queue to exchange
	err = channel.QueueBind(
		appointmentQueue.Name, // queue name
		"appointment.booked",  // routing key
		"notification.events", // exchange
		false,
		nil,
	)
	if err != nil {
		channel.Close()
		conn.Close()
		return nil, fmt.Errorf("failed to bind appointment events queue: %w", err)
	}

	return &Consumer{
		conn:            conn,
		channel:         channel,
		notificationSvc: notificationSvc,
		logger:          logger,
	}, nil
}

func (c *Consumer) StartConsumer(ctx context.Context) error {
	// Обрабатываем события создания пользователей
	userMsgs, err := c.channel.Consume(
		"notification.user.events", // queue
		"",                         // consumer
		true,                       // auto-ack
		false,                      // exclusive
		false,                      // no-local
		false,                      // no-wait
		nil,                        // args
	)
	if err != nil {
		return fmt.Errorf("failed to register user events consumer: %w", err)
	}

	// Обрабатываем события записи к врачу
	appointmentMsgs, err := c.channel.Consume(
		"notification.appointment.events", // queue
		"",                                // consumer
		true,                              // auto-ack
		false,                             // exclusive
		false,                             // no-local
		false,                             // no-wait
		nil,                               // args
	)
	if err != nil {
		return fmt.Errorf("failed to register appointment events consumer: %w", err)
	}

	c.logger.Info("Started RabbitMQ consumer for user and appointment events")

	go func() {
		for {
			select {
			case msg := <-userMsgs:
				c.handleUserCreatedEvent(ctx, msg.Body)
			case msg := <-appointmentMsgs:
				// Определяем тип события по routing key или содержимому
				var eventType struct {
					Type string `json:"type,omitempty"`
				}
				if err := json.Unmarshal(msg.Body, &eventType); err == nil {
					switch eventType.Type {
					case "appointment_canceled":
						c.handleAppointmentCanceledEvent(ctx, msg.Body)
					case "appointment_rescheduled":
						c.handleAppointmentRescheduledEvent(ctx, msg.Body)
					case "appointment_completed":
						c.handleAppointmentCompletedEvent(ctx, msg.Body)
					default:
						c.handleAppointmentBookedEvent(ctx, msg.Body)
					}
				} else {
					// Если не удалось определить тип, обрабатываем как booked
					c.handleAppointmentBookedEvent(ctx, msg.Body)
				}
			case <-ctx.Done():
				c.logger.Info("Consumer context cancelled")
				return
			}
		}
	}()

	return nil
}

func (c *Consumer) handleUserCreatedEvent(ctx context.Context, body []byte) {
	// ДОБАВЛЯЕМ DEBUG ЛОГ
	fmt.Printf("🐰 DEBUG: Получено событие регистрации пользователя, размер: %d байт\n", len(body))

	var event UserCreatedEvent
	if err := json.Unmarshal(body, &event); err != nil {
		c.logger.Error("failed to unmarshal user created event", "error", err)
		return
	}

	fmt.Printf("🐰 DEBUG: Событие распаковано - UserID: %s, Email: %s, Phone: %s\n",
		event.UserID, event.Email, event.Phone)

	c.logger.Info("processing user created event", "userID", event.UserID, "email", event.Email)

	// Convert string UserID to UUID
	userID, err := uuid.Parse(event.UserID)
	if err != nil {
		c.logger.Error("invalid user ID format", "userID", event.UserID, "error", err)
		return
	}

	// Создаем метаданные пользователя для детализированного уведомления
	userMetadata := &models.UserMetadata{
		UserID:   userID,
		Email:    event.Email,
		Role:     event.Role,
		Username: event.Email, // Используем email как username, поскольку отдельного username нет
		FullName: event.Email, // Пока используем email, в будущем можно расширить
	}

	// Отправляем приветственный email только если email непустой
	if event.Email != "" {
		emailNotification := &models.Notification{
			Type:        models.UserRegistered,
			Channel:     models.ChannelEmail,
			RecipientID: userID,
			Recipient:   event.Email,
			// Message will be auto-generated by enrichMessage
		}

		// Устанавливаем метаданные для email уведомления
		if err := emailNotification.SetMetadata(userMetadata); err != nil {
			c.logger.Error("failed to set metadata for email notification", "userID", event.UserID, "error", err)
		}

		if err := c.notificationSvc.Send(ctx, emailNotification); err != nil {
			c.logger.Error("failed to send welcome email notification", "userID", event.UserID, "error", err)
		} else {
			c.logger.Info("welcome email notification sent successfully", "userID", event.UserID, "email", event.Email)
		}
	} else {
		c.logger.Info("skipping email notification: empty email", "userID", event.UserID)
	}

	// Создаем SMS уведомление
	userUUID, err := uuid.Parse(event.UserID)
	if err != nil {
		c.logger.Error("Ошибка парсинга UUID пользователя", map[string]interface{}{
			"user_id": event.UserID,
			"error":   err.Error(),
		})
		return
	}

	smsNotification := &models.Notification{
		Type:        models.UserRegistered,
		Channel:     models.ChannelSMS,
		RecipientID: userUUID,
		Recipient:   normalizePhoneNumber(event.Phone),
		Message:     "user_registered", // Тип сообщения для форматирования
		Status:      models.StatusPending,
		CreatedAt:   time.Now(),
	}

	// Устанавливаем метаданные
	metadata := &models.UserMetadata{
		Email: event.Email,
		Role:  event.Role,
	}
	if err := smsNotification.SetMetadata(metadata); err != nil {
		c.logger.Error("Ошибка установки метаданных для SMS", map[string]interface{}{
			"error": err.Error(),
		})
		return
	}

	// Отправляем SMS уведомление
	fmt.Printf("🐰 DEBUG: Отправляем SMS на номер: %s\n", normalizePhoneNumber(event.Phone))
	if err := c.notificationSvc.Send(context.Background(), smsNotification); err != nil {
		c.logger.Error("Ошибка отправки SMS уведомления", map[string]interface{}{
			"user_id": event.UserID,
			"phone":   event.Phone,
			"error":   err.Error(),
		})
	} else {
		c.logger.Info("SMS уведомление отправлено успешно", map[string]interface{}{
			"user_id": event.UserID,
			"phone":   normalizePhoneNumber(event.Phone),
		})
	}

	// Create welcome WhatsApp notification using template
	// Используем реальный номер из события
	whatsappNumber := normalizePhoneNumber(event.Phone)

	// Определяем имя пользователя для шаблона
	userName := event.Email // По умолчанию используем email
	if userMetadata.FullName != "" && userMetadata.FullName != event.Email {
		userName = userMetadata.FullName
	}

	whatsappNotification := &models.Notification{
		Type:        models.UserRegistered,
		Channel:     models.ChannelWhatsApp,
		RecipientID: userID,
		Recipient:   whatsappNumber,
		Message:     "template:HX4d0810969c3d095e089147b8c5fbe8d2", // Указываем использование шаблона с Content SID
		// Metadata будет содержать переменные для шаблона
	}

	// Устанавливаем метаданные для WhatsApp уведомления
	templateMetadata := &models.UserMetadata{
		UserID:   userID,
		Email:    event.Email,
		Role:     event.Role,
		Username: userName,
		FullName: userName, // Это будет передано как {{1}} в шаблон
	}

	if err := whatsappNotification.SetMetadata(templateMetadata); err != nil {
		c.logger.Error("failed to set metadata for WhatsApp notification", "userID", event.UserID, "error", err)
	}

	if err := c.notificationSvc.Send(ctx, whatsappNotification); err != nil {
		c.logger.Error("failed to send welcome WhatsApp notification", "userID", event.UserID, "error", err)
	} else {
		c.logger.Info("welcome WhatsApp notification sent successfully", "userID", event.UserID, "phone", whatsappNumber)
	}

	// Create welcome Telegram notification для администраторов с детализированной информацией
	telegramNotification := &models.Notification{
		Type:        models.UserRegistered,
		Channel:     models.ChannelTelegram,
		RecipientID: userID,
		Recipient:   "admin", // Telegram отправляется в админский чат
		// Message will be auto-generated by enrichMessage и отформатировано MessageFormatter
	}

	// Устанавливаем метаданные для Telegram уведомления
	if err := telegramNotification.SetMetadata(userMetadata); err != nil {
		c.logger.Error("failed to set metadata for Telegram notification", "userID", event.UserID, "error", err)
	}

	if err := c.notificationSvc.Send(ctx, telegramNotification); err != nil {
		c.logger.Error("failed to send welcome Telegram notification", "userID", event.UserID, "error", err)
	} else {
		c.logger.Info("welcome Telegram notification sent successfully", "userID", event.UserID, "email", event.Email)
	}
}

func (c *Consumer) handleAppointmentBookedEvent(ctx context.Context, body []byte) {
	var event AppointmentBookedEvent
	if err := json.Unmarshal(body, &event); err != nil {
		c.logger.Error("failed to unmarshal appointment booked event", "error", err)
		return
	}

	c.logger.Info("processing appointment booked event", "appointmentID", event.AppointmentID)

	// Отправляем WhatsApp уведомление пациенту
	patientWhatsAppNotification := &models.Notification{
		Type:        models.AppointmentBooked,
		Channel:     models.ChannelWhatsApp,
		RecipientID: event.PatientID,
		Recipient:   event.PatientPhone,
		// Message will be auto-generated by enrichMessage
	}
	if err := c.notificationSvc.Send(ctx, patientWhatsAppNotification); err != nil {
		c.logger.Error("failed to send appointment booked WhatsApp notification to patient", "appointmentID", event.AppointmentID, "error", err)
	} else {
		c.logger.Info("appointment booked WhatsApp notification sent to patient", "appointmentID", event.AppointmentID, "patientPhone", event.PatientPhone)
	}

	// Отправляем WhatsApp уведомление врачу
	doctorWhatsAppNotification := &models.Notification{
		Type:        models.AppointmentNew,
		Channel:     models.ChannelWhatsApp,
		RecipientID: event.DoctorID,
		Recipient:   event.DoctorPhone,
		// Message will be auto-generated by enrichMessage
	}
	if err := c.notificationSvc.Send(ctx, doctorWhatsAppNotification); err != nil {
		c.logger.Error("failed to send appointment new WhatsApp notification to doctor", "appointmentID", event.AppointmentID, "error", err)
	} else {
		c.logger.Info("appointment new WhatsApp notification sent to doctor", "appointmentID", event.AppointmentID, "doctorPhone", event.DoctorPhone)
	}

	// Отправляем SMS уведомление пациенту
	patientSMSNotification := &models.Notification{
		Type:        models.AppointmentBooked,
		Channel:     models.ChannelSMS,
		RecipientID: event.PatientID,
		Recipient:   normalizePhoneNumber(event.PatientPhone),
		Message:     "appointment_booked",
		Status:      models.StatusPending,
		CreatedAt:   time.Now(),
	}
	patientSMSMetadata := map[string]interface{}{
		"doctor_name":      event.DoctorName,
		"appointment_date": event.StartTime.Format("02.01.2006"),
		"appointment_time": event.StartTime.Format("15:04"),
		"patient_name":     event.PatientName,
		"appointment_type": event.AppointmentType,
	}
	if err := patientSMSNotification.SetMetadata(patientSMSMetadata); err != nil {
		c.logger.Error("failed to set metadata for patient SMS notification", "appointmentID", event.AppointmentID, "error", err)
	}
	if err := c.notificationSvc.Send(ctx, patientSMSNotification); err != nil {
		c.logger.Error("failed to send appointment booked SMS notification to patient", "appointmentID", event.AppointmentID, "error", err)
	} else {
		c.logger.Info("appointment booked SMS notification sent to patient", "appointmentID", event.AppointmentID, "patientPhone", event.PatientPhone)
	}

	// Отправляем SMS уведомление врачу
	doctorSMSNotification := &models.Notification{
		Type:        models.AppointmentNew,
		Channel:     models.ChannelSMS,
		RecipientID: event.DoctorID,
		Recipient:   normalizePhoneNumber(event.DoctorPhone),
		Message:     "appointment_new",
		Status:      models.StatusPending,
		CreatedAt:   time.Now(),
	}
	doctorSMSMetadata := map[string]interface{}{
		"patient_name":     event.PatientName,
		"appointment_date": event.StartTime.Format("02.01.2006"),
		"appointment_time": event.StartTime.Format("15:04"),
		"doctor_name":      event.DoctorName,
		"appointment_type": event.AppointmentType,
	}
	if err := doctorSMSNotification.SetMetadata(doctorSMSMetadata); err != nil {
		c.logger.Error("failed to set metadata for doctor SMS notification", "appointmentID", event.AppointmentID, "error", err)
	}
	if err := c.notificationSvc.Send(ctx, doctorSMSNotification); err != nil {
		c.logger.Error("failed to send appointment new SMS notification to doctor", "appointmentID", event.AppointmentID, "error", err)
	} else {
		c.logger.Info("appointment new SMS notification sent to doctor", "appointmentID", event.AppointmentID, "doctorPhone", event.DoctorPhone)
	}
}

func (c *Consumer) handleAppointmentCanceledEvent(ctx context.Context, body []byte) {
	var event AppointmentCanceledEvent
	if err := json.Unmarshal(body, &event); err != nil {
		c.logger.Error("failed to unmarshal appointment canceled event", "error", err)
		return
	}

	c.logger.Info("processing appointment canceled event", "appointmentID", event.AppointmentID)

	// Отправляем SMS уведомление пациенту
	patientSMSNotification := &models.Notification{
		Type:        models.AppointmentCanceled,
		Channel:     models.ChannelSMS,
		RecipientID: event.PatientID,
		Recipient:   normalizePhoneNumber(event.PatientPhone),
		Message:     "appointment_canceled",
		Status:      models.StatusPending,
		CreatedAt:   time.Now(),
	}
	patientSMSMetadata := map[string]interface{}{
		"doctor_name":      event.DoctorName,
		"appointment_date": event.StartTime.Format("02.01.2006"),
		"appointment_time": event.StartTime.Format("15:04"),
		"patient_name":     event.PatientName,
		"appointment_type": event.AppointmentType,
		"cancel_reason":    event.CancelReason,
	}
	if err := patientSMSNotification.SetMetadata(patientSMSMetadata); err != nil {
		c.logger.Error("failed to set metadata for patient SMS notification", "appointmentID", event.AppointmentID, "error", err)
	}
	if err := c.notificationSvc.Send(ctx, patientSMSNotification); err != nil {
		c.logger.Error("failed to send appointment canceled SMS notification to patient", "appointmentID", event.AppointmentID, "error", err)
	} else {
		c.logger.Info("appointment canceled SMS notification sent to patient", "appointmentID", event.AppointmentID, "patientPhone", event.PatientPhone)
	}

	// Отправляем SMS уведомление врачу
	doctorSMSNotification := &models.Notification{
		Type:        models.AppointmentCanceled,
		Channel:     models.ChannelSMS,
		RecipientID: event.DoctorID,
		Recipient:   normalizePhoneNumber(event.DoctorPhone),
		Message:     "appointment_canceled",
		Status:      models.StatusPending,
		CreatedAt:   time.Now(),
	}
	doctorSMSMetadata := map[string]interface{}{
		"patient_name":     event.PatientName,
		"appointment_date": event.StartTime.Format("02.01.2006"),
		"appointment_time": event.StartTime.Format("15:04"),
		"doctor_name":      event.DoctorName,
		"appointment_type": event.AppointmentType,
		"cancel_reason":    event.CancelReason,
	}
	if err := doctorSMSNotification.SetMetadata(doctorSMSMetadata); err != nil {
		c.logger.Error("failed to set metadata for doctor SMS notification", "appointmentID", event.AppointmentID, "error", err)
	}
	if err := c.notificationSvc.Send(ctx, doctorSMSNotification); err != nil {
		c.logger.Error("failed to send appointment canceled SMS notification to doctor", "appointmentID", event.AppointmentID, "error", err)
	} else {
		c.logger.Info("appointment canceled SMS notification sent to doctor", "appointmentID", event.AppointmentID, "doctorPhone", event.DoctorPhone)
	}
}

func (c *Consumer) handleAppointmentRescheduledEvent(ctx context.Context, body []byte) {
	var event AppointmentRescheduledEvent
	if err := json.Unmarshal(body, &event); err != nil {
		c.logger.Error("failed to unmarshal appointment rescheduled event", "error", err)
		return
	}

	c.logger.Info("processing appointment rescheduled event", "appointmentID", event.AppointmentID)

	oldDate := event.OldStartTime.Format("02.01.2006")
	oldTime := event.OldStartTime.Format("15:04")
	newDate := event.NewStartTime.Format("02.01.2006")
	newTime := event.NewStartTime.Format("15:04")

	// Тексты сообщений
	patientMsg := fmt.Sprintf("Перенос приема: было %s %s → стало %s %s.", oldDate, oldTime, newDate, newTime)
	if event.Reason != "" {
		patientMsg += fmt.Sprintf(" Причина: %s.", event.Reason)
	}
	doctorMsg := fmt.Sprintf("Вы перенесли прием: было %s %s → стало %s %s.", oldDate, oldTime, newDate, newTime)
	if event.Reason != "" {
		doctorMsg += fmt.Sprintf(" Причина: %s.", event.Reason)
	}

	// WhatsApp пациенту
	patientWA := &models.Notification{
		Type:        models.AppointmentRescheduled,
		Channel:     models.ChannelWhatsApp,
		RecipientID: event.PatientID,
		Recipient:   normalizePhoneNumber(event.PatientPhone),
		Message:     patientMsg,
	}
	if err := c.notificationSvc.Send(ctx, patientWA); err != nil {
		c.logger.Error("failed to send rescheduled WhatsApp to patient", "appointmentID", event.AppointmentID, "error", err)
	}

	// WhatsApp врачу
	doctorWA := &models.Notification{
		Type:        models.AppointmentRescheduled,
		Channel:     models.ChannelWhatsApp,
		RecipientID: event.DoctorID,
		Recipient:   normalizePhoneNumber(event.DoctorPhone),
		Message:     doctorMsg,
	}
	if err := c.notificationSvc.Send(ctx, doctorWA); err != nil {
		c.logger.Error("failed to send rescheduled WhatsApp to doctor", "appointmentID", event.AppointmentID, "error", err)
	}

	// SMS пациенту
	patientSMS := &models.Notification{
		Type:        models.AppointmentRescheduled,
		Channel:     models.ChannelSMS,
		RecipientID: event.PatientID,
		Recipient:   normalizePhoneNumber(event.PatientPhone),
		Message:     patientMsg,
		Status:      models.StatusPending,
		CreatedAt:   time.Now(),
	}
	if err := c.notificationSvc.Send(ctx, patientSMS); err != nil {
		c.logger.Error("failed to send rescheduled SMS to patient", "appointmentID", event.AppointmentID, "error", err)
	}

	// SMS врачу
	doctorSMS := &models.Notification{
		Type:        models.AppointmentRescheduled,
		Channel:     models.ChannelSMS,
		RecipientID: event.DoctorID,
		Recipient:   normalizePhoneNumber(event.DoctorPhone),
		Message:     doctorMsg,
		Status:      models.StatusPending,
		CreatedAt:   time.Now(),
	}
	if err := c.notificationSvc.Send(ctx, doctorSMS); err != nil {
		c.logger.Error("failed to send rescheduled SMS to doctor", "appointmentID", event.AppointmentID, "error", err)
	}
}

func (c *Consumer) handleAppointmentCompletedEvent(ctx context.Context, body []byte) {
	var event struct {
		Type            string    `json:"type"`
		AppointmentID   uuid.UUID `json:"appointment_id"`
		PatientID       uuid.UUID `json:"patient_id"`
		DoctorID        uuid.UUID `json:"doctor_id"`
		PatientPhone    string    `json:"patient_phone"`
		DoctorPhone     string    `json:"doctor_phone"`
		PatientName     string    `json:"patient_name"`
		DoctorName      string    `json:"doctor_name"`
		StartTime       time.Time `json:"start_time"`
		EndTime         time.Time `json:"end_time"`
		AppointmentType string    `json:"appointment_type"`
		CompletedReason string    `json:"completed_reason,omitempty"`
	}
	if err := json.Unmarshal(body, &event); err != nil {
		c.logger.Error("failed to unmarshal appointment completed event", "error", err)
		return
	}

	c.logger.Info("processing appointment completed event", "appointmentID", event.AppointmentID)

	// Отправляем SMS уведомление пациенту
	patientSMSNotification := &models.Notification{
		Type:        models.AppointmentCompleted,
		Channel:     models.ChannelSMS,
		RecipientID: event.PatientID,
		Recipient:   normalizePhoneNumber(event.PatientPhone),
		Message:     "appointment_completed",
		Status:      models.StatusSent,
		CreatedAt:   time.Now(),
	}
	patientSMSMetadata := map[string]interface{}{
		"doctor_name":      event.DoctorName,
		"appointment_date": event.StartTime.Format("02.01.2006"),
		"appointment_time": event.StartTime.Format("15:04"),
		"patient_name":     event.PatientName,
		"appointment_type": event.AppointmentType,
	}
	if err := patientSMSNotification.SetMetadata(patientSMSMetadata); err != nil {
		c.logger.Error("failed to set metadata for patient SMS notification", "appointmentID", event.AppointmentID, "error", err)
	}
	if err := c.notificationSvc.Send(ctx, patientSMSNotification); err != nil {
		c.logger.Error("failed to send appointment completed SMS notification to patient", "appointmentID", event.AppointmentID, "error", err)
	} else {
		c.logger.Info("appointment completed SMS notification sent to patient", "appointmentID", event.AppointmentID, "patientPhone", event.PatientPhone)
	}

	// Отправляем SMS уведомление врачу
	doctorSMSNotification := &models.Notification{
		Type:        models.AppointmentCompleted,
		Channel:     models.ChannelSMS,
		RecipientID: event.DoctorID,
		Recipient:   normalizePhoneNumber(event.DoctorPhone),
		Message:     "appointment_completed",
		Status:      models.StatusSent,
		CreatedAt:   time.Now(),
	}
	doctorSMSMetadata := map[string]interface{}{
		"patient_name":     event.PatientName,
		"appointment_date": event.StartTime.Format("02.01.2006"),
		"appointment_time": event.StartTime.Format("15:04"),
		"doctor_name":      event.DoctorName,
		"appointment_type": event.AppointmentType,
	}
	if err := doctorSMSNotification.SetMetadata(doctorSMSMetadata); err != nil {
		c.logger.Error("failed to set metadata for doctor SMS notification", "appointmentID", event.AppointmentID, "error", err)
	}
	if err := c.notificationSvc.Send(ctx, doctorSMSNotification); err != nil {
		c.logger.Error("failed to send appointment completed SMS notification to doctor", "appointmentID", event.AppointmentID, "error", err)
	} else {
		c.logger.Info("appointment completed SMS notification sent to doctor", "appointmentID", event.AppointmentID, "doctorPhone", event.DoctorPhone)
	}
}

func (c *Consumer) Close() error {
	if c.channel != nil {
		c.channel.Close()
	}
	if c.conn != nil {
		c.conn.Close()
	}
	return nil
}
