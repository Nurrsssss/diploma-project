package middleware

import (
	"net/http"

	"github.com/beereket/vitalem-api-client/internal/client"
	"github.com/gin-gonic/gin"
)

func RequireRole(roles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		userInfo, ok := c.Request.Context().Value(UserContextKey).(*client.UserInfo)
		if !ok || userInfo == nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
			return
		}

		for _, role := range roles {
			if userInfo.Role == role {
				c.Next()
				return
			}
		}

		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Access denied: insufficient permissions"})
	}
}
