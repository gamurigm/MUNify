package document

import (
	"encoding/json"
	"log"
	"net/http"
)

// Handler exposes HTTP endpoints for session documents.
type Handler struct {
	repo *Repository
}

// NewHandler creates a document handler.
func NewHandler(repo *Repository) *Handler {
	return &Handler{repo: repo}
}

// Create handles POST /api/sessions/{sessionId}/documents
func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	sessionID := r.PathValue("sessionId")

	var req CreateDocumentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid JSON"}`, http.StatusBadRequest)
		return
	}
	if req.Title == "" {
		req.Title = "Documento sin título"
	}

	doc, err := h.repo.Create(sessionID, req)
	if err != nil {
		log.Printf("[DOC] Create error: %v", err)
		http.Error(w, `{"error":"failed to create document"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(doc)
}

// List handles GET /api/sessions/{sessionId}/documents
func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	sessionID := r.PathValue("sessionId")

	docs, err := h.repo.ListBySession(sessionID)
	if err != nil {
		http.Error(w, `{"error":"failed to list documents"}`, http.StatusInternalServerError)
		return
	}
	if docs == nil {
		docs = []SessionDocument{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"documents": docs})
}

// Get handles GET /api/documents/{id}
func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	docID := r.PathValue("id")
	doc, err := h.repo.GetByID(docID)
	if err != nil {
		http.Error(w, `{"error":"document not found"}`, http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(doc)
}

// Update handles PATCH /api/documents/{id}
func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	docID := r.PathValue("id")

	var req UpdateDocumentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid JSON"}`, http.StatusBadRequest)
		return
	}

	if err := h.repo.Update(docID, req); err != nil {
		http.Error(w, `{"error":"failed to update document"}`, http.StatusInternalServerError)
		return
	}

	doc, _ := h.repo.GetByID(docID)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(doc)
}

// Delete handles DELETE /api/documents/{id}
func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	docID := r.PathValue("id")
	if err := h.repo.Delete(docID); err != nil {
		http.Error(w, `{"error":"failed to delete document"}`, http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
