package service

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/printprince/vitalem/identity_service/internal/models"
	"github.com/printprince/vitalem/identity_service/internal/repository"
	"gorm.io/gorm"

	"github.com/dgrijalva/jwt-go"
	"github.com/printprince/vitalem/logger_service/pkg/logger"
	"golang.org/x/crypto/bcrypt"
)

// TokenClaims - структура данных для JWT токена
// Вся инфа, которую мы засовываем в токен и потом можем получить из него
type TokenClaims struct {
	UserID    string `json:"user_id"`
	Phone     string `json:"phone"`
	Email     string `json:"email,omitempty"`
	Role      string `json:"role"`
	ExpiresAt int64  `json:"exp"`
}

// AuthService - сервис аутентификации и авторизации
// Содержит бизнес-логику для работы с пользователями, JWT и хешированием
type AuthService struct {
	userRepository    *repository.UserRepository
	messageService    MessageService
	jwtSecret         string
	jwtExpire         int
	logger            *logger.Client
	httpClient        *http.Client
	patientServiceURL string
}

// NewAuthService - фабрика для создания сервиса аутентификации
// Принимает репозиторий пользователей и настройки JWT
func NewAuthService(userRepository *repository.UserRepository, jwtSecret string, jwtExpire int) *AuthService {
	patientServiceURL := os.Getenv("PATIENT_SERVICE_URL")
	if patientServiceURL == "" {
		patientServiceURL = "http://patient_service:8804"
	}

	return &AuthService{
		userRepository: userRepository,
		jwtSecret:      jwtSecret,
		jwtExpire:      jwtExpire,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
		patientServiceURL: patientServiceURL,
	}
}

// SetMessageService - установка сервиса сообщений
// Опционально - используется для публикации событий создания пользователя
func (s *AuthService) SetMessageService(messageService MessageService) {
	s.messageService = messageService
}

// SetLogger - устанавливает клиент логирования
func (s *AuthService) SetLogger(logger *logger.Client) {
	s.logger = logger
}
func normalizePhone(phone string) string {
	var b strings.Builder
	for _, r := range phone {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	return b.String()
}

func (s *AuthService) Register(email, password, role, phone string) error {
	normalizedPhone := normalizePhone(phone)

	existingByPhone, err := s.userRepository.FindByPhone(normalizedPhone)
	if err == nil && existingByPhone != nil {
		if s.logger != nil {
			s.logger.Warn("Попытка повторной регистрации по телефону", map[string]interface{}{
				"phone": normalizedPhone,
			})
		}
		return errors.New("User with this phone already exists")
	}
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		if s.logger != nil {
			s.logger.Error("Ошибка проверки пользователя по телефону", map[string]interface{}{
				"phone": normalizedPhone,
				"error": err.Error(),
			})
		}
		return err
	}

	if email != "" {
		exists, err := s.userRepository.ExistsByEmail(email)
		if err != nil {
			if s.logger != nil {
				s.logger.Error("Ошибка проверки пользователя по email", map[string]interface{}{
					"email": email,
					"error": err.Error(),
				})
			}
			return err
		}
		if exists {
			if s.logger != nil {
				s.logger.Warn("Попытка повторной регистрации по email", map[string]interface{}{
					"email": email,
				})
			}
			return errors.New("User with this email already exists")
		}
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		if s.logger != nil {
			s.logger.Error("Ошибка хеширования пароля", map[string]interface{}{
				"error": err.Error(),
			})
		}
		return err
	}

	var emailPtr *string
	if email != "" {
		emailPtr = &email
	}

	user := &models.Users{
		Email:          emailPtr,
		HashedPassword: string(hashedPassword),
		Role:           role,
		Phone:          normalizedPhone,
	}

	if err := s.userRepository.Create(user); err != nil {
		if s.logger != nil {
			s.logger.Error("Ошибка создания пользователя", map[string]interface{}{
				"phone": normalizedPhone,
				"error": err.Error(),
			})
		}

		errText := strings.ToLower(err.Error())
		if strings.Contains(errText, "duplicate key") ||
			strings.Contains(errText, "unique constraint") ||
			strings.Contains(errText, "idx_phone") ||
			strings.Contains(errText, "users_phone_unique") {
			return errors.New("User with this phone already exists")
		}
		if strings.Contains(errText, "idx_email") {
			return errors.New("User with this email already exists")
		}

		return err
	}

	if s.messageService != nil {
		eventEmail := ""
		if user.Email != nil {
			eventEmail = *user.Email
		}

		event := &models.UserCreatedEvent{
			UserID: user.ID.String(),
			Email:  eventEmail,
			Role:   user.Role,
			Phone:  normalizedPhone,
		}

		ctx := context.Background()
		if err := s.messageService.PublishUserCreated(ctx, event); err != nil && s.logger != nil {
			s.logger.Error("Ошибка публикации события создания пользователя", map[string]interface{}{
				"user_id": user.ID,
				"phone":   user.Phone,
				"error":   err.Error(),
			})
		}
	}

	if s.logger != nil {
		s.logger.Info("Пользователь успешно зарегистрирован", map[string]interface{}{
			"phone": normalizedPhone,
			"role":  role,
		})
	}

	return nil
}

