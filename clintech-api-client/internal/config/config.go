package config

import (
	"os"
	"strconv"
)

type Config struct {
	Database        DatabaseConfig        `json:"database"`
	OpenAI          OpenAIConfig          `json:"openai"`
	ExternalService ExternalServiceConfig `json:"external_service"`
	UploadConfig    UploadConfig          `json:"upload_config"`
	Server          ServerConfig          `json:"server"`
}

type DatabaseConfig struct {
	Host     string `json:"host"`
	Port     string `json:"port"`
	User     string `json:"user"`
	Password string `json:"password"`
	DBName   string `json:"dbname"`
	SSLMode  string `json:"sslmode"`
}

type OpenAIConfig struct {
	APIKey               string   `json:"api_key"`
	Model                string   `json:"model"`
	Temperature          float64  `json:"temperature"`
	MaxTokens            int      `json:"max_tokens"`
	VisionModel          string   `json:"vision_model"`
	ImageDetailLevel     string   `json:"image_detail_level"`
	ImageModel           string   `json:"image_model"`
	ImageGenerationTools []string `json:"image_generation_tools"`
}

type ExternalServiceConfig struct {
	IdentityServiceURL    string `json:"identity_service_url"`
	PatientServiceURL     string `json:"patient_service_url"`
	FileServiceURL        string `json:"file_service_url"`
	AppointmentServiceURL string `json:"appointment_service_url"`
	DoctorServiceURL      string `json:"doctor_service_url"`
}

type UploadConfig struct {
	Path    string `json:"path"`
	MaxSize int64  `json:"max_size"`
}

type ServerConfig struct {
	Port string `json:"port"`
}

func Load() *Config {
	return &Config{
		Database: DatabaseConfig{
			Host:     getEnv("DB_HOST", "localhost"),
			Port:     getEnv("DB_PORT", "5432"),
			User:     getEnv("DB_USER", "postgres"),
			Password: getEnv("DB_PASSWORD", "password"),
			DBName:   getEnv("DB_NAME", "clintech"),
			SSLMode:  getEnv("DB_SSLMODE", "disable"),
		},
		OpenAI: OpenAIConfig{
			APIKey:               getEnv("OPENAI_API_KEY", ""),
			Model:                getEnv("OPENAI_MODEL", "gpt-4.1"),
			Temperature:          getFloatEnv("OPENAI_TEMPERATURE", 0.2),
			MaxTokens:            getIntEnv("OPENAI_MAX_TOKENS", 12000),
			VisionModel:          getEnv("OPENAI_VISION_MODEL", "gpt-4.1-mini"),
			ImageDetailLevel:     getEnv("OPENAI_IMAGE_DETAIL", "auto"),
			ImageModel:           getEnv("OPENAI_IMAGE_MODEL", "gpt-image-1"),
			ImageGenerationTools: []string{"image_generation"},
		},
		UploadConfig: UploadConfig{
			Path:    getEnv("UPLOAD_PATH", "uploads"),
			MaxSize: getInt64Env("MAX_UPLOAD_SIZE", 10*1024*1024),
		},
		ExternalService: ExternalServiceConfig{
			IdentityServiceURL:    getEnv("IDENTITY_BASE_URL", getEnv("GATEWAY_BASE_URL", "http://host.docker.internal:8800")),
			PatientServiceURL:     getEnv("PATIENT_BASE_URL", getEnv("GATEWAY_BASE_URL", "http://host.docker.internal:8800")),
			FileServiceURL:        getEnv("FILES_BASE_URL", getEnv("GATEWAY_BASE_URL", "http://host.docker.internal:8800")),
			AppointmentServiceURL: getEnv("APPOINTMENT_BASE_URL", getEnv("GATEWAY_BASE_URL", "http://host.docker.internal:8800")),
			DoctorServiceURL:      getEnv("DOCTOR_BASE_URL", getEnv("GATEWAY_BASE_URL", "http://host.docker.internal:8800")),
		},
		Server: ServerConfig{
			Port: getEnv("PORT", "8080"),
		},
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getIntEnv(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}

func getFloatEnv(key string, defaultValue float64) float64 {
	if value := os.Getenv(key); value != "" {
		if floatValue, err := strconv.ParseFloat(value, 64); err == nil {
			return floatValue
		}
	}
	return defaultValue
}

func getInt64Env(key string, defaultValue int64) int64 {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.ParseInt(value, 10, 64); err == nil {
			return intValue
		}
	}
	return defaultValue
}
