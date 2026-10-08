package document

import (
	"database/sql"
	"time"

	"github.com/google/uuid"
)

// Repository handles database operations for session documents.
type Repository struct {
	db *sql.DB
}

// NewRepository creates a document repository.
func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

// Create inserts a new document.
func (r *Repository) Create(sessionID string, req CreateDocumentRequest) (*SessionDocument, error) {
	id := uuid.New().String()
	now := time.Now()
	docType := req.DocType
	if docType == "" {
		docType = "POSITION_PAPER"
	}

	_, err := r.db.Exec(`
		INSERT INTO session_documents (id, session_id, doc_type, title, content_latex, content_html, status, metadata, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?, ?)`,
		id, sessionID, docType, req.Title, req.ContentLaTeX, req.ContentHTML, req.Metadata, now, now,
	)
	if err != nil {
		return nil, err
	}

	return &SessionDocument{
		ID: id, SessionID: sessionID, DocType: docType, Title: req.Title,
		ContentLaTeX: req.ContentLaTeX, ContentHTML: req.ContentHTML,
		Status: "DRAFT", Metadata: req.Metadata, CreatedAt: now, UpdatedAt: now,
	}, nil
}

// ListBySession returns all documents for a session.
func (r *Repository) ListBySession(sessionID string) ([]SessionDocument, error) {
	rows, err := r.db.Query(`
		SELECT id, session_id, doc_type, title, status, metadata, created_at, updated_at
		FROM session_documents WHERE session_id = ? ORDER BY updated_at DESC`, sessionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var docs []SessionDocument
	for rows.Next() {
		var d SessionDocument
		if err := rows.Scan(&d.ID, &d.SessionID, &d.DocType, &d.Title, &d.Status, &d.Metadata, &d.CreatedAt, &d.UpdatedAt); err != nil {
			continue
		}
		docs = append(docs, d)
	}
	return docs, nil
}

// GetByID returns a single document with full content.
func (r *Repository) GetByID(id string) (*SessionDocument, error) {
	var d SessionDocument
	err := r.db.QueryRow(`
		SELECT id, session_id, doc_type, title, content_latex, content_html, status, metadata, created_at, updated_at
		FROM session_documents WHERE id = ?`, id).
		Scan(&d.ID, &d.SessionID, &d.DocType, &d.Title, &d.ContentLaTeX, &d.ContentHTML, &d.Status, &d.Metadata, &d.CreatedAt, &d.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &d, nil
}

// Update modifies an existing document.
func (r *Repository) Update(id string, req UpdateDocumentRequest) error {
	now := time.Now()
	if req.Title != nil {
		r.db.Exec(`UPDATE session_documents SET title = ?, updated_at = ? WHERE id = ?`, *req.Title, now, id)
	}
	if req.ContentLaTeX != nil {
		r.db.Exec(`UPDATE session_documents SET content_latex = ?, updated_at = ? WHERE id = ?`, *req.ContentLaTeX, now, id)
	}
	if req.ContentHTML != nil {
		r.db.Exec(`UPDATE session_documents SET content_html = ?, updated_at = ? WHERE id = ?`, *req.ContentHTML, now, id)
	}
	if req.Status != nil {
		r.db.Exec(`UPDATE session_documents SET status = ?, updated_at = ? WHERE id = ?`, *req.Status, now, id)
	}
	if req.Metadata != nil {
		r.db.Exec(`UPDATE session_documents SET metadata = ?, updated_at = ? WHERE id = ?`, *req.Metadata, now, id)
	}
	return nil
}

// Delete removes a document.
func (r *Repository) Delete(id string) error {
	_, err := r.db.Exec(`DELETE FROM session_documents WHERE id = ?`, id)
	return err
}