// LoginByPhone - аутентификация пользователя по телефону и паролю
func (s *AuthService) LoginByPhone(phone, password string) (string, error) {
	normalizedPhone := normalizePhone(phone)

	user, err := s.userRepository.FindByPhone(normalizedPhone)
	if err != nil {
		if s.logger != nil {
			s.logger.Error("Ошибка при поиске пользователя по телефону", map[string]interface{}{
				"phone":           phone,
				"normalized_phone": normalizedPhone,
				"error": err.Error(),
			})
		}
		return "", errors.New("Invalid phone")
	}

	// Проверяем пароль
	if err := bcrypt.CompareHashAndPassword([]byte(user.HashedPassword), []byte(password)); err != nil {
		if s.logger != nil {
			s.logger.Warn("Неудачная попытка входа: неверный пароль", map[string]interface{}{
				"phone":           phone,
				"normalized_phone": normalizedPhone,
			})
		}
		return "", errors.New("Invalid password")
	}

	// Генерируем токен
	phoneClaim := user.Phone
	emailClaim := ""
	if user.Email != nil {
		emailClaim = *user.Email
	}
	token, err := s.generateToken(user.ID.String(), phoneClaim, emailClaim, user.Role)
	if err != nil {
		if s.logger != nil {
			s.logger.Error("Ошибка генерации токена", map[string]interface{}{
				"phone":           phone,
				"normalized_phone": normalizedPhone,
				"error": err.Error(),
			})
		}
		return "", err
	}

	if s.logger != nil {
		s.logger.Info("Успешный вход пользователя", map[string]interface{}{
			"phone":           phone,
			"normalized_phone": normalizedPhone,
			"role":            user.Role,
		})
	}

	return token, nil
}

// ValidateToken - проверка и декодирование JWT токена
func (s *AuthService) ValidateToken(tokenString string) (*TokenClaims, error) {
	// Парсим токен
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(s.jwtSecret), nil
	})
	if err != nil {
		return nil, err
	}
	if !token.Valid {
		return nil, errors.New("invalid token")
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return nil, errors.New("invalid token claims")
	}

	exp, ok := claims["exp"].(float64)
	if !ok {
		return nil, errors.New("invalid expiration time")
	}
	if int64(exp) < time.Now().Unix() {
		return nil, errors.New("token expired")
	}

	userID, ok := claims["user_id"].(string)
	if !ok {
		return nil, errors.New("invalid user_id in token")
	}

	role, ok := claims["role"].(string)
	if !ok {
		return nil, errors.New("invalid role in token")
	}

	phone, _ := claims["phone"].(string)
	email, _ := claims["email"].(string)

	return &TokenClaims{
		UserID:    userID,
		Phone:     phone,
		Email:     email,
		Role:      role,
		ExpiresAt: int64(exp),
	}, nil
}

// GetJWTSecret - получение секретного ключа для JWT
// Используется в middleware для валидации токенов
func (s *AuthService) GetJWTSecret() string {
	return s.jwtSecret
}

