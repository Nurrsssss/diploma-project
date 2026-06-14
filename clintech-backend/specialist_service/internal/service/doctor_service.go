package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"
	"github.com/printprince/vitalem/logger_service/pkg/logger"
	"github.com/printprince/vitalem/specialist_service/internal/models"
	"github.com/printprince/vitalem/specialist_service/internal/repository"
)

type DoctorService interface {
	CreateDoctor(ctx context.Context, req *models.DoctorCreateRequest) (*models.DoctorResponse, error)
	GetDoctorByID(ctx context.Context, id uuid.UUID) (*models.DoctorResponse, error)
	GetDoctorByUserID(ctx context.Context, userID uuid.UUID) (*models.DoctorResponse, error)
	GetAllDoctors(ctx context.Context) ([]*models.DoctorResponse, error)
	UpdateDoctor(ctx context.Context, id uuid.UUID, req *models.DoctorCreateRequest) (*models.DoctorResponse, error)
	UpdateDoctorProfile(ctx context.Context, userID uuid.UUID, req *models.DoctorCreateRequest) (*models.DoctorResponse, error)
	DeleteDoctor(ctx context.Context, id uuid.UUID) error

	// Новое для ресепшна
	CreateDoctorByReception(ctx context.Context, req *models.ReceptionDoctorUpsertRequest) (*models.ReceptionDoctorResponse, error)
	UpdateDoctorByReception(ctx context.Context, id uuid.UUID, req *models.ReceptionDoctorUpsertRequest) (*models.ReceptionDoctorResponse, error)
	GetDoctorManagementByID(ctx context.Context, id uuid.UUID) (*models.ReceptionDoctorResponse, error)
	DeleteDoctorByReception(ctx context.Context, id uuid.UUID) error
}

type doctorService struct {
	doctorRepo  repository.DoctorRepository
	logger      *logger.Client
	httpClient  *http.Client
	identityURL string
}
type identityUserUpsertRequest struct {
	Email    string `json:"email"`
	Phone    string `json:"phone"`
	Role     string `json:"role"`
	Password string `json:"password,omitempty"`
}

type identityUserResponse struct {
	ID    uuid.UUID `json:"id"`
	Email string    `json:"email"`
	Phone string    `json:"phone"`
	Role  string    `json:"role"`
}

const DefaultDoctorPassword = "Clintech1234"

