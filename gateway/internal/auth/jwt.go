package auth

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
)

// Claims represents the JWT payload.
type Claims struct {
	Sub   string `json:"sub"`
	Email string `json:"email"`
	Exp   int64  `json:"exp"`
	Iat   int64  `json:"iat"`
}

// GenerateToken creates a new JWT token.
func GenerateToken(secret, userID, email string, expiration time.Duration) (string, error) {
	header := base64URLEncode([]byte(`{"alg":"HS256","typ":"JWT"}`))

	claims := Claims{
		Sub:   userID,
		Email: email,
		Iat:   time.Now().Unix(),
		Exp:   time.Now().Add(expiration).Unix(),
	}
	claimsJSON, _ := json.Marshal(claims)
	payload := base64URLEncode(claimsJSON)

	signature := sign(secret, header+"."+payload)

	return header + "." + payload + "." + signature, nil
}

// ValidateToken parses and validates a JWT, returning the claims.
func ValidateToken(secret, tokenStr string) (*Claims, error) {
	parts := strings.Split(tokenStr, ".")
	if len(parts) != 3 {
		return nil, errors.New("invalid token format")
	}

	expectedSig := sign(secret, parts[0]+"."+parts[1])
	if !hmac.Equal([]byte(parts[2]), []byte(expectedSig)) {
		return nil, errors.New("invalid signature")
	}

	claimsJSON, err := base64URLDecode(parts[1])
	if err != nil {
		return nil, fmt.Errorf("invalid payload: %w", err)
	}

	var claims Claims
	if err := json.Unmarshal(claimsJSON, &claims); err != nil {
		return nil, fmt.Errorf("invalid claims: %w", err)
	}

	if time.Now().Unix() > claims.Exp {
		return nil, errors.New("token expired")
	}

	return &claims, nil
}

func sign(secret, data string) string {
	h := hmac.New(sha256.New, []byte(secret))
	h.Write([]byte(data))
	return base64URLEncode(h.Sum(nil))
}

func base64URLEncode(data []byte) string {
	return strings.TrimRight(base64.URLEncoding.EncodeToString(data), "=")
}

func base64URLDecode(s string) ([]byte, error) {
	// Add padding if needed
	switch len(s) % 4 {
	case 2:
		s += "=="
	case 3:
		s += "="
	}
	return base64.URLEncoding.DecodeString(s)
}
