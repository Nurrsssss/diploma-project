package main

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"github.com/google/uuid"
	"github.com/printprince/vitalem/appointment_service/internal/models"
	"gorm.io/driver/postgres"
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

type rawServiceWrapper struct {
	Items []rawService `json:"items"`
}

func main() {
	dsn := os.Getenv("DATABASE_URL")
	if strings.TrimSpace(dsn) == "" {
		fmt.Println("DATABASE_URL is empty")
		os.Exit(1)
	}

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		panic(err)
	}

	data, err := os.ReadFile("internal/data/services.json")
	if err != nil {
		panic(err)
	}

	var catalog rawCatalog
	if err := json.Unmarshal(data, &catalog); err != nil {
		panic(err)
	}

	totalCategories := 0
	totalServices := 0

	for categoryName, raw := range catalog.Output {
		items, err := parseServices(raw)
		if err != nil {
			fmt.Printf("skip category %s: %v\n", categoryName, err)
			continue
		}

		if len(items) == 0 {
			continue
		}

		totalCategories++

		var category models.ServiceCategory
		err = db.Where("name = ?", categoryName).First(&category).Error
		if err != nil {
			if err == gorm.ErrRecordNotFound {
				category = models.ServiceCategory{
					ID:   uuid.New(),
					Name: categoryName,
				}
				if err := db.Create(&category).Error; err != nil {
					panic(err)
				}
			} else {
				panic(err)
			}
		}

		for _, item := range items {
			var count int64
			if err := db.Model(&models.Service{}).
				Where("legacy_id = ?", item.ID).
				Count(&count).Error; err != nil {
				panic(err)
			}
			if count > 0 {
				continue
			}

			serviceName := item.Options.DataServiceName
			if strings.TrimSpace(serviceName) == "" {
				serviceName = item.Name
			}

			externalCode := extractExternalCode(serviceName)

			service := models.Service{
				LegacyID:        ptrInt64(item.ID),
				CategoryID:      category.ID,
				ExternalCode:    externalCode,
				Name:            item.Name,
				ServiceName:     serviceName,
				Price:           item.Options.DataPrice,
				DurationMinutes: item.Options.DataDuration,
				IsActive:        true,
			}

			if err := db.Create(&service).Error; err != nil {
				panic(err)
			}

			totalServices++
		}
	}

	fmt.Printf("services import completed: categories=%d services=%d\n", totalCategories, totalServices)
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
	// 1. Пробуем как массив услуг
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

	// 2. Пробуем как объект с items
	var wrapper struct {
		Items json.RawMessage `json:"items"`
	}
	if err := json.Unmarshal(raw, &wrapper); err == nil && len(wrapper.Items) > 0 {
		return collectServices(wrapper.Items, result)
	}

	// 3. Пробуем как произвольный объект и идем глубже рекурсивно
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

func ptrInt64(v int64) *int64 {
	return &v
}