// generateToken - внутренний метод для генерации JWT токена
// Создает signed JWT с полезной нагрузкой из ID, телефона, роли и опционального email
func (s *AuthService) generateToken(userID, phone, email, role string) (string, error) {
	expirationTime := time.Now().Add(time.Duration(s.jwtExpire) * time.Hour).Unix()

	claims := jwt.MapClaims{
		"user_id": userID,
		"phone":   phone,
		"role":    role,
		"exp":     expirationTime,
	}
	if email != "" {
		claims["email"] = email
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte(s.jwtSecret))
	if err != nil {
		return "", err
	}
	return tokenString, nil
}

// UpdatePhone - обновление телефона пользователя
func (s *AuthService) UpdatePhone(userID, phone string) error {
	normalizedPhone := normalizePhone(phone)

	// Парсим userID в UUID
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		if s.logger != nil {
			s.logger.Error("Invalid user ID format", map[string]interface{}{
				"user_id": userID,
				"error":   err.Error(),
			})
		}
		return err
	}

	// Получаем пользователя по ID
	user, err := s.userRepository.FindByID(userUUID)
	if err != nil {
		if s.logger != nil {
			s.logger.Error("Failed to find user for phone update", map[string]interface{}{
				"user_id": userID,
				"error":   err.Error(),
			})
		}
		return err
	}

	if user == nil {
		return errors.New("User not found")
	}

	// Обновляем телефон
	user.Phone = normalizedPhone

	// Сохраняем изменения
	if err := s.userRepository.Update(user); err != nil {
		if s.logger != nil {
			s.logger.Error("Failed to update user phone", map[string]interface{}{
				"user_id": userID,
				"phone":   normalizedPhone,
				"error":   err.Error(),
			})
		}
		return err
	}

	if s.logger != nil {
		s.logger.Info("User phone updated", map[string]interface{}{
			"user_id": userID,
			"phone":   normalizedPhone,
		})
	}

	return nil
}

func (s *AuthService) GetUser(userID string) (*models.Users, error) {
	parsedID, err := uuid.Parse(userID)
	if err != nil {
		if s.logger != nil {
			s.logger.Error("Invalid user ID format", map[string]interface{}{
				"user_id": userID,
				"error":   err.Error(),
			})
		}
		return nil, errors.New("invalid user ID format")
	}

	user, err := s.userRepository.FindByID(parsedID)
	if err != nil {
		if s.logger != nil {
			s.logger.Error("Failed to find user by ID", map[string]interface{}{
				"user_id": userID,
				"error":   err.Error(),
			})
		}
		return nil, err
	}
	return user, nil
}

// RegisterPatientByDoctorRequest структура запроса для создания пациента врачом
type RegisterPatientByDoctorRequest struct {
	Phone        string   `json:"phone"`
	Password     string   `json:"password"`
	FirstName    string   `json:"first_name"`
	LastName     string   `json:"last_name"`
	MiddleName   string   `json:"middle_name"`
	IIN          string   `json:"iin"`
	DateOfBirth  string   `json:"date_of_birth"`
	Email        string   `json:"email"`
	Address      string   `json:"address"`
	Gender       string   `json:"gender"`
	Height       float64  `json:"height"`
	Weight       float64  `json:"weight"`
	PhysActivity string   `json:"phys_activity"`
	Diagnoses    []string `json:"diagnoses"`
	Allergens    []string `json:"allergens"`
	Diet         []string `json:"diet"`
}

// RegisterPatientByDoctorResponse структура ответа для создания пациента врачом
type RegisterPatientByDoctorResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Data    struct {
		UserID     string `json:"user_id"`
		PatientID  string `json:"patient_id"`
		Phone      string `json:"phone"`
		FirstName  string `json:"first_name"`
		LastName   string `json:"last_name"`
		MiddleName string `json:"middle_name,omitempty"`
		Email      string `json:"email,omitempty"`
		CreatedAt  string `json:"created_at"`
	} `json:"data"`
}