func NewDoctorService(doctorRepo repository.DoctorRepository, logger *logger.Client) DoctorService {
	return &doctorService{
		doctorRepo: doctorRepo,
		logger:     logger,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
		identityURL: "http://identity_service:8801",
	}
}
func (s *doctorService) getUserByID(userID uuid.UUID) (*identityUserResponse, error) {
	url := fmt.Sprintf("%s/internal/users/%s", s.identityURL, userID.String())

	resp, err := s.httpClient.Get(url)
	if err != nil {
		return nil, fmt.Errorf("failed to get user by id: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("identity service returned status %d", resp.StatusCode)
	}

	var user identityUserResponse
	if err := json.NewDecoder(resp.Body).Decode(&user); err != nil {
		return nil, fmt.Errorf("failed to decode user: %w", err)
	}

	return &user, nil
}

func (s *doctorService) createIdentityDoctorUser(req *models.ReceptionDoctorUpsertRequest) (*identityUserResponse, error) {
	url := fmt.Sprintf("%s/internal/users/doctors", s.identityURL)

	payload := identityUserUpsertRequest{
		Email:    req.Email,
		Phone:    req.Phone,
		Role:     "doctor",
		Password: DefaultDoctorPassword,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal identity create request: %w", err)
	}

	resp, err := s.httpClient.Post(url, "application/json", bytes.NewBuffer(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create user in identity service: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		raw, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("identity create failed: status=%d body=%s", resp.StatusCode, string(raw))
	}

	var user identityUserResponse
	if err := json.NewDecoder(resp.Body).Decode(&user); err != nil {
		return nil, fmt.Errorf("failed to decode created identity user: %w", err)
	}

	return &user, nil
}

func (s *doctorService) updateIdentityDoctorUser(userID uuid.UUID, req *models.ReceptionDoctorUpsertRequest) (*identityUserResponse, error) {
	url := fmt.Sprintf("%s/internal/users/%s", s.identityURL, userID.String())

	payload := identityUserUpsertRequest{
		Email: req.Email,
		Phone: req.Phone,
		Role:  "doctor",
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal identity update request: %w", err)
	}

	httpReq, err := http.NewRequest(http.MethodPut, url, bytes.NewBuffer(body))
	if err != nil {
		return nil, fmt.Errorf("failed to build identity update request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := s.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to update user in identity service: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		raw, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("identity update failed: status=%d body=%s", resp.StatusCode, string(raw))
	}

	var user identityUserResponse
	if err := json.NewDecoder(resp.Body).Decode(&user); err != nil {
		return nil, fmt.Errorf("failed to decode updated identity user: %w", err)
	}

	return &user, nil
}

func (s *doctorService) deleteIdentityUser(userID uuid.UUID) error {
	url := fmt.Sprintf("%s/internal/users/%s", s.identityURL, userID.String())

	httpReq, err := http.NewRequest(http.MethodDelete, url, nil)
	if err != nil {
		return fmt.Errorf("failed to build identity delete request: %w", err)
	}

	resp, err := s.httpClient.Do(httpReq)
	if err != nil {
		return fmt.Errorf("failed to delete user in identity service: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusNoContent {
		raw, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("identity delete failed: status=%d body=%s", resp.StatusCode, string(raw))
	}

	return nil
}

// getUserPhone получает телефон пользователя из identity_service
func (s *doctorService) getUserPhone(userID uuid.UUID) (string, error) {
	url := fmt.Sprintf("%s/auth/user/%s", s.identityURL, userID.String())

	resp, err := s.httpClient.Get(url)
	if err != nil {
		return "", fmt.Errorf("failed to get user phone: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("identity service returned status %d", resp.StatusCode)
	}

	var userData struct {
		Phone string `json:"phone"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&userData); err != nil {
		return "", fmt.Errorf("failed to decode user data: %w", err)
	}

	return userData.Phone, nil
}

func (s *doctorService) CreateDoctor(ctx context.Context, req *models.DoctorCreateRequest) (*models.DoctorResponse, error) {
	doctor := req.ToDoctor()

	createdDoctor, err := s.doctorRepo.Create(ctx, doctor)
	if err != nil {
		s.logger.Error("Failed to create doctor", map[string]interface{}{
			"error": err.Error(),
		})
		return nil, err
	}

	return createdDoctor.ToDoctorResponse(), nil
}

func (s *doctorService) GetDoctorByID(ctx context.Context, id uuid.UUID) (*models.DoctorResponse, error) {
	doctor, err := s.doctorRepo.FindByID(ctx, id)
	if err != nil {
		s.logger.Error("Failed to get doctor by ID", map[string]interface{}{
			"error": err.Error(),
			"id":    id,
		})
		return nil, err
	}

	if doctor == nil {
		return nil, nil
	}

	// Получаем телефон из identity_service
	phone, err := s.getUserPhone(doctor.UserID)
	if err != nil {
		s.logger.Error("Failed to get user phone", map[string]interface{}{
			"userID": doctor.UserID,
			"error":  err.Error(),
		})
		// Не возвращаем ошибку, просто используем пустой телефон
		phone = ""
	}

	// Создаем ответ с телефоном
	response := doctor.ToDoctorResponse()
	response.Phone = phone

	return response, nil
}

func (s *doctorService) GetDoctorByUserID(ctx context.Context, userID uuid.UUID) (*models.DoctorResponse, error) {
	doctor, err := s.doctorRepo.FindByUserID(ctx, userID)
	if err != nil {
		s.logger.Error("Failed to get doctor by user ID", map[string]interface{}{
			"error":  err.Error(),
			"userID": userID,
		})
		return nil, err
	}

	if doctor == nil {
		return nil, nil
	}

	// Получаем телефон из identity_service
	phone, err := s.getUserPhone(doctor.UserID)
	if err != nil {
		s.logger.Error("Failed to get user phone", map[string]interface{}{
			"userID": doctor.UserID,
			"error":  err.Error(),
		})
		// Не возвращаем ошибку, просто используем пустой телефон
		phone = ""
	}

	// Создаем ответ с телефоном
	response := doctor.ToDoctorResponse()
	response.Phone = phone

	return response, nil
}

func (s *doctorService) GetAllDoctors(ctx context.Context) ([]*models.DoctorResponse, error) {
	doctors, err := s.doctorRepo.FindAll(ctx)
	if err != nil {
		s.logger.Error("Failed to get all doctors", map[string]interface{}{
			"error": err.Error(),
		})
		return nil, err
	}

	var response []*models.DoctorResponse
	for _, doctor := range doctors {
		response = append(response, doctor.ToDoctorResponse())
	}

	return response, nil
}

func (s *doctorService) UpdateDoctor(ctx context.Context, id uuid.UUID, req *models.DoctorCreateRequest) (*models.DoctorResponse, error) {
	doctor, err := s.doctorRepo.FindByID(ctx, id)
	if err != nil {
		s.logger.Error("Failed to find doctor for update", map[string]interface{}{
			"error": err.Error(),
			"id":    id,
		})
		return nil, err
	}

	if doctor == nil {
		return nil, nil
	}

	// Обновляем поля
	doctor.FirstName = req.FirstName
	doctor.MiddleName = req.MiddleName
	doctor.LastName = req.LastName
	doctor.Description = req.Description
	if req.Email == "" {
		doctor.Email = nil
	} else {
		email := req.Email
		doctor.Email = &email
	}
	doctor.AvatarURL = req.AvatarURL
	doctor.Roles = req.Roles
	doctor.Price = req.Price
	doctor.Education = req.Education
	doctor.Certificates = req.Certificates

	updatedDoctor, err := s.doctorRepo.Update(ctx, doctor)
	if err != nil {
		s.logger.Error("Failed to update doctor", map[string]interface{}{
			"error": err.Error(),
			"id":    id,
		})
		return nil, err
	}

	return updatedDoctor.ToDoctorResponse(), nil
}

// UpdateDoctorProfile обновляет профиль врача по ID пользователя
func (s *doctorService) UpdateDoctorProfile(ctx context.Context, userID uuid.UUID, req *models.DoctorCreateRequest) (*models.DoctorResponse, error) {
	doctor, err := s.doctorRepo.FindByUserID(ctx, userID)
	if err != nil {
		s.logger.Error("Failed to find doctor by user ID for profile update", map[string]interface{}{
			"error":  err.Error(),
			"userID": userID,
		})
		return nil, err
	}

	if doctor == nil {
		// Если профиль не найден, но у нас есть данные для создания, создаем новый
		s.logger.Info("Creating new doctor profile for user", map[string]interface{}{
			"userID": userID,
		})

		newDoctor := req.ToDoctor()
		newDoctor.UserID = userID // Устанавливаем ID пользователя

		createdDoctor, err := s.doctorRepo.Create(ctx, newDoctor)
		if err != nil {
			s.logger.Error("Failed to create doctor profile", map[string]interface{}{
				"error":  err.Error(),
				"userID": userID,
			})
			return nil, err
		}

		return createdDoctor.ToDoctorResponse(), nil
	}

	// Обновляем поля существующего профиля
	doctor.FirstName = req.FirstName
	doctor.MiddleName = req.MiddleName
	doctor.LastName = req.LastName
	doctor.Description = req.Description
	// Normalize email: empty string -> nil
	if req.Email == "" {
		doctor.Email = nil
	} else {
		email := req.Email
		doctor.Email = &email
	}
	doctor.AvatarURL = req.AvatarURL
	doctor.Roles = req.Roles
	doctor.Price = req.Price
	doctor.Education = req.Education
	doctor.Certificates = req.Certificates

	updatedDoctor, err := s.doctorRepo.Update(ctx, doctor)
	if err != nil {
		s.logger.Error("Failed to update doctor profile", map[string]interface{}{
			"error":  err.Error(),
			"userID": userID,
		})
		return nil, err
	}

	s.logger.Info("Doctor profile updated successfully", map[string]interface{}{
		"userID":   userID,
		"doctorID": doctor.ID,
	})

	return updatedDoctor.ToDoctorResponse(), nil
}

func (s *doctorService) DeleteDoctor(ctx context.Context, id uuid.UUID) error {
	err := s.doctorRepo.Delete(ctx, id)
	if err != nil {
		s.logger.Error("Failed to delete doctor", map[string]interface{}{
			"error": err.Error(),
			"id":    id,
		})
		return err
	}
	return nil
}
func (s *doctorService) CreateDoctorByReception(ctx context.Context, req *models.ReceptionDoctorUpsertRequest) (*models.ReceptionDoctorResponse, error) {
	createdUser, err := s.createIdentityDoctorUser(req)
	if err != nil {
		s.logger.Error("Failed to create doctor user in identity", map[string]interface{}{
			"error": err.Error(),
			"phone": req.Phone,
			"email": req.Email,
		})
		return nil, err
	}

	doctor := &models.Doctor{
		UserID:       createdUser.ID,
		FirstName:    req.FirstName,
		MiddleName:   req.MiddleName,
		LastName:     req.LastName,
		Description:  req.Description,
		AvatarURL:    req.AvatarURL,
		Roles:        pq.StringArray(req.Roles),
		Price:        req.Price,
		Education:    pq.StringArray(req.Education),
		Certificates: pq.StringArray(req.Certificates),
	}

	if req.Email == "" {
		doctor.Email = nil
	} else {
		email := req.Email
		doctor.Email = &email
	}

	createdDoctor, err := s.doctorRepo.Create(ctx, doctor)
	if err != nil {
		_ = s.deleteIdentityUser(createdUser.ID)
		s.logger.Error("Failed to create doctor profile after identity user creation", map[string]interface{}{
			"error":  err.Error(),
			"userID": createdUser.ID,
		})
		return nil, err
	}

	email := createdUser.Email
	if createdDoctor.Email != nil && *createdDoctor.Email != "" {
		email = *createdDoctor.Email
	}

	return &models.ReceptionDoctorResponse{
		ID:           createdDoctor.ID,
		UserID:       createdDoctor.UserID,
		FirstName:    createdDoctor.FirstName,
		MiddleName:   createdDoctor.MiddleName,
		LastName:     createdDoctor.LastName,
		Phone:        createdUser.Phone,
		Email:        email,
		Description:  createdDoctor.Description,
		AvatarURL:    createdDoctor.AvatarURL,
		Roles:        []string(createdDoctor.Roles),
		Price:        createdDoctor.Price,
		Education:    []string(createdDoctor.Education),
		Certificates: []string(createdDoctor.Certificates),
	}, nil
}

func (s *doctorService) GetDoctorManagementByID(ctx context.Context, id uuid.UUID) (*models.ReceptionDoctorResponse, error) {
	doctor, err := s.doctorRepo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if doctor == nil {
		return nil, nil
	}

	user, err := s.getUserByID(doctor.UserID)
	if err != nil {
		return nil, err
	}

	email := user.Email
	if doctor.Email != nil && *doctor.Email != "" {
		email = *doctor.Email
	}

	return &models.ReceptionDoctorResponse{
		ID:           doctor.ID,
		UserID:       doctor.UserID,
		FirstName:    doctor.FirstName,
		MiddleName:   doctor.MiddleName,
		LastName:     doctor.LastName,
		Phone:        user.Phone,
		Email:        email,
		Description:  doctor.Description,
		AvatarURL:    doctor.AvatarURL,
		Roles:        []string(doctor.Roles),
		Price:        doctor.Price,
		Education:    []string(doctor.Education),
		Certificates: []string(doctor.Certificates),
	}, nil
}

func (s *doctorService) UpdateDoctorByReception(ctx context.Context, id uuid.UUID, req *models.ReceptionDoctorUpsertRequest) (*models.ReceptionDoctorResponse, error) {
	doctor, err := s.doctorRepo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if doctor == nil {
		return nil, nil
	}

	updatedUser, err := s.updateIdentityDoctorUser(doctor.UserID, req)
	if err != nil {
		return nil, err
	}

	doctor.FirstName = req.FirstName
	doctor.MiddleName = req.MiddleName
	doctor.LastName = req.LastName
	doctor.Description = req.Description
	doctor.AvatarURL = req.AvatarURL
	doctor.Roles = pq.StringArray(req.Roles)
	doctor.Price = req.Price
	doctor.Education = pq.StringArray(req.Education)
	doctor.Certificates = pq.StringArray(req.Certificates)

	if req.Email == "" {
		doctor.Email = nil
	} else {
		email := req.Email
		doctor.Email = &email
	}

	updatedDoctor, err := s.doctorRepo.Update(ctx, doctor)
	if err != nil {
		return nil, err
	}

	email := updatedUser.Email
	if updatedDoctor.Email != nil && *updatedDoctor.Email != "" {
		email = *updatedDoctor.Email
	}

	return &models.ReceptionDoctorResponse{
		ID:           updatedDoctor.ID,
		UserID:       updatedDoctor.UserID,
		FirstName:    updatedDoctor.FirstName,
		MiddleName:   updatedDoctor.MiddleName,
		LastName:     updatedDoctor.LastName,
		Phone:        updatedUser.Phone,
		Email:        email,
		Description:  updatedDoctor.Description,
		AvatarURL:    updatedDoctor.AvatarURL,
		Roles:        []string(updatedDoctor.Roles),
		Price:        updatedDoctor.Price,
		Education:    []string(updatedDoctor.Education),
		Certificates: []string(updatedDoctor.Certificates),
	}, nil
}

func (s *doctorService) DeleteDoctorByReception(ctx context.Context, id uuid.UUID) error {
	doctor, err := s.doctorRepo.FindByID(ctx, id)
	if err != nil {
		return err
	}
	if doctor == nil {
		return nil
	}

	if err := s.doctorRepo.Delete(ctx, id); err != nil {
		return err
	}

	if err := s.deleteIdentityUser(doctor.UserID); err != nil {
		return err
	}

	return nil
}
