package auth

import (
	"context"
	"net/http"
	"strings"
)

// Middleware validates JWT tokens and injects user_id into context.
func Middleware(secret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				http.Error(w, `{"error":"missing authorization header"}`, http.StatusUnauthorized)
				return
			}

			tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
			if tokenStr == authHeader {
				http.Error(w, `{"error":"invalid authorization format"}`, http.StatusUnauthorized)
				return
			}

			claims, err := ValidateToken(secret, tokenStr)
			if err != nil {
				http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusUnauthorized)
				return
			}

			// Inject user info into request context
			ctx := context.WithValue(r.Context(), "user_id", claims.Sub)
			ctx = context.WithValue(ctx, "user_email", claims.Email)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}
