package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/beereket/vitalem-api-client/internal/client"
	"github.com/gin-gonic/gin"
)

type AuthContextKey string

const (
	UserContextKey = AuthContextKey("user")
)

func AuthMiddleware(identityClient *client.IdentityClient) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Missing or invalid token"})
			return
		}

		token := strings.TrimPrefix(authHeader, "Bearer ")
		userInfo, err := identityClient.ValidateToken(token)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token: " + err.Error()})
			return
		}

		ctx := context.WithValue(c.Request.Context(), UserContextKey, userInfo)
		c.Request = c.Request.WithContext(ctx)

		c.Next()
	}
}
