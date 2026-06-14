package models

type ServiceOptions struct {
	DataPrice       int    `json:"data-price"`
	DataDuration    int    `json:"data-duration"`
	DataServiceName string `json:"data-service_name"`
}

type ServiceItem struct {
	ID      int            `json:"id"`
	Name    string         `json:"name"`
	Options ServiceOptions `json:"options"`
}

type ServiceCatalog struct {
	Output map[string][]ServiceItem `json:"output"`
}

type CreateServiceRequest struct {
	Category string      `json:"category"`
	Item     ServiceItem `json:"item"`
}

type UpdateServiceRequest struct {
	Category    string      `json:"category"`
	NewCategory string      `json:"new_category"`
	Item        ServiceItem `json:"item"`
}
