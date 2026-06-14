package config

import (
	"fmt"
	"os"
	"strconv"
	"time"

	"io/ioutil"

	"gopkg.in/yaml.v3"
)

// Config основная структура конфигурации приложения
type Config struct {
	Server   ServerConfig   `yaml:"server"`
	Database DatabaseConfig `yaml:"database"`
	RabbitMQ RabbitMQConfig `yaml:"rabbitmq"`
	Logging  LoggingConfig  `yaml:"logging"`
	Auth     AuthConfig     `yaml:"auth"`
	SMTP     SMTPConfig     `yaml:"email"`
	SMS      SMSConfig      `yaml:"sms"` // Добавляем SMS конфигурацию
	Telegram TelegramConfig `yaml:"telegram"`
	WhatsApp WhatsAppConfig `yaml:"whatsapp"`
}

// ServerConfig конфигурация HTTP сервера
type ServerConfig struct {
	Port         string        `yaml:"port"`
	ReadTimeout  time.Duration `yaml:"read_timeout"`
	WriteTimeout time.Duration `yaml:"write_timeout"`
}

// TelegramConfig — настройки для Telegram Bot API
type TelegramConfig struct {
	BotToken string `yaml:"bot_token"`
	ChatID   string `yaml:"chat_id"`
}

// WhatsAppConfig — настройки для WhatsApp через Twilio API
type WhatsAppConfig struct {
	Enabled    bool   `yaml:"enabled"` // Добавляем флаг включения
	AccountSID string `yaml:"account_sid"`
	AuthToken  string `yaml:"auth_token"`
	FromNumber string `yaml:"from_number"` // Twilio WhatsApp номер типа "whatsapp:+14155238886"
}

// SMSConfig — настройки для SMS
type SMSConfig struct {
	Provider string     `yaml:"provider"`
	SMSC     SMSCConfig `yaml:"smsc"`
}

// SMSCConfig — настройки для SMSC.kz
type SMSCConfig struct {
	Login    string `yaml:"login"`
	Password string `yaml:"password"`
	APIURL   string `yaml:"api_url"`
	Sender   string `yaml:"sender"`
}

// DatabaseConfig конфигурация подключения к Postgres
type DatabaseConfig struct {
	Host     string `yaml:"host"`
	Port     int    `yaml:"port"`
	User     string `yaml:"user"`
	Password string `yaml:"password"`
	DBName   string `yaml:"name"`
	SSLMode  string `yaml:"sslmode"`
}

// LoggingConfig уровень логирования
type LoggingConfig struct {
	ConsoleLevel string `yaml:"console_level"`
	ServiceLevel string `yaml:"service_level"`
	ServiceURL   string `yaml:"service_url"`
}

// AuthConfig конфиг для JWT и т.п.
type AuthConfig struct {
	JWTSecret string `yaml:"jwt_secret"`
}

// ExternalConfig внешние сервисы, например Telegram, OpenAI и др.

// LoadConfig читает YAML-файл конфигурации
func LoadConfig(path string) (*Config, error) {
	data, err := ioutil.ReadFile(path)
	if err != nil {
		return nil, err
	}

	var cfg Config
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil, err
	}

	overrideFromEnv(&cfg)

	return &cfg, nil
}

// SMTPConfig — настройки SMTP для отправки email
type SMTPConfig struct {
	Host     string `yaml:"smtp_host"`
	Port     int    `yaml:"smtp_port"`
	Username string `yaml:"smtp_username"`
	Password string `yaml:"smtp_password"`
	From     string `yaml:"smtp_from"`
}

// PostgresDSN формирует строку подключения
func (d *DatabaseConfig) PostgresDSN() string {
	return fmt.Sprintf("postgres://%s:%s@%s:%d/%s?sslmode=%s",
		d.User, d.Password, d.Host, d.Port, d.DBName, d.SSLMode)
}

