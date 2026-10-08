CREATE TABLE IF NOT EXISTS mun_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    mun_name TEXT NOT NULL,
    committee_id TEXT NOT NULL,
    committee_name TEXT NOT NULL DEFAULT '',
    country_assigned TEXT NOT NULL,
    country_code TEXT NOT NULL DEFAULT '',
    topic TEXT NOT NULL DEFAULT '',
    start_date DATE,
    end_date DATE,
    is_current BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON mun_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_current ON mun_sessions(is_current);
