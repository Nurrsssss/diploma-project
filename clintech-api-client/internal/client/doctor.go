package client

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

type DoctorService struct {
	baseURL    string
	httpClient *http.Client
}

type Doctor struct {
	ID           string   `json:"id"`
	UserID       string   `json:"user_id"`
	FirstName    string   `json:"first_name"`
	MiddleName   string   `json:"middle_name"`
	LastName     string   `json:"last_name"`
	Description  string   `json:"description"`
	Email        string   `json:"email"`
	Phone        string   `json:"phone"`
	AvatarURL    string   `json:"avatar_url"`
	Roles        []string `json:"roles"`
	Price        int      `json:"price"`
	Education    []string `json:"education"`
	Certificates []string `json:"certificates"`
}

type DoctorResponse struct {
	Success bool   `json:"success"`
	Data    Doctor `json:"data"`
	Error   string `json:"error,omitempty"`
}

func NewDoctorService(baseURL string) *DoctorService {
	return &DoctorService{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

func (s *DoctorService) GetDoctor(doctorID, token string) (*Doctor, error) {
	url := fmt.Sprintf("%s/users/%s/doctor", s.baseURL, doctorID)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		// Проверяем тип ошибки для более понятного сообщения
		if err.Error() == "fetch failed" || err.Error() == "context deadline exceeded" {
			return nil, fmt.Errorf("doctor service недоступен: таймаут соединения (30 сек). Проверьте доступность сервиса по адресу %s", s.baseURL)
		}
		return nil, fmt.Errorf("ошибка сети при обращении к doctor service: %w. URL: %s", err, url)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		switch resp.StatusCode {
		case 401:
			return nil, fmt.Errorf("Doctor service authentication failed (401): Invalid or expired token\nResponse: %s\nURL: %s\nSolution: Verify JWT token is valid and accepted by Doctor service", string(body), url)
		case 403:
			return nil, fmt.Errorf("Doctor service access forbidden (403): Insufficient permissions\nResponse: %s\nURL: %s\nDoctor ID: %s", string(body), url, doctorID)
		case 404:
			return nil, fmt.Errorf("Doctor profile not found (404): User may not have a doctor profile\nResponse: %s\nURL: %s\nDoctor ID: %s", string(body), url, doctorID)
		default:
			return nil, fmt.Errorf("Doctor service error (status %d): %s\nURL: %s", resp.StatusCode, string(body), url)
		}
	}

	var doctor Doctor
	if err := json.Unmarshal(body, &doctor); err == nil && doctor.ID != "" {
		return &doctor, nil
	}

	var doctorResp DoctorResponse
	if err := json.Unmarshal(body, &doctorResp); err == nil {
		if doctorResp.Success {
			return &doctorResp.Data, nil
		} else {
			errorMsg := doctorResp.Error
			if errorMsg == "" {
				errorMsg = "unknown error from doctor service"
			}
			return nil, fmt.Errorf("doctor service error: %s", errorMsg)
		}
	}

	return nil, fmt.Errorf("failed to unmarshal response (tried both formats): response body: %s", string(body))
}

func (s *DoctorService) ValidateDoctorRole(doctorID, token string) error {
	doctor, err := s.GetDoctor(doctorID, token)
	if err != nil {
		return fmt.Errorf("failed to get doctor: %w", err)
	}

	if len(doctor.Roles) == 0 {
		return fmt.Errorf("user %s is not a doctor (no roles assigned)", doctorID)
	}

	return nil
}