// overrideFromEnv позволяет переопределять значения из ENV
func overrideFromEnv(cfg *Config) {
	// Server config
	if port := os.Getenv("SERVER_PORT"); port != "" {
		cfg.Server.Port = port
	}

	// Logging config
	if consoleLevel := os.Getenv("CONSOLE_LOG_LEVEL"); consoleLevel != "" {
		cfg.Logging.ConsoleLevel = consoleLevel
	}
	if serviceLevel := os.Getenv("SERVICE_LOG_LEVEL"); serviceLevel != "" {
		cfg.Logging.ServiceLevel = serviceLevel
	}
	if serviceURL := os.Getenv("LOGGER_SERVICE_URL"); serviceURL != "" {
		cfg.Logging.ServiceURL = serviceURL
	}

	// Auth config
	if jwt := os.Getenv("JWT_SECRET"); jwt != "" {
		cfg.Auth.JWTSecret = jwt
	}

	// Database config
	if dbhost := os.Getenv("DB_HOST"); dbhost != "" {
		cfg.Database.Host = dbhost
	}
	if dbport := os.Getenv("DB_PORT"); dbport != "" {
		if p, err := strconv.Atoi(dbport); err == nil {
			cfg.Database.Port = p
		}
	}
	if dbuser := os.Getenv("DB_USER"); dbuser != "" {
		cfg.Database.User = dbuser
	}
	if dbpass := os.Getenv("DB_PASSWORD"); dbpass != "" {
		cfg.Database.Password = dbpass
	}
	if dbname := os.Getenv("DB_NAME"); dbname != "" {
		cfg.Database.DBName = dbname
	}
	if sslmode := os.Getenv("DB_SSL_MODE"); sslmode != "" {
		cfg.Database.SSLMode = sslmode
	}

	// SMTP config
	if smtpHost := os.Getenv("SMTP_HOST"); smtpHost != "" {
		cfg.SMTP.Host = smtpHost
	}
	if smtpPort := os.Getenv("SMTP_PORT"); smtpPort != "" {
		if p, err := strconv.Atoi(smtpPort); err == nil {
			cfg.SMTP.Port = p
		}
	}
	if smtpUser := os.Getenv("SMTP_USERNAME"); smtpUser != "" {
		cfg.SMTP.Username = smtpUser
	}
	if smtpPass := os.Getenv("SMTP_PASSWORD"); smtpPass != "" {
		cfg.SMTP.Password = smtpPass
	}
	if smtpFrom := os.Getenv("SMTP_FROM"); smtpFrom != "" {
		cfg.SMTP.From = smtpFrom
	}

	// Telegram config
	if botToken := os.Getenv("TELEGRAM_BOT_TOKEN"); botToken != "" {
		cfg.Telegram.BotToken = botToken
	}
	if chatID := os.Getenv("TELEGRAM_CHAT_ID"); chatID != "" {
		cfg.Telegram.ChatID = chatID
	}

	// WhatsApp config
	if enabled := os.Getenv("WHATSAPP_ENABLED"); enabled != "" {
		if e, err := strconv.ParseBool(enabled); err == nil {
			cfg.WhatsApp.Enabled = e
		}
	}
	if accountSID := os.Getenv("WHATSAPP_ACCOUNT_SID"); accountSID != "" {
		cfg.WhatsApp.AccountSID = accountSID
	}
	if authToken := os.Getenv("WHATSAPP_AUTH_TOKEN"); authToken != "" {
		cfg.WhatsApp.AuthToken = authToken
	}
	if fromNumber := os.Getenv("WHATSAPP_FROM_NUMBER"); fromNumber != "" {
		cfg.WhatsApp.FromNumber = fromNumber
	}

	// SMS config
	if provider := os.Getenv("SMS_PROVIDER"); provider != "" {
		cfg.SMS.Provider = provider
	}
	if login := os.Getenv("SMS_SMSC_LOGIN"); login != "" {
		cfg.SMS.SMSC.Login = login
	}
	if password := os.Getenv("SMS_SMSC_PASSWORD"); password != "" {
		cfg.SMS.SMSC.Password = password
	}
	if apiURL := os.Getenv("SMS_SMSC_API_URL"); apiURL != "" {
		cfg.SMS.SMSC.APIURL = apiURL
	}
	if sender := os.Getenv("SMS_SMSC_SENDER"); sender != "" {
		cfg.SMS.SMSC.Sender = sender
	}
}

// RabbitMQConfig конфигурация RabbitMQ
type RabbitMQConfig struct {
	URL string `yaml:"url"`
}
