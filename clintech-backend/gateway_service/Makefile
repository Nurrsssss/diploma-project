# Gateway Service Makefile

.PHONY: help build run swagger-gen swagger-serve test clean install-deps

# Переменные
APP_NAME=clintech-gateway
BUILD_DIR=build
DOCS_DIR=docs
MAIN_PATH=cmd/api/main.go

# По умолчанию показать help
help: ## Показать список доступных команд
	@echo "Доступные команды:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

install-deps: ## Установить зависимости
	@echo "📦 Установка зависимостей..."
	go mod tidy
	go mod download

build: ## Собрать приложение
	@echo "🔨 Сборка приложения..."
	go build -o $(BUILD_DIR)/$(APP_NAME) $(MAIN_PATH)
	@echo "✅ Приложение собрано: $(BUILD_DIR)/$(APP_NAME)"

run: ## Запустить Gateway в dev режиме
	@echo "🚀 Запуск Gateway..."
	go run $(MAIN_PATH)

swagger-gen: ## Сгенерировать Swagger документацию
	@echo "📚 Генерация Swagger документации..."
	swag init -g $(MAIN_PATH) -o $(DOCS_DIR)
	@echo "✅ Swagger документация обновлена"

swagger-serve: swagger-gen run ## Сгенерировать документацию и запустить сервер
	@echo "Swagger UI доступен по адресу: http://localhost:8800/swagger/"

test: ## Запустить тесты
	@echo "🧪 Запуск тестов..."
	go test -v ./...

test-coverage: ## Запустить тесты с покрытием
	@echo "📊 Запуск тестов с анализом покрытия..."
	go test -coverprofile=coverage.out ./...
	go tool cover -html=coverage.out -o coverage.html
	@echo "✅ Отчет по покрытию: coverage.html"

lint: ## Запустить линтер
	@echo "🔍 Запуск линтера..."
	golangci-lint run

clean: ## Очистить build файлы
	@echo "🧹 Очистка..."
	rm -rf $(BUILD_DIR)
	rm -f coverage.out coverage.html
	@echo "✅ Очистка завершена"

docker-build: ## Собрать Docker образ
	@echo "🐳 Сборка Docker образа..."
	docker build -t $(APP_NAME):latest .
	@echo "✅ Docker образ собран: $(APP_NAME):latest"

docker-run: ## Запустить Docker контейнер
	@echo "🐳 Запуск Docker контейнера..."
	docker run -p 8800:8800 --name $(APP_NAME)-container $(APP_NAME):latest

dev: swagger-gen ## Запустить в режиме разработки (с автогенерацией Swagger)
	@echo "🔥 Режим разработки запущен"
	@echo "📱 Gateway API: http://localhost:8800"
	@echo "📚 Swagger UI: http://localhost:8800/swagger/"
	@echo "Health Check: http://localhost:8800/health"
	go run $(MAIN_PATH)

check: ## Проверить готовность к deployment
	@echo "✅ Проверка готовности..."
	@echo "1. Проверка зависимостей..."
	go mod tidy
	@echo "2. Генерация документации..."
	swag init -g $(MAIN_PATH) -o $(DOCS_DIR)
	@echo "3. Сборка приложения..."
	go build -o $(BUILD_DIR)/$(APP_NAME) $(MAIN_PATH)
	@echo "4. Запуск тестов..."
	go test ./...
	@echo "🎉 Готово к deployment!"

.DEFAULT_GOAL := help 