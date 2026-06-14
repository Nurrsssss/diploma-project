package service

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"time"

	"encoding/json"

	"github.com/google/uuid"
	"github.com/printprince/vitalem/logger_service/pkg/logger"
	"github.com/printprince/vitalem/patient_service/internal/models"
	"github.com/printprince/vitalem/patient_service/internal/repository"
)

type PatientService interface {
	CreatePatient(ctx context.Context, req *models.PatientCreateRequest) (*models.PatientResponse, error)
	GetPatientByID(ctx context.Context, id uuid.UUID) (*models.PatientResponse, error)
	GetPatientByUserID(ctx context.Context, userID uuid.UUID) (*models.PatientResponse, error)
	GetAllPatients(ctx context.Context) ([]*models.PatientResponse, error)
	UpdatePatient(ctx context.Context, id uuid.UUID, req *models.PatientCreateRequest) (*models.PatientResponse, error)
	UpdatePatientProfile(ctx context.Context, userID uuid.UUID, req *models.PatientCreateRequest) (*models.PatientResponse, error)
	DeletePatient(ctx context.Context, id uuid.UUID) error
	GetPatientByIIN(ctx context.Context, iin string) (*models.PatientResponse, error)
}

type patientService struct {
	patientRepo repository.PatientRepository
	logger      *logger.Client
	httpClient  *http.Client
	identityURL string
}

func NewPatientService(patientRepo repository.PatientRepository, logger *logger.Client) PatientService {
	return &patientService{
		patientRepo: patientRepo,
		logger:      logger,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
		identityURL: "http://identity_service:8801",
	}
}