// RegisterPatientByDoctor - создание пациента врачом/ресепшн без OTP верификации
// Создает пользователя и профиль пациента за один запрос
func (s *AuthService) RegisterPatientByDoctor(ctx context.Context, req *RegisterPatientByDoctorRequest) (*RegisterPatientByDoctorResponse, error) {
	normalizedPhone := normalizePhone(req.Phone)

	// Проверяем телефон на уникальность
	existingByPhone, err := s.userRepository.FindByPhone(normalizedPhone)
	if err == nil && existingByPhone != nil {
		if s.logger != nil {
			s.logger.Warn("Попытка создания пациента с существующим телефоном", map[string]interface{}{
				"phone": normalizedPhone,
			})
		}
		return nil, errors.New("User with this phone already exists")
	}

	// Хешируем пароль
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		if s.logger != nil {
			s.logger.Error("Ошибка хеширования пароля", map[string]interface{}{
				"error": err.Error(),
			})
		}
		return nil, err
	}

	// Готовим email указатель
	var emailPtr *string
	if req.Email != "" {
		emailPtr = &req.Email
	}

	// Создаем нового пользователя с ролью patient
	user := &models.Users{
		Email:          emailPtr,
		HashedPassword: string(hashedPassword),
		Role:           "patient",
		Phone:          normalizedPhone,
	}

	// Сохраняем пользователя в базу данных
	if err := s.userRepository.Create(user); err != nil {
		if s.logger != nil {
			s.logger.Error("Ошибка создания пользователя", map[string]interface{}{
				"phone": normalizedPhone,
				"error": err.Error(),
			})
		}
		return nil, err
	}

	if s.logger != nil {
		s.logger.Info("Пользователь создан для пациента врачом/ресепшн", map[string]interface{}{
			"user_id": user.ID.String(),
			"phone":   normalizedPhone,
		})
	}

	rollbackUser := func() {
		// Выполнить откат, если метод удаления есть в репозитории.
		// Если метода нет, просто залогируем.
		type userDeleter interface {
			Delete(id uuid.UUID) error
		}

		if repo, ok := interface{}(s.userRepository).(userDeleter); ok {
			if err := repo.Delete(user.ID); err != nil && s.logger != nil {
				s.logger.Error("Не удалось откатить созданного пользователя после ошибки профиля пациента", map[string]interface{}{
					"user_id": user.ID.String(),
					"phone":   normalizedPhone,
					"error":   err.Error(),
				})
			}
		} else if s.logger != nil {
			s.logger.Warn("UserRepository не поддерживает Delete, откат пользователя пропущен", map[string]interface{}{
				"user_id": user.ID.String(),
				"phone":   normalizedPhone,
			})
		}
	}

	// Готовим запрос в Patient Service
	patientReq := map[string]interface{}{
		"user_id":     user.ID.String(),
		"first_name":  req.FirstName,
		"last_name":   req.LastName,
		"middle_name": req.MiddleName,
		"diagnoses":   req.Diagnoses,
		"allergens":   req.Allergens,
		"diet":        req.Diet,
	}

	// Добавляем опциональные поля только если они не пустые
	if req.Address != "" {
		patientReq["address"] = req.Address
	}
	if req.Gender != "" {
		patientReq["gender"] = req.Gender
	}
	if req.PhysActivity != "" {
		patientReq["phys_activity"] = req.PhysActivity
	}
	if req.Height > 0 {
		patientReq["height"] = req.Height
	}
	if req.Weight > 0 {
		patientReq["weight"] = req.Weight
	}
	if req.IIN != "" {
		patientReq["iin"] = req.IIN
	}
	if req.DateOfBirth != "" {
		patientReq["date_of_birth"] = req.DateOfBirth
	}
	if req.Email != "" {
		patientReq["email"] = req.Email
	}

	reqBody, err := json.Marshal(patientReq)
	if err != nil {
		if s.logger != nil {
			s.logger.Error("Ошибка маршалинга запроса для Patient Service", map[string]interface{}{
				"error":   err.Error(),
				"user_id": user.ID.String(),
			})
		}
		rollbackUser()
		return nil, fmt.Errorf("failed to marshal patient request: %w", err)
	}

	if s.logger != nil {
		s.logger.Info("Payload для Patient Service", map[string]interface{}{
			"user_id": user.ID.String(),
			"payload": string(reqBody),
		})
	}

	// Вызываем Patient Service для создания профиля через внутренний маршрут
	patientURL := fmt.Sprintf("%s/public/patients/internal", s.patientServiceURL)
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, patientURL, bytes.NewBuffer(reqBody))
	if err != nil {
		if s.logger != nil {
			s.logger.Error("Ошибка создания HTTP запроса к Patient Service", map[string]interface{}{
				"error":   err.Error(),
				"user_id": user.ID.String(),
				"url":     patientURL,
			})
		}
		rollbackUser()
		return nil, fmt.Errorf("failed to create HTTP request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("X-Internal-Service", "identity_service")
	httpReq.Header.Set("X-User-ID", user.ID.String())

	if s.logger != nil {
		s.logger.Info("Вызов Patient Service для создания профиля", map[string]interface{}{
			"url":     patientURL,
			"user_id": user.ID.String(),
		})
	}

	resp, err := s.httpClient.Do(httpReq)
	if err != nil {
		if s.logger != nil {
			s.logger.Error("Ошибка вызова Patient Service", map[string]interface{}{
				"error":   err.Error(),
				"url":     patientURL,
				"user_id": user.ID.String(),
			})
		}
		rollbackUser()
		return nil, fmt.Errorf("failed to call patient service: %w", err)
	}
	defer resp.Body.Close()

	// Читаем тело ответа
	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		if s.logger != nil {
			s.logger.Error("Ошибка чтения ответа от Patient Service", map[string]interface{}{
				"error":   err.Error(),
				"status":  resp.StatusCode,
				"user_id": user.ID.String(),
			})
		}
		rollbackUser()
		return nil, fmt.Errorf("failed to read patient service response: %w", err)
	}

	if s.logger != nil {
		s.logger.Info("Ответ от Patient Service", map[string]interface{}{
			"status_code": resp.StatusCode,
			"body":        string(bodyBytes),
			"user_id":     user.ID.String(),
		})
	}

	// Пытаемся распарсить JSON, но не падаем, если пришел не объект
	var patientResp map[string]interface{}
	if len(bodyBytes) > 0 {
		if err := json.Unmarshal(bodyBytes, &patientResp); err != nil {
			if s.logger != nil {
				s.logger.Warn("Ответ Patient Service не удалось распарсить как JSON object", map[string]interface{}{
					"error":   err.Error(),
					"status":  resp.StatusCode,
					"body":    string(bodyBytes),
					"user_id": user.ID.String(),
				})
			}
			patientResp = map[string]interface{}{}
		}
	}

	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
		errorMsg := fmt.Sprintf("Patient Service вернул ошибку: статус %d", resp.StatusCode)

		if msg, ok := patientResp["error"].(string); ok && msg != "" {
			errorMsg = msg
		} else if msg, ok := patientResp["message"].(string); ok && msg != "" {
			errorMsg = msg
		} else if len(bodyBytes) > 0 {
			errorMsg = string(bodyBytes)
		}

		if s.logger != nil {
			s.logger.Error("Patient Service вернул ошибку", map[string]interface{}{
				"status_code": resp.StatusCode,
				"error":       errorMsg,
				"response":    patientResp,
				"body":        string(bodyBytes),
				"user_id":     user.ID.String(),
			})
		}

		rollbackUser()
		return nil, fmt.Errorf("patient service error: %s", errorMsg)
	}

	// Формируем ответ - извлекаем patient ID из ответа
	patientID := ""
	if idStr, ok := patientResp["id"].(string); ok {
		patientID = idStr
	} else if idAny, ok := patientResp["id"]; ok {
		patientID = fmt.Sprintf("%v", idAny)
		if parsedUUID, err := uuid.Parse(patientID); err == nil {
			patientID = parsedUUID.String()
		}
	}

	response := &RegisterPatientByDoctorResponse{
		Success: true,
		Message: "Пациент успешно создан",
	}

	response.Data.UserID = user.ID.String()
	response.Data.PatientID = patientID
	response.Data.Phone = normalizedPhone
	response.Data.FirstName = req.FirstName
	response.Data.LastName = req.LastName
	if req.MiddleName != "" {
		response.Data.MiddleName = req.MiddleName
	}
	if req.Email != "" {
		response.Data.Email = req.Email
	}
	response.Data.CreatedAt = time.Now().Format(time.RFC3339)

	return response, nil
}
