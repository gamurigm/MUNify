package session

import "time"

// MUNSession represents a Model UN participation instance.
type MUNSession struct {
	ID              string     `json:"id"`
	UserID          string     `json:"user_id"`
	MUNName         string     `json:"mun_name"`
	CommitteeID     string     `json:"committee_id"`
	CommitteeName   string     `json:"committee_name"`
	CountryAssigned string     `json:"country_assigned"`
	CountryCode     string     `json:"country_code"`
	Topic           string     `json:"topic"`
	StartDate       *time.Time `json:"start_date,omitempty"`
	EndDate         *time.Time `json:"end_date,omitempty"`
	IsCurrent       bool       `json:"is_current"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

// CreateSessionRequest is the JSON body for POST /api/sessions.
type CreateSessionRequest struct {
	MUNName         string `json:"mun_name"`
	CommitteeID     string `json:"committee_id"`
	CommitteeName   string `json:"committee_name"`
	CountryAssigned string `json:"country_assigned"`
	CountryCode     string `json:"country_code"`
	Topic           string `json:"topic"`
	StartDate       string `json:"start_date,omitempty"`
	EndDate         string `json:"end_date,omitempty"`
}
