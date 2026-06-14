package middleware

import (
	"net/http"

	"github.com/labstack/echo/v4"
)

func RequireDoctorOrReception() echo.MiddlewareFunc {
	return RoleMiddleware("doctor", "reception")
}

// RoleMiddleware проверяет, что у пользователя есть одна из необходимых ролей
func RoleMiddleware(requiredRoles ...string) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			role, ok := c.Get("role").(string)
			if !ok {
				return echo.NewHTTPError(http.StatusUnauthorized, "Role not found in token")
			}

			// Проверяем, есть ли у пользователя одна из необходимых ролей
			for _, requiredRole := range requiredRoles {
				if role == requiredRole {
					return next(c) // Роль подходит, продолжаем
				}
			}
			return echo.NewHTTPError(http.StatusForbidden, "Insufficient permissions")
		}
	}
}

// RequireDoctor middleware для эндпоинтов, доступных только врачам
func RequireDoctor() echo.MiddlewareFunc {
	return RoleMiddleware("doctor")
}
func RequireReception() echo.MiddlewareFunc {
	return RoleMiddleware("reception")
}

// RequirePatient middleware для эндпоинтов, доступных только пациентам
func RequirePatient() echo.MiddlewareFunc {
	return RoleMiddleware("patient")
}

// RequireDoctorOrPatient middleware для эндпоинтов, доступных и врачам, и пациентам
func RequireDoctorOrPatient() echo.MiddlewareFunc {
	return RoleMiddleware("doctor", "patient")
}
