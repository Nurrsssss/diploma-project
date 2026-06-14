package client

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"
)

// ErrPatientProfileNotFound — в patient/gateway нет карточки пациента для user_id (часто 404 на /users/{id}/patient).
var ErrPatientProfileNotFound = errors.New("patient profile not found")

type PatientClient struct {
	BaseURL    string
	httpClient *http.Client
}

type PatientProfile struct {
	ID           string   `json:"id"`
	UserID       string   `json:"user_id"`
	FirstName    string   `json:"first_name"`
	MiddleName   string   `json:"middle_name"`
	LastName     string   `json:"last_name"`
	Email        string   `json:"email"`
	Phone        string   `json:"phone"`
	Address      string   `json:"address"`
	AvatarURL    string   `json:"avatar_url"`
	IIN          string   `json:"iin"`
	DateOfBirth  string   `json:"date_of_birth"`
	Gender       string   `json:"gender"`
	Height       int      `json:"height"`
	Weight       int      `json:"weight"`
	PhysActivity string   `json:"phys_activity"`
	Diagnoses    []string `json:"diagnoses"`
	Allergens    []string `json:"allergens"`
	Diet         []string `json:"diet"`
	CreatedAt    string   `json:"created_at"`
	UpdatedAt    string   `json:"updated_at"`
}

func NewPatientClient(baseURL string) *PatientClient {
	return &PatientClient{
		BaseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// GetPatientProfile возвращает профиль пациента по userID (users.id).
// Если по userID профиль не найден, дополнительно пробует найти по patients.id —
// некоторые приёмы (appointments.patient_id) хранят именно ID профиля пациента, а не ID пользователя.
func (c *PatientClient) GetPatientProfile(userID, token string) (*PatientProfile, error) {
	profile, err := c.fetchPatientProfile(fmt.Sprintf("%s/users/%s/patient", c.BaseURL, userID), token)
	if err != nil && errors.Is(err, ErrPatientProfileNotFound) {
		return c.fetchPatientProfile(fmt.Sprintf("%s/patients/%s", c.BaseURL, userID), token)
	}
	return profile, err
}

func (c *PatientClient) fetchPatientProfile(url, token string) (*PatientProfile, error) {
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request to patient service: %w", err)
	}

	req.Header.Set("Authorization", token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		// Проверяем тип ошибки для более понятного сообщения
		if err.Error() == "fetch failed" || err.Error() == "context deadline exceeded" {
			return nil, fmt.Errorf("patient service недоступен: таймаут соединения (30 сек). Проверьте доступность сервиса по адресу %s", c.BaseURL)
		}
		return nil, fmt.Errorf("ошибка сети при обращении к patient service: %w. URL: %s", err, url)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response from patient service: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		switch resp.StatusCode {
		case 401:
			return nil, fmt.Errorf("patient service: ошибка аутентификации (401). Проверьте токен доступа. URL: %s", url)
		case 404:
			return nil, fmt.Errorf("%w: url=%s", ErrPatientProfileNotFound, url)
		default:
			return nil, fmt.Errorf("patient service вернул ошибку (status %d): %s. URL: %s", resp.StatusCode, string(body), url)
		}
	}

	var profile PatientProfile
	if err := json.Unmarshal(body, &profile); err != nil {
		return nil, fmt.Errorf("failed to decode patient profile response: %w. Response body: %s", err, string(body))
	}

	return &profile, nil
}
