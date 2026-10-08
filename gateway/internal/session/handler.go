package session

import (
	"encoding/json"
	"log"
	"net/http"
)

// Handler exposes HTTP endpoints for MUN sessions.
type Handler struct {
	repo *Repository
}

// NewHandler creates a session handler.
func NewHandler(repo *Repository) *Handler {
	return &Handler{repo: repo}
}

// Create handles POST /api/sessions
func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(string)

	var req CreateSessionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid JSON"}`, http.StatusBadRequest)
		return
	}

	if req.MUNName == "" || req.CommitteeID == "" || req.CountryAssigned == "" {
		http.Error(w, `{"error":"mun_name, committee_id, and country_assigned are required"}`, http.StatusBadRequest)
		return
	}

	session, err := h.repo.Create(userID, req)
	if err != nil {
		log.Printf("[SESSION] Create error: %v", err)
		http.Error(w, `{"error":"failed to create session"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(session)
}

// List handles GET /api/sessions
func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(string)

	sessions, err := h.repo.ListByUser(userID)
	if err != nil {
		http.Error(w, `{"error":"failed to list sessions"}`, http.StatusInternalServerError)
		return
	}
	if sessions == nil {
		sessions = []MUNSession{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"sessions": sessions})
}

// Get handles GET /api/sessions/{id}
func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	sessionID := r.PathValue("id")
	session, err := h.repo.GetByID(sessionID)
	if err != nil {
		http.Error(w, `{"error":"session not found"}`, http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(session)
}

// SetCurrent handles POST /api/sessions/{id}/activate
func (h *Handler) SetCurrent(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(string)
	sessionID := r.PathValue("id")

	if err := h.repo.SetCurrent(userID, sessionID); err != nil {
		http.Error(w, `{"error":"failed to activate session"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "activated", "session_id": sessionID})
}

// Delete handles DELETE /api/sessions/{id}
func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	sessionID := r.PathValue("id")
	if err := h.repo.Delete(sessionID); err != nil {
		http.Error(w, `{"error":"failed to delete session"}`, http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
