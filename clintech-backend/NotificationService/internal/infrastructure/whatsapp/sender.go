package whatsapp

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"

	"NotificationService/internal/config"
)

// normalizePhoneNumber нормализует номер телефона в международный формат
// Поддерживает форматы: +77071234567, 87071234567, 87071234567, 7071234567
func normalizePhoneNumber(phone string) string {
	// Убираем все пробелы, дефисы и скобки
	phone = regexp.MustCompile(`[\s\-\(\)]`).ReplaceAllString(phone, "")

	// Если номер начинается с 8, заменяем на +7
	if strings.HasPrefix(phone, "8") {
		phone = "+7" + phone[1:]
	}

	// Если номер начинается с 8707, заменяем на +7707
	if strings.HasPrefix(phone, "8707") {
		phone = "+7" + phone[3:]
	}

	// Если номер начинается с 870, заменяем на +7
	if strings.HasPrefix(phone, "870") {
		phone = "+7" + phone[3:]
	}

	// Если номер не начинается с +, добавляем +7
	if !strings.HasPrefix(phone, "+") {
		phone = "+7" + phone
	}

	return phone
}

type Sender interface {
	Send(toNumber, message string) error
	SendWithTemplate(toNumber, templateName string, variables map[string]string) error
}

type WhatsAppSender struct {
	accountSID string
	authToken  string
	fromNumber string
	client     *http.Client
}

// TwilioResponse структура для парсинга ответа от Twilio API
type TwilioResponse struct {
	Sid          string `json:"sid"`
	AccountSid   string `json:"account_sid"`
	From         string `json:"from"`
	To           string `json:"to"`
	Body         string `json:"body"`
	Status       string `json:"status"`
	Direction    string `json:"direction"`
	DateCreated  string `json:"date_created"`
	DateSent     string `json:"date_sent"`
	ErrorCode    string `json:"error_code,omitempty"`
	ErrorMessage string `json:"error_message,omitempty"`
}

func NewWhatsAppSender(cfg *config.WhatsAppConfig) Sender {
	return &WhatsAppSender{
		accountSID: cfg.AccountSID,
		authToken:  cfg.AuthToken,
		fromNumber: cfg.FromNumber,
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

func (w *WhatsAppSender) Send(toNumber, message string) error {
	// Нормализуем номер телефона
	normalizedNumber := normalizePhoneNumber(toNumber)

	// Twilio API URL
	apiURL := fmt.Sprintf("https://api.twilio.com/2010-04-01/Accounts/%s/Messages.json", w.accountSID)

	// Форматируем номер получателя для WhatsApp
	if !strings.HasPrefix(normalizedNumber, "whatsapp:") {
		normalizedNumber = "whatsapp:" + normalizedNumber
	}

	// Подготавливаем данные для отправки
	data := url.Values{}
	data.Set("From", w.fromNumber)
	data.Set("To", normalizedNumber)
	data.Set("Body", message)

	// Создаем HTTP запрос
	req, err := http.NewRequest("POST", apiURL, strings.NewReader(data.Encode()))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	// Устанавливаем заголовки
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	// Basic Auth для Twilio
	auth := w.accountSID + ":" + w.authToken
	encodedAuth := base64.StdEncoding.EncodeToString([]byte(auth))
	req.Header.Set("Authorization", "Basic "+encodedAuth)

	// Отправляем запрос
	resp, err := w.client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send WhatsApp message: %w", err)
	}
	defer resp.Body.Close()

	// Читаем тело ответа
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read response body: %w", err)
	}

	// Проверяем статус ответа
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("twilio API returned status %d: %s", resp.StatusCode, string(body))
	}

	// Парсим ответ для получения дополнительной информации
	var twilioResp TwilioResponse
	if err := json.Unmarshal(body, &twilioResp); err != nil {
		// Логируем проблему с парсингом, но не считаем её критической
		return fmt.Errorf("failed to parse Twilio response (message may have been sent): %w, response: %s", err, string(body))
	}

	// Проверяем статус сообщения
	if twilioResp.Status == "failed" {
		errorMsg := twilioResp.ErrorMessage
		if errorMsg == "" {
			errorMsg = "unknown error"
		}
		return fmt.Errorf("message failed to send: %s (error code: %s)", errorMsg, twilioResp.ErrorCode)
	}

	// Если статус undelivered или другой проблемный статус
	if twilioResp.Status == "undelivered" {
		return fmt.Errorf("message was undelivered (error code: %s, error message: %s)", twilioResp.ErrorCode, twilioResp.ErrorMessage)
	}

	return nil
}

// SendWithTemplate отправляет сообщение с использованием шаблона
func (w *WhatsAppSender) SendWithTemplate(toNumber, templateName string, variables map[string]string) error {
	// Нормализуем номер телефона
	normalizedNumber := normalizePhoneNumber(toNumber)

	// Twilio API URL
	apiURL := fmt.Sprintf("https://api.twilio.com/2010-04-01/Accounts/%s/Messages.json", w.accountSID)

	// Форматируем номер получателя для WhatsApp
	if !strings.HasPrefix(normalizedNumber, "whatsapp:") {
		normalizedNumber = "whatsapp:" + normalizedNumber
	}

	// Подготавливаем данные для отправки
	data := url.Values{}
	data.Set("From", w.fromNumber)
	data.Set("To", normalizedNumber)
	data.Set("ContentSid", templateName) // Используем Content SID для шаблона

	// Добавляем переменные шаблона в JSON формате
	// Временно отключено для тестирования
	/*
		if len(variables) > 0 {
			variablesJSON, err := json.Marshal(variables)
			if err != nil {
				return fmt.Errorf("failed to marshal template variables: %w", err)
			}
			data.Set("ContentVariables", string(variablesJSON))
		}
	*/

	// Создаем HTTP запрос
	req, err := http.NewRequest("POST", apiURL, strings.NewReader(data.Encode()))
	if err != nil {
		return fmt.Errorf("failed to create template request: %w", err)
	}

	// Устанавливаем заголовки
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	// Basic Auth для Twilio
	auth := w.accountSID + ":" + w.authToken
	encodedAuth := base64.StdEncoding.EncodeToString([]byte(auth))
	req.Header.Set("Authorization", "Basic "+encodedAuth)

	// Отправляем запрос
	resp, err := w.client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send WhatsApp template message: %w", err)
	}
	defer resp.Body.Close()

	// Читаем тело ответа
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read template response body: %w", err)
	}

	// Проверяем статус ответа
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("twilio API returned status %d: %s", resp.StatusCode, string(body))
	}

	// Парсим ответ для диагностики
	var twilioResp TwilioResponse
	if err := json.Unmarshal(body, &twilioResp); err != nil {
		// Логируем проблему с парсингом, но не считаем её критической
		return fmt.Errorf("failed to parse Twilio template response (message may have been sent): %w, response: %s", err, string(body))
	}

	// Проверяем статус сообщения
	if twilioResp.Status == "failed" {
		errorMsg := twilioResp.ErrorMessage
		if errorMsg == "" {
			errorMsg = "unknown error"
		}
		return fmt.Errorf("template message failed to send: %s (error code: %s)", errorMsg, twilioResp.ErrorCode)
	}

	return nil
}
