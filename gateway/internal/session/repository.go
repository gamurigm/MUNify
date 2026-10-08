package session

import (
	"database/sql"
	"time"

	"github.com/google/uuid"
)

// Repository handles database operations for MUN sessions.
type Repository struct {
	db *sql.DB
}

// NewRepository creates a new session repository.
func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

// Create inserts a new MUN session and marks it as current.
func (r *Repository) Create(userID string, req CreateSessionRequest) (*MUNSession, error) {
	id := uuid.New().String()
	now := time.Now()

	// Unset previous current sessions for this user
	_, _ = r.db.Exec(`UPDATE mun_sessions SET is_current = FALSE WHERE user_id = ? AND is_current = TRUE`, userID)

	var startDate, endDate *time.Time
	if req.StartDate != "" {
		t, err := time.Parse("2006-01-02", req.StartDate)
		if err == nil {
			startDate = &t
		}
	}
	if req.EndDate != "" {
		t, err := time.Parse("2006-01-02", req.EndDate)
		if err == nil {
			endDate = &t
		}
	}

	_, err := r.db.Exec(`
		INSERT INTO mun_sessions (id, user_id, mun_name, committee_id, committee_name, country_assigned, country_code, topic, start_date, end_date, is_current, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, ?, ?)`,
		id, userID, req.MUNName, req.CommitteeID, req.CommitteeName,
		req.CountryAssigned, req.CountryCode, req.Topic,
		startDate, endDate, now, now,
	)
	if err != nil {
		return nil, err
	}

	return &MUNSession{
		ID: id, UserID: userID, MUNName: req.MUNName,
		CommitteeID: req.CommitteeID, CommitteeName: req.CommitteeName,
		CountryAssigned: req.CountryAssigned, CountryCode: req.CountryCode,
		Topic: req.Topic, StartDate: startDate, EndDate: endDate,
		IsCurrent: true, CreatedAt: now, UpdatedAt: now,
	}, nil
}

// ListByUser returns all sessions for a user, ordered by most recent.
func (r *Repository) ListByUser(userID string) ([]MUNSession, error) {
	rows, err := r.db.Query(`
		SELECT id, user_id, mun_name, committee_id, committee_name, country_assigned, country_code, topic, start_date, end_date, is_current, created_at, updated_at
		FROM mun_sessions WHERE user_id = ? ORDER BY created_at DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var sessions []MUNSession
	for rows.Next() {
		var s MUNSession
		err := rows.Scan(&s.ID, &s.UserID, &s.MUNName, &s.CommitteeID, &s.CommitteeName,
			&s.CountryAssigned, &s.CountryCode, &s.Topic,
			&s.StartDate, &s.EndDate, &s.IsCurrent, &s.CreatedAt, &s.UpdatedAt)
		if err != nil {
			continue
		}
		sessions = append(sessions, s)
	}
	return sessions, nil
}

// GetByID returns a single session.
func (r *Repository) GetByID(id string) (*MUNSession, error) {
	var s MUNSession
	err := r.db.QueryRow(`
		SELECT id, user_id, mun_name, committee_id, committee_name, country_assigned, country_code, topic, start_date, end_date, is_current, created_at, updated_at
		FROM mun_sessions WHERE id = ?`, id).
		Scan(&s.ID, &s.UserID, &s.MUNName, &s.CommitteeID, &s.CommitteeName,
			&s.CountryAssigned, &s.CountryCode, &s.Topic,
			&s.StartDate, &s.EndDate, &s.IsCurrent, &s.CreatedAt, &s.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &s, nil
}

// SetCurrent marks a session as the active one and unsets others.
func (r *Repository) SetCurrent(userID, sessionID string) error {
	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	_, _ = tx.Exec(`UPDATE mun_sessions SET is_current = FALSE WHERE user_id = ?`, userID)
	_, err = tx.Exec(`UPDATE mun_sessions SET is_current = TRUE WHERE id = ? AND user_id = ?`, sessionID, userID)
	if err != nil {
		tx.Rollback()
		return err
	}
	return tx.Commit()
}

// Delete removes a session and its documents (cascade).
func (r *Repository) Delete(id string) error {
	_, err := r.db.Exec(`DELETE FROM mun_sessions WHERE id = ?`, id)
	return err
}
