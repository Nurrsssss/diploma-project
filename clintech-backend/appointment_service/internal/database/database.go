package database

import (
	"fmt"
	"io/ioutil"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/printprince/vitalem/appointment_service/internal/config"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// ConnectDB - подключение к базе данных
func ConnectDB(cfg *config.Config) (*gorm.DB, error) {
	dsn := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		cfg.Database.Host,
		cfg.Database.Port,
		cfg.Database.User,
		cfg.Database.Password,
		cfg.Database.DBName,
		cfg.Database.SSLMode,
	)

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	log.Println("Connected to database successfully")
	return db, nil
}

// RunMigrations - выполнение SQL миграций
func RunMigrations(db *gorm.DB) error {
	log.Println("Running SQL migrations...")

	// Собираем список файлов миграций
	searchDirs := []string{"migrations", "/app/migrations", "."}
	var migrationFiles []string
	for _, dir := range searchDirs {
		files, err := ioutil.ReadDir(dir)
		if err != nil {
			continue
		}
		for _, f := range files {
			name := f.Name()
			if f.IsDir() {
				continue
			}
			if filepath.Ext(name) == ".sql" && strings.HasSuffix(name, ".up.sql") {
				migrationFiles = append(migrationFiles, filepath.Join(dir, name))
			}
		}
	}

	if len(migrationFiles) == 0 {
		// Fallback: старый путь одной миграции
		migrationPath := "migrations/001_create_tables.up.sql"
		migrationSQL, err := readMigrationFile(migrationPath)
		if err != nil {
			return fmt.Errorf("failed to read migration file %s: %w", migrationPath, err)
		}
		if err := db.Exec(migrationSQL).Error; err != nil {
			return fmt.Errorf("failed to run SQL migration: %w", err)
		}
		log.Println("SQL migrations (fallback single file) completed successfully")
		return nil
	}

	// Сортируем по имени (001, 002, 003 ...)
	sort.Strings(migrationFiles)

	for _, path := range migrationFiles {
		migrationSQL, err := readMigrationFile(path)
		if err != nil {
			return fmt.Errorf("failed to read migration file %s: %w", path, err)
		}
		log.Printf("Applying migration: %s\n", filepath.Base(path))
		if err := db.Exec(migrationSQL).Error; err != nil {
			return fmt.Errorf("failed to run migration %s: %w", path, err)
		}
	}

	log.Println("All SQL migrations completed successfully")
	return nil
}

// readMigrationFile - читает содержимое файла миграции
func readMigrationFile(filename string) (string, error) {
	// Пытаемся найти файл в разных местах
	possiblePaths := []string{
		filename,
		filepath.Join(".", filename),
		filepath.Join("/app", filename),
	}

	for _, path := range possiblePaths {
		if _, err := os.Stat(path); err == nil {
			content, err := ioutil.ReadFile(path)
			if err != nil {
				return "", fmt.Errorf("failed to read file %s: %w", path, err)
			}
			return string(content), nil
		}
	}

	return "", fmt.Errorf("migration file %s not found in any of the paths: %v", filename, possiblePaths)
}

// CreateIndexes - создание индексов для оптимизации (оставляем для совместимости, но они уже в SQL миграции)
func CreateIndexes(db *gorm.DB) error {
	log.Println("Additional indexes are already created in SQL migration")
	return nil
}