// getUserPhone получает телефон пользователя из identity_service
func (s *patientService) getUserPhone(userID uuid.UUID) (string, error) {
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

func (s *patientService) CreatePatient(ctx context.Context, req *models.PatientCreateRequest) (*models.PatientResponse, error) {
	patient := req.ToPatient()

	createdPatient, err := s.patientRepo.Create(ctx, patient)
	if err != nil {
		s.logger.Error("Failed to create patient", map[string]interface{}{
			"error": err.Error(),
		})
		return nil, err
	}

	return createdPatient.ToPatientResponse(), nil
}

func (s *patientService) GetPatientByID(ctx context.Context, id uuid.UUID) (*models.PatientResponse, error) {
	patient, err := s.patientRepo.FindByID(ctx, id)
	if err != nil {
		s.logger.Error("Failed to get patient by ID", map[string]interface{}{
			"error": err.Error(),
			"id":    id,
		})
		return nil, err
	}

	if patient == nil {
		return nil, nil
	}

	// Получаем телефон из identity_service
	phone, err := s.getUserPhone(patient.UserID)
	if err != nil {
		s.logger.Error("Failed to get user phone", map[string]interface{}{
			"userID": patient.UserID,
			"error":  err.Error(),
		})
		// Не возвращаем ошибку, просто используем пустой телефон
		phone = ""
	}

	// Создаем ответ с телефоном
	response := patient.ToPatientResponse()
	response.Phone = phone

	return response, nil
}

func (s *patientService) GetPatientByUserID(ctx context.Context, userID uuid.UUID) (*models.PatientResponse, error) {
	patient, err := s.patientRepo.FindByUserID(ctx, userID)
	if err != nil {
		s.logger.Error("Failed to get patient by user ID", map[string]interface{}{
			"error":  err.Error(),
			"userID": userID,
		})
		return nil, err
	}

	if patient == nil {
		return nil, nil
	}

	// Получаем телефон из identity_service
	phone, err := s.getUserPhone(patient.UserID)
	if err != nil {
		s.logger.Error("Failed to get user phone", map[string]interface{}{
			"userID": patient.UserID,
			"error":  err.Error(),
		})
		// Не возвращаем ошибку, просто используем пустой телефон
		phone = ""
	}

	// Создаем ответ с телефоном
	response := patient.ToPatientResponse()
	response.Phone = phone

	return response, nil
}

func (s *patientService) GetAllPatients(ctx context.Context) ([]*models.PatientResponse, error) {
	patients, err := s.patientRepo.FindAll(ctx)
	if err != nil {
		s.logger.Error("Failed to get all patients", map[string]interface{}{
			"error": err.Error(),
		})
		return nil, err
	}

	var response []*models.PatientResponse
	for _, patient := range patients {
		// Получаем телефон из identity_service
		phone, err := s.getUserPhone(patient.UserID)
		if err != nil {
			s.logger.Error("Failed to get user phone", map[string]interface{}{
				"userID": patient.UserID,
				"error":  err.Error(),
			})
			// Не возвращаем ошибку, просто используем пустой телефон
			phone = ""
		}

		// Создаем ответ с телефоном
		patientResponse := patient.ToPatientResponse()
		patientResponse.Phone = phone
		response = append(response, patientResponse)
	}

	return response, nil
}

// UpdatePatient - метод для обновления данных существующего пациента
// Обновляет все поля по ID пациента (не частичное обновление)
// Если пациент не найден - возвращает nil без ошибки
// Подходит для полного обновления профиля через админку
func (s *patientService) UpdatePatient(ctx context.Context, id uuid.UUID, req *models.PatientCreateRequest) (*models.PatientResponse, error) {
	patient, err := s.patientRepo.FindByID(ctx, id)
	if err != nil {
		s.logger.Error("Failed to find patient for update", map[string]interface{}{
			"error": err.Error(),
			"id":    id,
		})
		return nil, err
	}

	if patient == nil {
		return nil, nil
	}

	// Обновляем все поля пациента из запроса
	// Жёсткий перезапись всех полей без проверки на nil
	// TODO: Добавить частичное обновление с проверкой заполненности полей
	patient.FirstName = req.FirstName
	patient.MiddleName = req.MiddleName
	patient.LastName = req.LastName
	patient.Address = req.Address
	patient.AvatarURL = req.AvatarURL
	patient.IIN = req.IIN
	patient.DateOfBirth = req.DateOfBirth.Time
	patient.Gender = req.Gender
	if req.Email != "" {
		patient.Email = &req.Email
	} else {
		patient.Email = nil
	}
	patient.Height = req.Height
	patient.Weight = req.Weight
	patient.PhysActivity = req.PhysActivity
	patient.Diagnoses = req.Diagnoses
	patient.Allergens = req.Allergens
	patient.Diet = req.Diet

	// Сохраняем обновленные данные в базу
	updatedPatient, err := s.patientRepo.Update(ctx, patient)
	if err != nil {
		s.logger.Error("Failed to update patient", map[string]interface{}{
			"error": err.Error(),
			"id":    id,
		})
		return nil, err
	}

	return updatedPatient.ToPatientResponse(), nil
}

// UpdatePatientProfile - обновление или создание профиля пациента по UserID
// Если профиль существует - обновляет, если нет - создает новый
// Используется для второго этапа регистрации, когда юзер уже создан в identity_service,
// но еще не заполнил свой медицинский профиль
func (s *patientService) UpdatePatientProfile(ctx context.Context, userID uuid.UUID, req *models.PatientCreateRequest) (*models.PatientResponse, error) {
	patient, err := s.patientRepo.FindByUserID(ctx, userID)
	if err != nil {
		s.logger.Error("Failed to find patient by user ID for profile update", map[string]interface{}{
			"error":  err.Error(),
			"userID": userID,
		})
		return nil, err
	}

	if patient == nil {
		// Если профиль не найден - создаем новый на лету
		// Это удобно для фронта - единый эндпоинт для создания и обновления
		s.logger.Info("Creating new patient profile for user", map[string]interface{}{
			"userID": userID,
		})

		// ВАЖНО: Проверяем IIN на дубликат ПЕРЕД созданием
		if req.IIN != nil && *req.IIN != "" {
			existingPatient, err := s.patientRepo.FindByIIN(ctx, *req.IIN)
			if err != nil {
				s.logger.Error("Failed to check existing IIN", map[string]interface{}{
					"error":  err.Error(),
					"iin":    *req.IIN,
					"userID": userID,
				})
				return nil, err
			}

			if existingPatient != nil {
				// КРИТИЧЕСКАЯ ОШИБКА: IIN уже занят другим пациентом
				s.logger.Error("IIN already exists for another patient", map[string]interface{}{
					"iin":               *req.IIN,
					"userID":            userID,
					"existingUserID":    existingPatient.UserID,
					"existingPatientID": existingPatient.ID,
				})
				return nil, errors.New("ИИН уже используется другим пациентом")
			}
		}

		// Конвертим DTO в модель и устанавливаем правильный UserID
		newPatient := req.ToPatient()
		newPatient.UserID = userID // Перезаписываем ID из пути, это критично для безопасности

		// Сохраняем нового пациента в базу
		createdPatient, err := s.patientRepo.Create(ctx, newPatient)
		if err != nil {
			s.logger.Error("Failed to create patient profile", map[string]interface{}{
				"error":  err.Error(),
				"userID": userID,
			})
			return nil, err
		}

		return createdPatient.ToPatientResponse(), nil
	}

	// Обновляем поля существующего профиля
	// Обновляем только НЕ пустые поля из запроса (гибкое обновление)
	if req.FirstName != "" {
		patient.FirstName = req.FirstName
	}
	if req.MiddleName != "" {
		patient.MiddleName = req.MiddleName
	}
	if req.LastName != "" {
		patient.LastName = req.LastName
	}
	if req.Address != "" {
		patient.Address = req.Address
	}
	if req.AvatarURL != "" {
		patient.AvatarURL = req.AvatarURL
	}
	if !req.DateOfBirth.IsZero() {
		patient.DateOfBirth = req.DateOfBirth.Time
	}
	if req.Gender != "" {
		patient.Gender = req.Gender
	}
	if req.Email != "" {
		patient.Email = &req.Email
	}
	if req.Height != 0 {
		patient.Height = req.Height
	}
	if req.Weight != 0 {
		patient.Weight = req.Weight
	}
	if req.PhysActivity != "" {
		patient.PhysActivity = req.PhysActivity
	}

	// ВАЖНО: Проверяем IIN при обновлении
	if req.IIN != nil && *req.IIN != "" {
		// Проверяем только если IIN изменился
		currentIIN := ""
		if patient.IIN != nil {
			currentIIN = *patient.IIN
		}

		if *req.IIN != currentIIN {
			existingPatient, err := s.patientRepo.FindByIIN(ctx, *req.IIN)
			if err != nil {
				s.logger.Error("Failed to check existing IIN during update", map[string]interface{}{
					"error":     err.Error(),
					"iin":       *req.IIN,
					"userID":    userID,
					"patientID": patient.ID,
				})
				return nil, err
			}

			if existingPatient != nil && existingPatient.ID != patient.ID {
				s.logger.Error("IIN already exists for another patient during update", map[string]interface{}{
					"iin":               *req.IIN,
					"userID":            userID,
					"patientID":         patient.ID,
					"existingUserID":    existingPatient.UserID,
					"existingPatientID": existingPatient.ID,
				})
				return nil, errors.New("ИИН уже используется другим пациентом")
			}
		}

		patient.IIN = req.IIN
	}

	if len(req.Diagnoses) > 0 {
		patient.Diagnoses = req.Diagnoses
	}
	if len(req.Allergens) > 0 {
		patient.Allergens = req.Allergens
	}
	if len(req.Diet) > 0 {
		patient.Diet = req.Diet
	}

	// Сохраняем изменения
	updatedPatient, err := s.patientRepo.Update(ctx, patient)
	if err != nil {
		s.logger.Error("Failed to update patient profile", map[string]interface{}{
			"error":  err.Error(),
			"userID": userID,
		})
		return nil, err
	}

	s.logger.Info("Patient profile updated successfully", map[string]interface{}{
		"userID":    userID,
		"patientID": patient.ID,
	})

	return updatedPatient.ToPatientResponse(), nil
}

func (s *patientService) DeletePatient(ctx context.Context, id uuid.UUID) error {
	err := s.patientRepo.Delete(ctx, id)
	if err != nil {
		s.logger.Error("Failed to delete patient", map[string]interface{}{
			"error": err.Error(),
			"id":    id,
		})
		return err
	}

	return nil
}

func (s *patientService) GetPatientByIIN(ctx context.Context, iin string) (*models.PatientResponse, error) {
	patient, err := s.patientRepo.FindByIIN(ctx, iin)
	if err != nil {
		s.logger.Error("Failed to get patient by IIN", map[string]interface{}{
			"error": err.Error(),
			"iin":   iin,
		})
		return nil, err
	}

	if patient == nil {
		return nil, nil
	}

	// Получаем телефон из identity_service
	phone, err := s.getUserPhone(patient.UserID)
	if err != nil {
		s.logger.Error("Failed to get user phone", map[string]interface{}{
			"userID": patient.UserID,
			"error":  err.Error(),
		})
		// Не возвращаем ошибку, просто используем пустой телефон
		phone = ""
	}

	// Создаем ответ с телефоном
	response := patient.ToPatientResponse()
	response.Phone = phone

	return response, nil
}
