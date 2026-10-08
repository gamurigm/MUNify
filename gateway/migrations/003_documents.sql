CREATE TABLE IF NOT EXISTS session_documents (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES mun_sessions(id) ON DELETE CASCADE,
    doc_type TEXT NOT NULL DEFAULT 'POSITION_PAPER',
    title TEXT NOT NULL DEFAULT '',
    content_latex TEXT DEFAULT '',
    content_html TEXT DEFAULT '',
    status TEXT DEFAULT 'DRAFT',
    metadata TEXT DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_docs_session ON session_documents(session_id);
CREATE INDEX IF NOT EXISTS idx_docs_type ON session_documents(doc_type);
