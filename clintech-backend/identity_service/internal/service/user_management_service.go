package service

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/printprince/vitalem/identity_service/internal/models"
	"github.com/printprince/vitalem/identity_service/internal/repository"
	"golang.org/x/crypto/bcrypt"
)

const DefaultDoctorPassword = "Vitalem1234"

type UserManagementService interface {
	CreateDoctorUser(ctx context.Context, req *models.InternalUserUpsertRequest) (*models.InternalUserResponse, error)
	GetUserByID(ctx context.Context, id uuid.UUID) (*models.InternalUserResponse, error)
	UpdateUser(ctx context.Context, id uuid.UUID, req *models.InternalUserUpsertRequest) (*models.InternalUserResponse, error)
	DeleteUser(ctx context.Context, id uuid.UUID) error
}

type userManagementService struct {
	userRepo repository.UserRepository
}

func NewUserManagementService(userRepo repository.UserRepository) UserManagementService {
	return &userManagementService{userRepo: userRepo}
}

func (s *userManagementService) CreateDoctorUser(ctx context.Context, req *models.InternalUserUpsertRequest) (*models.InternalUserResponse, error) {
	if req.Phone == "" {
		return nil, fmt.Errorf("phone is required")
	}

	existsByPhone, err := s.userRepo.FindByPhone(req.Phone)
	if err == nil && existsByPhone != nil {
		return nil, fmt.Errorf("user with this phone already exists")
	}

	if req.Email != "" {
		existsByEmail, err := s.userRepo.ExistsByEmail(req.Email)
		if err != nil {
			return nil, err
		}
		if existsByEmail {
			return nil, fmt.Errorf("user with this email already exists")
		}
	}

	password := req.Password
	if password == "" {
		password = DefaultDoctorPassword
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	var emailPtr *string
	if req.Email != "" {
		email := req.Email
		emailPtr = &email
	}

	user := &models.Users{
		ID:             uuid.New(),
		Email:          emailPtr,
		Phone:          req.Phone,
		Role:           models.RoleDoctor,
		HashedPassword: string(hash),
	}

	if err := s.userRepo.Create(user); err != nil {
		return nil, err
	}

	email := ""
	if user.Email != nil {
		email = *user.Email
	}

	return &models.InternalUserResponse{
		ID:    user.ID,
		Email: email,
		Phone: user.Phone,
		Role:  user.Role,
	}, nil
}
func (s *userManagementService) GetUserByID(ctx context.Context, id uuid.UUID) (*models.InternalUserResponse, error) {
	// если у тебя FindByID без ctx, смени на s.userRepo.FindByID(id)
	user, err := s.userRepo.FindByID(id)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, fmt.Errorf("user not found")
	}

	email := ""
	if user.Email != nil {
		email = *user.Email
	}

	return &models.InternalUserResponse{
		ID:    user.ID,
		Email: email,
		Phone: user.Phone,
		Role:  user.Role,
	}, nil
}

func (s *userManagementService) UpdateUser(ctx context.Context, id uuid.UUID, req *models.InternalUserUpsertRequest) (*models.InternalUserResponse, error) {
	// если у тебя FindByID без ctx, смени на s.userRepo.FindByID(id)
	user, err := s.userRepo.FindByID(id)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, fmt.Errorf("user not found")
	}

	if req.Email == "" {
		user.Email = nil
	} else {
		email := req.Email
		user.Email = &email
	}

	user.Phone = req.Phone
	user.Role = models.RoleDoctor

	// если у тебя Update без ctx, смени на s.userRepo.Update(user)
	if err := s.userRepo.Update(user); err != nil {
		return nil, err
	}

	email := ""
	if user.Email != nil {
		email = *user.Email
	}

	return &models.InternalUserResponse{
		ID:    user.ID,
		Email: email,
		Phone: user.Phone,
		Role:  user.Role,
	}, nil
}

func (s *userManagementService) DeleteUser(ctx context.Context, id uuid.UUID) error {
	user, err := s.userRepo.FindByID(id)
	if err != nil {
		return err
	}
	if user == nil {
		return fmt.Errorf("user not found")
	}

	return s.userRepo.Delete(user)
}
