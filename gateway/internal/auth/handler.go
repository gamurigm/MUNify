package auth

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"time"
)

// Handler exposes auth endpoints.
type Handler struct {
	db        *sql.DB
	jwtSecret string
}

// NewHandler creates an auth handler.
func NewHandler(db *sql.DB, jwtSecret string) *Handler {
	return &Handler{db: db, jwtSecret: jwtSecret}
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Name     string `json:"name"`
}

type loginResponse struct {
	Token string `json:"token"`
	Name  string `json:"name"`
}

// Login handles POST /api/auth/login — simplified for dev (no password hash).
func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid JSON"}`, http.StatusBadRequest)
		return
	}

	if req.Email == "" {
		http.Error(w, `{"error":"email is required"}`, http.StatusBadRequest)
		return
	}

	// Upsert user
	name := req.Name
	if name == "" {
		name = req.Email
	}

	var userID string
	err := h.db.QueryRow(`SELECT id FROM users WHERE email = ?`, req.Email).Scan(&userID)
	if err == sql.ErrNoRows {
		userID = generateUUID()
		_, err = h.db.Exec(`INSERT INTO users (id, email, name) VALUES (?, ?, ?)`, userID, req.Email, name)
		if err != nil {
			log.Printf("[AUTH] Insert user error: %v", err)
			http.Error(w, `{"error":"failed to create user"}`, http.StatusInternalServerError)
			return
		}
	} else if err != nil {
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}

	token, err := GenerateToken(h.jwtSecret, userID, req.Email, 24*time.Hour)
	if err != nil {
		http.Error(w, `{"error":"failed to generate token"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(loginResponse{Token: token, Name: name})
}

// Me handles GET /api/auth/me — returns current user info from JWT.
func (h *Handler) Me(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(string)
	email := r.Context().Value("user_email").(string)

	var name string
	h.db.QueryRow(`SELECT name FROM users WHERE id = ?`, userID).Scan(&name)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"id":    userID,
		"email": email,
		"name":  name,
	})
}

func generateUUID() string {
	// Simple UUID using google/uuid
	// We import it in the module
	return time.Now().Format("20060102150405") + "-" + randomHex(8)
}

func randomHex(n int) string {
	const chars = "abcdef0123456789"
	b := make([]byte, n)
	for i := range b {
		b[i] = chars[time.Now().UnixNano()%int64(len(chars))]
		time.Sleep(1) // ensure different values
	}
	return string(b)
}
