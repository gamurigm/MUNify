package document

import "time"

// SessionDocument represents a document within a MUN session.
type SessionDocument struct {
	ID           string    `json:"id"`
	SessionID    string    `json:"session_id"`
	DocType      string    `json:"doc_type"`
	Title        string    `json:"title"`
	ContentLaTeX string    `json:"content_latex,omitempty"`
	ContentHTML  string    `json:"content_html,omitempty"`
	Status       string    `json:"status"`
	Metadata     string    `json:"metadata,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// CreateDocumentRequest is the JSON body for creating documents.
type CreateDocumentRequest struct {
	DocType      string `json:"doc_type"`
	Title        string `json:"title"`
	ContentLaTeX string `json:"content_latex,omitempty"`
	ContentHTML  string `json:"content_html,omitempty"`
	Metadata     string `json:"metadata,omitempty"`
}

// UpdateDocumentRequest is the JSON body for updating documents.
type UpdateDocumentRequest struct {
	Title        *string `json:"title,omitempty"`
	ContentLaTeX *string `json:"content_latex,omitempty"`
	ContentHTML  *string `json:"content_html,omitempty"`
	Status       *string `json:"status,omitempty"`
	Metadata     *string `json:"metadata,omitempty"`
}
