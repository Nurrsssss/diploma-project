package sms

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"
)

// Sender интерфейс для отправки SMS
type Sender interface {
	Send(toNumber, message string) error
}

// SMSCSender реализация для SMSC.kz REST API
type SMSCSender struct {
	login    string
	password string
	apiURL   string
	sender   string
	client   *http.Client
	// Кэш для нормализации номеров
	phoneCache map[string]string
	cacheMutex sync.RWMutex
}

// SMSCRequest структура запроса к SMSC.kz REST API
type SMSCRequest struct {
	Login  string `json:"login"`
	Psw    string `json:"psw"`
	Phones string `json:"phones"`
	Mes    string `json:"mes"`
	Sender string `json:"sender,omitempty"`
	Fmt    int    `json:"fmt"`
}

// SMSCResponse структура ответа от SMSC.kz REST API
type SMSCResponse struct {
	ID      interface{} `json:"id,omitempty"` // Может быть string или int
	Count   int         `json:"cnt,omitempty"`
	Cost    string      `json:"cost,omitempty"`
	Balance string      `json:"balance,omitempty"`
	Error   string      `json:"error,omitempty"`
	Code    int         `json:"error_code,omitempty"`
}

// SMSCErrorCodes коды ошибок SMSC.kz
var SMSCErrorCodes = map[int]string{
	1:  "Ошибка в параметрах",
	2:  "Неверный логин или пароль",
	3:  "Недостаточно средств",
	4:  "IP адрес заблокирован",
	5:  "Неверный формат номера",
	6:  "Сообщение запрещено",
	7:  "На канале превышены лимиты",
	8:  "Неверный формат времени",
	9:  "Неподдерживаемый тип сообщения",
	10: "Номер заблокирован",
}

// NewSMSCSender создает новый SMS отправитель для SMSC.kz
func NewSMSCSender(login, password, apiURL, sender string) *SMSCSender {
	// Создаем оптимизированный HTTP клиент
	transport := &http.Transport{
		MaxIdleConns:        10,
		MaxIdleConnsPerHost: 10,
		IdleConnTimeout:     30 * time.Second,
		DisableCompression:  true, // Ускоряем для коротких запросов
	}

	client := &http.Client{
		Transport: transport,
		Timeout:   10 * time.Second, // Уменьшаем timeout с 30 до 10 секунд
	}

	return &SMSCSender{
		login:      login,
		password:   password,
		apiURL:     apiURL,
		sender:     sender,
		client:     client,
		phoneCache: make(map[string]string),
		cacheMutex: sync.RWMutex{},
	}
}

// Send отправляет SMS через SMSC.kz REST API
func (s *SMSCSender) Send(toNumber, message string) error {
	// Нормализуем номер телефона
	normalizedNumber := s.normalizePhoneNumber(toNumber)

	// Форматируем сообщение
	formattedMessage := formatSMSMessage(message)

	// Подготавливаем JSON запрос
	request := SMSCRequest{
		Login:  s.login,
		Psw:    s.password,
		Phones: normalizedNumber,
		Mes:    formattedMessage,
		Fmt:    3, // JSON формат ответа
	}

	// Добавляем отправителя если указан
	if s.sender != "" {
		request.Sender = s.sender
	}

	// Сериализуем в JSON
	jsonData, err := json.Marshal(request)
	if err != nil {
		return fmt.Errorf("failed to marshal SMS request: %w", err)
	}

	// Создаем запрос с оптимизированными заголовками
	req, err := http.NewRequest("POST", s.apiURL, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create SMS request: %w", err)
	}

	// Устанавливаем заголовки для быстрой обработки
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Connection", "keep-alive")
	req.Header.Set("Accept", "application/json")

	// Отправляем запрос
	resp, err := s.client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send SMS request: %w", err)
	}
	defer resp.Body.Close()

	// Быстро читаем ответ (ограничиваем размер)
	body, err := io.ReadAll(io.LimitReader(resp.Body, 1024)) // Максимум 1KB
	if err != nil {
		return fmt.Errorf("failed to read SMS response: %w", err)
	}

	// Проверяем HTTP статус
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("SMSC API returned status %d: %s", resp.StatusCode, string(body))
	}

	// Парсим JSON ответ
	var smscResp SMSCResponse
	if err := json.Unmarshal(body, &smscResp); err != nil {
		return fmt.Errorf("failed to parse SMS response: %w", err)
	}

	// Проверяем на ошибки
	if smscResp.Error != "" || smscResp.Code != 0 {
		errorMsg := getSMSCErrorMessage(smscResp.Code)
		if errorMsg == "" {
			errorMsg = smscResp.Error
		}
		return fmt.Errorf("SMS error: %s (code: %d)", errorMsg, smscResp.Code)
	}

	// Проверяем что SMS отправлена
	if smscResp.Count == 0 && smscResp.ID == nil {
		return fmt.Errorf("SMS not sent: no messages processed")
	}

	return nil
}

// getSMSCErrorMessage возвращает человекочитаемое сообщение об ошибке
func getSMSCErrorMessage(code int) string {
	if msg, exists := SMSCErrorCodes[code]; exists {
		return msg
	}
	return "Неизвестная ошибка"
}

// formatSMSMessage форматирует SMS сообщение
func formatSMSMessage(message string) string {
	// Отправляем сообщение как есть, без обрезки
	return message
}

// normalizePhoneNumber нормализует номер телефона для SMSC.kz
func (s *SMSCSender) normalizePhoneNumber(phone string) string {
	s.cacheMutex.RLock()
	normalized, found := s.phoneCache[phone]
	s.cacheMutex.RUnlock()

	if found {
		return normalized
	}

	// Убираем все символы кроме цифр
	cleaned := ""
	for _, r := range phone {
		if r >= '0' && r <= '9' {
			cleaned += string(r)
		}
	}

	// Если номер начинается с 8, заменяем на 7 (для СНГ)
	if strings.HasPrefix(cleaned, "8") && len(cleaned) == 11 {
		cleaned = "7" + cleaned[1:]
	}

	// Если номер начинается с 7 и длина 11 - это правильный формат
	if strings.HasPrefix(cleaned, "7") && len(cleaned) == 11 {
		s.cacheMutex.Lock()
		s.phoneCache[phone] = cleaned
		s.cacheMutex.Unlock()
		return cleaned
	}

	// Если номер 10 цифр, добавляем 7 в начало (казахстанский номер)
	if len(cleaned) == 10 && (strings.HasPrefix(cleaned, "70") || strings.HasPrefix(cleaned, "71") || strings.HasPrefix(cleaned, "72") || strings.HasPrefix(cleaned, "73") || strings.HasPrefix(cleaned, "74") || strings.HasPrefix(cleaned, "75") || strings.HasPrefix(cleaned, "76") || strings.HasPrefix(cleaned, "77") || strings.HasPrefix(cleaned, "78")) {
		s.cacheMutex.Lock()
		s.phoneCache[phone] = "7" + cleaned
		s.cacheMutex.Unlock()
		return "7" + cleaned
	}

	// Возвращаем как есть для других международных номеров
	s.cacheMutex.Lock()
	s.phoneCache[phone] = cleaned
	s.cacheMutex.Unlock()
	return cleaned
}
