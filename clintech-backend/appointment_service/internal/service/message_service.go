package service

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/printprince/vitalem/appointment_service/internal/models"
	amqp "github.com/rabbitmq/amqp091-go"
)

// MessageService интерфейс для отправки сообщений
type MessageService interface {
	PublishAppointmentBooked(ctx context.Context, event *models.AppointmentBookedEvent) error
	PublishAppointmentCanceled(ctx context.Context, event *models.AppointmentCanceledEvent) error
	PublishAppointmentRescheduled(ctx context.Context, event *models.AppointmentRescheduledEvent) error
	PublishAppointmentCompleted(ctx context.Context, event *models.AppointmentCompletedEvent) error
	Close() error
}

type messageService struct {
	conn       *amqp.Connection
	channel    *amqp.Channel
	exchange   string
	routingKey string
}

// NewMessageService создает новый сервис сообщений
func NewMessageService(rabbitmqURL, exchange, routingKey string) (MessageService, error) {
	conn, err := amqp.Dial(rabbitmqURL)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to RabbitMQ: %w", err)
	}

	channel, err := conn.Channel()
	if err != nil {
		conn.Close()
		return nil, fmt.Errorf("failed to open channel: %w", err)
	}

	// Объявляем exchange для уведомлений
	err = channel.ExchangeDeclare(
		exchange, // name
		"topic",  // type
		true,     // durable
		false,    // auto-deleted
		false,    // internal
		false,    // no-wait
		nil,      // arguments
	)
	if err != nil {
		channel.Close()
		conn.Close()
		return nil, fmt.Errorf("failed to declare exchange: %w", err)
	}

	return &messageService{
		conn:       conn,
		channel:    channel,
		exchange:   exchange,
		routingKey: routingKey,
	}, nil
}

// PublishAppointmentBooked отправляет событие о бронировании записи
func (s *messageService) PublishAppointmentBooked(ctx context.Context, event *models.AppointmentBookedEvent) error {
	body, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("failed to marshal appointment booked event: %w", err)
	}

	err = s.channel.Publish(
		s.exchange,   // exchange
		s.routingKey, // routing key
		false,        // mandatory
		false,        // immediate
		amqp.Publishing{
			ContentType:  "application/json",
			Body:         body,
			DeliveryMode: amqp.Persistent,
		})
	if err != nil {
		return fmt.Errorf("failed to publish appointment booked event: %w", err)
	}

	return nil
}

// PublishAppointmentCanceled отправляет событие о отмене записи
func (s *messageService) PublishAppointmentCanceled(ctx context.Context, event *models.AppointmentCanceledEvent) error {
	body, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("failed to marshal appointment canceled event: %w", err)
	}

	err = s.channel.Publish(
		s.exchange,   // exchange
		s.routingKey, // routing key
		false,        // mandatory
		false,        // immediate
		amqp.Publishing{
			ContentType:  "application/json",
			Body:         body,
			DeliveryMode: amqp.Persistent,
		})
	if err != nil {
		return fmt.Errorf("failed to publish appointment canceled event: %w", err)
	}

	return nil
}

// PublishAppointmentRescheduled отправляет событие о переносе записи
func (s *messageService) PublishAppointmentRescheduled(ctx context.Context, event *models.AppointmentRescheduledEvent) error {
	body, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("failed to marshal appointment rescheduled event: %w", err)
	}

	err = s.channel.Publish(
		s.exchange,   // exchange
		s.routingKey, // routing key
		false,        // mandatory
		false,        // immediate
		amqp.Publishing{
			ContentType:  "application/json",
			Body:         body,
			DeliveryMode: amqp.Persistent,
		})
	if err != nil {
		return fmt.Errorf("failed to publish appointment rescheduled event: %w", err)
	}

	return nil
}

// PublishAppointmentCompleted отправляет событие о завершении записи
func (s *messageService) PublishAppointmentCompleted(ctx context.Context, event *models.AppointmentCompletedEvent) error {
	body, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("failed to marshal appointment completed event: %w", err)
	}

	err = s.channel.Publish(
		s.exchange,   // exchange
		s.routingKey, // routing key
		false,        // mandatory
		false,        // immediate
		amqp.Publishing{
			ContentType:  "application/json",
			Body:         body,
			DeliveryMode: amqp.Persistent,
		})
	if err != nil {
		return fmt.Errorf("failed to publish appointment completed event: %w", err)
	}

	return nil
}

// Close закрывает соединение с RabbitMQ
func (s *messageService) Close() error {
	if s.channel != nil {
		s.channel.Close()
	}
	if s.conn != nil {
		s.conn.Close()
	}
	return nil
}
