package models

import "github.com/google/uuid"

type ServiceListItemResponse struct {
	ID              uint64    `json:"id"`
	LegacyID        *int64    `json:"legacy_id,omitempty"`
	CategoryID      uuid.UUID `json:"category_id"`
	CategoryName    string    `json:"category_name"`
	ExternalCode    *string   `json:"external_code,omitempty"`
	Name            string    `json:"name"`
	ServiceName     string    `json:"service_name"`
	Price           int       `json:"price"`
	DurationMinutes int       `json:"duration_minutes"`
	IsActive        bool      `json:"is_active"`
}

type CreateServiceDBRequest struct {
	CategoryID      *uuid.UUID `json:"category_id,omitempty"`
	CategoryName    string     `json:"category_name,omitempty"`
	LegacyID        *int64     `json:"legacy_id,omitempty"`
	ExternalCode    *string    `json:"external_code,omitempty"`
	Name            string     `json:"name"`
	ServiceName     string     `json:"service_name"`
	Price           int        `json:"price"`
	DurationMinutes int        `json:"duration_minutes"`
	IsActive        *bool      `json:"is_active,omitempty"`
}

type UpdateServiceDBRequest struct {
	CategoryID      *uuid.UUID `json:"category_id,omitempty"`
	CategoryName    *string    `json:"category_name,omitempty"`
	LegacyID        *int64     `json:"legacy_id,omitempty"`
	ExternalCode    *string    `json:"external_code,omitempty"`
	Name            *string    `json:"name,omitempty"`
	ServiceName     *string    `json:"service_name,omitempty"`
	Price           *int       `json:"price,omitempty"`
	DurationMinutes *int       `json:"duration_minutes,omitempty"`
	IsActive        *bool      `json:"is_active,omitempty"`
}

type ServiceCatalogOption struct {
	DataPrice       int    `json:"data-price"`
	DataDuration    int    `json:"data-duration"`
	DataServiceName string `json:"data-service_name"`
}

type ServiceCatalogItem struct {
	ID      uint64               `json:"id"`
	Name    string               `json:"name"`
	Options ServiceCatalogOption `json:"options"`
}

type ServiceCatalogResponse struct {
	Output map[string][]ServiceCatalogItem `json:"output"`
}

type CreateServiceCategoryRequest struct {
	Name string `json:"name"`
}
