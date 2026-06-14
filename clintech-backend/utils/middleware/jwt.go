package middleware

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/dgrijalva/jwt-go"
	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
)

// min возвращает минимальное из двух чисел
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// RequireDoctorOrPatientOrReception middleware: doctor + patient + reception
func RequireDoctorOrPatientOrReception() echo.MiddlewareFunc {
	return RoleMiddleware("doctor", "patient", "reception")
}

// JWTMiddleware - Middleware для проверки JWT токена
func JWTMiddleware(jwtSecret string) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			// Получаем заголовок Authorization и проверяем его наличие
			authHeader := c.Request().Header.Get("Authorization")
			if authHeader == "" {
				return echo.NewHTTPError(http.StatusUnauthorized, "Missing Authorization header")
			}

			// Проверяем формат заголовка
			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) != 2 || parts[0] != "Bearer" {
				return echo.NewHTTPError(http.StatusUnauthorized, "Invalid Authorization header format")
			}

			// Получаем токен из заголовка
			tokenString := parts[1]

			// Парсим и проверяем токен
			token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
				// Проверяем алгоритм токена
				if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
					return nil, echo.NewHTTPError(http.StatusUnauthorized, "Invalid token signing method")
				}

				// Возвращаем секретный ключ для проверки подписи
				return []byte(jwtSecret), nil
			})

			// Проверяем наличие ошибок и валидность токена
			if err != nil {
				return echo.NewHTTPError(http.StatusUnauthorized, "Invalid or expired token")
			}

			if !token.Valid {
				return echo.NewHTTPError(http.StatusUnauthorized, "Invalid or expired token")
			}

			// Извлекаем данные из токена и добавляем их в контекст
			claims, ok := token.Claims.(jwt.MapClaims)
			if !ok {
				return echo.NewHTTPError(http.StatusUnauthorized, "Invalid token claims")
			}

			// Получаем ID пользователя и преобразуем его в UUID
			var userID uuid.UUID

			// Проверяем тип ID пользователя в токене
			switch id := claims["user_id"].(type) {
			case string:
				// Если строка, парсим её как UUID
				userID, err = uuid.Parse(id)
				if err != nil {
					return echo.NewHTTPError(http.StatusUnauthorized, "Invalid user_id format in token")
				}
			default:
				return echo.NewHTTPError(http.StatusUnauthorized, "Invalid user_id type in token")
			}

			// Сохраняем данные в контексте
			// Сохраняем данные в контексте
			c.Set("user_id", userID)

			// role приводим к строке
			role := ""
			if r, ok := claims["role"].(string); ok {
				role = r
			} else if claims["role"] != nil {
				role = fmt.Sprint(claims["role"])
			}

			// email (если есть)
			email := ""
			if e, ok := claims["email"].(string); ok {
				email = e
				c.Set("email", email)
			}

			// phone (если есть)
			if phone, ok := claims["phone"].(string); ok {
				c.Set("phone", phone)
			}

			// ВАЖНО: распознаём ресепшн по email и ставим роль reception
			// (сейчас в токене ресепшна role="doctor", поэтому без этого он не пройдёт)
			if strings.EqualFold(strings.TrimSpace(email), "reception@example.com") {
				role = "reception"
			}

			c.Set("role", role)

			// Вызываем следующий обработчик
			return next(c)
		}
	}
}
