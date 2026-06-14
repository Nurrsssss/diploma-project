package models

import "github.com/google/uuid"

type ReceptionDoctorUpsertRequest struct {
	FirstName    string   `json:"first_name" validate:"required"`
	MiddleName   string   `json:"middle_name"`
	LastName     string   `json:"last_name" validate:"required"`
	Phone        string   `json:"phone" validate:"required"`
	Email        string   `json:"email"`
	Description  string   `json:"description"`
	AvatarURL    string   `json:"avatar_url"`
	Roles        []string `json:"roles" validate:"required,min=1,dive,required"`
	Price        float64  `json:"price"`
	Education    []string `json:"education"`
	Certificates []string `json:"certificates"`
}

type ReceptionDoctorResponse struct {
	ID           uuid.UUID `json:"id"`
	UserID       uuid.UUID `json:"user_id"`
	FirstName    string    `json:"first_name"`
	MiddleName   string    `json:"middle_name"`
	LastName     string    `json:"last_name"`
	Phone        string    `json:"phone"`
	Email        string    `json:"email"`
	Description  string    `json:"description"`
	AvatarURL    string    `json:"avatar_url"`
	Roles        []string  `json:"roles"`
	Price        float64   `json:"price"`
	Education    []string  `json:"education"`
	Certificates []string  `json:"certificates"`
}
