package service

import (
	"encoding/json"
	"errors"
	"os"
	"sort"
	"sync"

	"github.com/printprince/vitalem/appointment_service/internal/models"
)

type ServiceCatalogService struct {
	filePath string
	mu       sync.Mutex
}

func NewServiceCatalogService(filePath string) *ServiceCatalogService {
	return &ServiceCatalogService{
		filePath: filePath,
	}
}

func (s *ServiceCatalogService) readCatalog() (models.ServiceCatalog, error) {
	var catalog models.ServiceCatalog

	data, err := os.ReadFile(s.filePath)
	if err != nil {
		return catalog, err
	}

	if len(data) == 0 {
		catalog.Output = map[string][]models.ServiceItem{}
		return catalog, nil
	}

	if err := json.Unmarshal(data, &catalog); err != nil {
		return catalog, err
	}

	if catalog.Output == nil {
		catalog.Output = map[string][]models.ServiceItem{}
	}

	return catalog, nil
}

func (s *ServiceCatalogService) writeCatalog(catalog models.ServiceCatalog) error {
	data, err := json.MarshalIndent(catalog, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(s.filePath, data, 0644)
}

func (s *ServiceCatalogService) GetAll() (models.ServiceCatalog, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	return s.readCatalog()
}

func (s *ServiceCatalogService) Search(query string) (models.ServiceCatalog, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	catalog, err := s.readCatalog()
	if err != nil {
		return catalog, err
	}

	if query == "" {
		return catalog, nil
	}

	result := models.ServiceCatalog{
		Output: map[string][]models.ServiceItem{},
	}

	q := queryLower(query)

	for category, items := range catalog.Output {
		for _, item := range items {
			if containsService(category, item, q) {
				result.Output[category] = append(result.Output[category], item)
			}
		}
	}

	return result, nil
}

func (s *ServiceCatalogService) Create(req models.CreateServiceRequest) (models.ServiceCatalog, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	catalog, err := s.readCatalog()
	if err != nil {
		return catalog, err
	}

	if req.Category == "" {
		return catalog, errors.New("category is required")
	}

	if req.Item.ID == 0 {
		req.Item.ID = s.nextID(catalog)
	}

	catalog.Output[req.Category] = append(catalog.Output[req.Category], req.Item)

	if err := s.writeCatalog(catalog); err != nil {
		return catalog, err
	}

	return catalog, nil
}

func (s *ServiceCatalogService) Update(serviceID int, req models.UpdateServiceRequest) (models.ServiceCatalog, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	catalog, err := s.readCatalog()
	if err != nil {
		return catalog, err
	}

	found := false
	oldCategory := ""

	for category, items := range catalog.Output {
		for i, item := range items {
			if item.ID == serviceID {
				found = true
				oldCategory = category

				// удалить старый элемент
				catalog.Output[category] = append(items[:i], items[i+1:]...)
				break
			}
		}
		if found {
			break
		}
	}

	if !found {
		return catalog, errors.New("service not found")
	}

	targetCategory := req.Category
	if req.NewCategory != "" {
		targetCategory = req.NewCategory
	}
	if targetCategory == "" {
		targetCategory = oldCategory
	}

	req.Item.ID = serviceID
	catalog.Output[targetCategory] = append(catalog.Output[targetCategory], req.Item)

	if len(catalog.Output[oldCategory]) == 0 {
		delete(catalog.Output, oldCategory)
	}

	if err := s.writeCatalog(catalog); err != nil {
		return catalog, err
	}

	return catalog, nil
}

func (s *ServiceCatalogService) Delete(serviceID int) (models.ServiceCatalog, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	catalog, err := s.readCatalog()
	if err != nil {
		return catalog, err
	}

	found := false
	var emptyCategory string

	for category, items := range catalog.Output {
		for i, item := range items {
			if item.ID == serviceID {
				catalog.Output[category] = append(items[:i], items[i+1:]...)
				found = true
				if len(catalog.Output[category]) == 0 {
					emptyCategory = category
				}
				break
			}
		}
		if found {
			break
		}
	}

	if !found {
		return catalog, errors.New("service not found")
	}

	if emptyCategory != "" {
		delete(catalog.Output, emptyCategory)
	}

	if err := s.writeCatalog(catalog); err != nil {
		return catalog, err
	}

	return catalog, nil
}

func (s *ServiceCatalogService) nextID(catalog models.ServiceCatalog) int {
	maxID := 0
	for _, items := range catalog.Output {
		for _, item := range items {
			if item.ID > maxID {
				maxID = item.ID
			}
		}
	}
	return maxID + 1
}

func queryLower(v string) string {
	b := []rune(v)
	for i, r := range b {
		if r >= 'A' && r <= 'Z' {
			b[i] = r + 32
		}
	}
	return string(b)
}

func containsService(category string, item models.ServiceItem, q string) bool {
	values := []string{
		category,
		item.Name,
		item.Options.DataServiceName,
	}

	for _, v := range values {
		if contains(queryLower(v), q) {
			return true
		}
	}
	return false
}

func contains(s, sub string) bool {
	if sub == "" {
		return true
	}
	if len(sub) > len(s) {
		return false
	}
	for i := 0; i <= len(s)-len(sub); i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}
	return false
}

func (s *ServiceCatalogService) GetCategories() ([]string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	catalog, err := s.readCatalog()
	if err != nil {
		return nil, err
	}

	categories := make([]string, 0, len(catalog.Output))
	for category := range catalog.Output {
		categories = append(categories, category)
	}

	sort.Strings(categories)
	return categories, nil
}
