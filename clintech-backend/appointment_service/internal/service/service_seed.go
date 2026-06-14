package service

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/printprince/vitalem/appointment_service/internal/models"
	"gorm.io/gorm"
)

type rawCatalog struct {
	Output map[string]json.RawMessage `json:"output"`
}

type rawService struct {
	ID      int64  `json:"id"`
	Name    string `json:"name"`
	Options struct {
		DataPrice       int    `json:"data-price"`
		DataDuration    int    `json:"data-duration"`
		DataServiceName string `json:"data-service_name"`
	} `json:"options"`
}

// SeedServicesFromJSON imports `services.json` into DB catalog.
// Idempotency: skips services that already exist by `legacy_id`.
func SeedServicesFromJSON(db *gorm.DB, catalogJSON []byte) (categories int, services int, err error) {
	if db == nil {
		return 0, 0, fmt.Errorf("db is nil")
	}

	var catalog rawCatalog
	if err := json.Unmarshal(catalogJSON, &catalog); err != nil {
		return 0, 0, err
	}

	// Load existing legacy ids once (fast path).
	var existingLegacyIDs []int64
	if err := db.Table("services").
		Select("legacy_id").
		Where("legacy_id IS NOT NULL").
		Scan(&existingLegacyIDs).Error; err != nil {
		return 0, 0, err
	}
	existing := make(map[int64]struct{}, len(existingLegacyIDs))
	for _, id := range existingLegacyIDs {
		existing[id] = struct{}{}
	}

	for categoryName, raw := range catalog.Output {
		items, err := parseServices(raw)
		if err != nil || len(items) == 0 {
			continue
		}

		categoryName = strings.TrimSpace(categoryName)
		if categoryName == "" {
			continue
		}

		var category models.ServiceCategory
		q := db.Where("name = ?", categoryName).First(&category)
		if q.Error != nil {
			if q.Error == gorm.ErrRecordNotFound {
				category = models.ServiceCategory{
					ID:   uuid.New(),
					Name: categoryName,
				}
				if err := db.Create(&category).Error; err != nil {
					return categories, services, err
				}
				categories++
			} else {
				return categories, services, q.Error
			}
		}

		for _, item := range items {
			if item.ID == 0 {
				continue
			}
			if _, ok := existing[item.ID]; ok {
				continue
			}

			serviceName := strings.TrimSpace(item.Options.DataServiceName)
			if serviceName == "" {
				serviceName = strings.TrimSpace(item.Name)
			}
			if serviceName == "" {
				continue
			}

			externalCode := extractExternalCode(serviceName)

			service := models.Service{
				LegacyID:        ptrInt64(item.ID),
				CategoryID:      category.ID,
				ExternalCode:    externalCode,
				Name:            strings.TrimSpace(item.Name),
				ServiceName:     serviceName,
				Price:           item.Options.DataPrice,
				DurationMinutes: item.Options.DataDuration,
				IsActive:        true,
			}

			if err := db.Create(&service).Error; err != nil {
				return categories, services, err
			}

			existing[item.ID] = struct{}{}
			services++
		}
	}

	return categories, services, nil
}

// SeedServicesIfEmpty imports services only when catalog is empty.
func SeedServicesIfEmpty(db *gorm.DB, catalogJSON []byte) (seeded bool, categories int, services int, err error) {
	if db == nil {
		return false, 0, 0, fmt.Errorf("db is nil")
	}

	var count int64
	if err := db.Table("services").Count(&count).Error; err != nil {
		return false, 0, 0, err
	}
	if count > 0 {
		return false, 0, 0, nil
	}

	categories, services, err = SeedServicesFromJSON(db, catalogJSON)
	if err != nil {
		return false, categories, services, err
	}
	return true, categories, services, nil
}

func parseServices(raw json.RawMessage) ([]rawService, error) {
	var result []rawService
	if err := collectServices(raw, &result); err != nil {
		return nil, err
	}
	if len(result) == 0 {
		return nil, fmt.Errorf("unsupported category format")
	}
	return result, nil
}

func collectServices(raw json.RawMessage, result *[]rawService) error {
	// 1) array of services
	var items []rawService
	if err := json.Unmarshal(raw, &items); err == nil {
		valid := 0
		for _, item := range items {
			if item.ID != 0 || strings.TrimSpace(item.Name) != "" || strings.TrimSpace(item.Options.DataServiceName) != "" {
				valid++
			}
		}
		if valid > 0 {
			*result = append(*result, items...)
			return nil
		}
	}

	// 2) object with items
	var wrapper struct {
		Items json.RawMessage `json:"items"`
	}
	if err := json.Unmarshal(raw, &wrapper); err == nil && len(wrapper.Items) > 0 {
		return collectServices(wrapper.Items, result)
	}

	// 3) nested object, recurse into values
	var generic map[string]json.RawMessage
	if err := json.Unmarshal(raw, &generic); err == nil {
		found := false
		for _, nested := range generic {
			before := len(*result)
			_ = collectServices(nested, result)
			if len(*result) > before {
				found = true
			}
		}
		if found {
			return nil
		}
	}

	return fmt.Errorf("unsupported category format")
}

func extractExternalCode(s string) *string {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil
	}
	parts := strings.Fields(s)
	if len(parts) == 0 {
		return nil
	}
	code := parts[0]
	return &code
}

func ptrInt64(v int64) *int64 { return &v }

