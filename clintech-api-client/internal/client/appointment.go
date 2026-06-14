package client

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

type AppointmentClient struct {
	baseURL    string
	httpClient *http.Client
}

type Appointment struct {
	ID              string    `json:"id"`
	StartTime       time.Time `json:"start_time"`
	EndTime         time.Time `json:"end_time"`
	DoctorID        string    `json:"doctor_id"`
	PatientID       string    `json:"patient_id"`
	Title           string    `json:"title"`
	Status          string    `json:"status"`
	AppointmentType string    `json:"appointment_type"`
	PatientNotes    string    `json:"patient_notes"`
	DoctorNotes     string    `json:"doctor_notes"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

type AppointmentFile struct {
	ID            string    `json:"id"`
	AppointmentID string    `json:"appointment_id"`
	FileID        string    `json:"file_id"`
	FileType      string    `json:"file_type"`
	UploadedBy    string    `json:"uploaded_by"`
	CreatedAt     time.Time `json:"created_at"`
	FileName      string    `json:"file_name"`
	OriginalName  string    `json:"original_name"`
	MimeType      string    `json:"mime_type"`
	Size          int64     `json:"size"`
}

type AppointmentFilesResponse struct {
	Success bool              `json:"success"`
	Data    []AppointmentFile `json:"data"`
	Error   string            `json:"error,omitempty"`
}

type AppointmentResponse struct {
	Success bool        `json:"success"`
	Data    Appointment `json:"data"`
	Error   string      `json:"error,omitempty"`
}

type AppointmentUpdateRequest struct {
	HealthPassportID string `json:"health_passport_id"`
	Status           string `json:"status"`
}

type AppointmentUpdateResponse struct {
	Success bool   `json:"success"`
	Error   string `json:"error,omitempty"`
}

func NewAppointmentClient(baseURL string) *AppointmentClient {
	return &AppointmentClient{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

func (s *AppointmentClient) GetAppointment(appointmentID, token string) (*Appointment, error) {
	url := fmt.Sprintf("%s/appointments/%s", s.baseURL, appointmentID)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request to appointment service: %w", err)
	}

	req.Header.Set("Authorization", token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		// Проверяем тип ошибки для более понятного сообщения
		if err.Error() == "fetch failed" || err.Error() == "context deadline exceeded" {
			return nil, fmt.Errorf("appointment service недоступен: таймаут соединения (30 сек). Проверьте доступность сервиса по адресу %s", s.baseURL)
		}
		return nil, fmt.Errorf("ошибка сети при обращении к appointment service: %w. URL: %s", err, url)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response from appointment service: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		switch resp.StatusCode {
		case 401:
			return nil, fmt.Errorf("appointment service: ошибка аутентификации (401). Проверьте токен доступа. URL: %s", url)
		case 404:
			return nil, fmt.Errorf("appointment не найден (404). Appointment ID: %s. URL: %s", appointmentID, url)
		default:
			return nil, fmt.Errorf("appointment service вернул ошибку (status %d): %s. URL: %s", resp.StatusCode, string(body), url)
		}
	}

	var appointmentResp AppointmentResponse
	if err := json.Unmarshal(body, &appointmentResp); err != nil {
		return nil, fmt.Errorf("failed to unmarshal appointment response: %w. Response body: %s", err, string(body))
	}

	if !appointmentResp.Success {
		return nil, fmt.Errorf("appointment service error: %s", appointmentResp.Error)
	}

	return &appointmentResp.Data, nil
}

func (s *AppointmentClient) GetAppointmentFiles(appointmentID, token string) ([]AppointmentFile, error) {
	url := fmt.Sprintf("%s/appointments/%s/files", s.baseURL, appointmentID)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to make request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("appointment service returned status %d: %s", resp.StatusCode, string(body))
	}

	var filesResp AppointmentFilesResponse
	if err := json.Unmarshal(body, &filesResp); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	if !filesResp.Success {
		return nil, fmt.Errorf("appointment service error: %s", filesResp.Error)
	}

	return filesResp.Data, nil
}

func (s *AppointmentClient) DownloadAppointmentFile(appointmentID, fileID, token string) ([]byte, error) {
	url := fmt.Sprintf("%s/appointments/%s/files/%s/download", s.baseURL, appointmentID, fileID)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to make request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("appointment service returned status %d: %s", resp.StatusCode, string(body))
	}

	fileData, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read file data: %w", err)
	}

	return fileData, nil
}

func (s *AppointmentClient) ValidateAppointment(appointmentID, doctorID, token string) error {
	appointment, err := s.GetAppointment(appointmentID, token)
	if err != nil {
		return fmt.Errorf("failed to get appointment: %w", err)
	}

	if appointment.DoctorID != doctorID {
		return fmt.Errorf("appointment %s does not belong to doctor %s", appointmentID, doctorID)
	}

	return nil
}

func (s *AppointmentClient) UpdateAppointmentHealthPassport(appointmentID, healthPassportID, token string) error {
	url := fmt.Sprintf("%s/appointments/%s", s.baseURL, appointmentID)

	updateReq := AppointmentUpdateRequest{
		HealthPassportID: healthPassportID,
		Status:           "completed",
	}

	jsonData, err := json.Marshal(updateReq)
	if err != nil {
		return fmt.Errorf("failed to marshal update request: %w", err)
	}

	req, err := http.NewRequest("PUT", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to make request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read response body: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("appointment service returned status %d: %s", resp.StatusCode, string(body))
	}

	var updateResp AppointmentUpdateResponse
	if err := json.Unmarshal(body, &updateResp); err != nil {
		return fmt.Errorf("failed to unmarshal response: %w", err)
	}

	if !updateResp.Success {
		return fmt.Errorf("appointment service error: %s", updateResp.Error)
	}

	return nil
}
