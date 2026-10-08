import sqlite3
import json
import os
import uuid
from datetime import datetime

DB_PATH = "gateway/data/munify.db"
SESSION_DIR = "sessions/andinamun-2026-noruega-GA"
USER_EMAIL = "migration@munify.local"

def main():
    if not os.path.exists(DB_PATH):
        print(f"Database not found at {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # 1. Get or create user
    cursor.execute("SELECT id FROM users WHERE email = ?", (USER_EMAIL,))
    row = cursor.fetchone()
    if row:
        user_id = row[0]
    else:
        user_id = str(uuid.uuid4())
        cursor.execute("INSERT INTO users (id, email, name) VALUES (?, ?, ?)", (user_id, USER_EMAIL, "Migration Admin"))
        print(f"Created user: {user_id}")

    # 2. Read session.json
    with open(os.path.join(SESSION_DIR, "session.json"), "r", encoding="utf-8") as f:
        sess_data = json.load(f)

    # 3. Create Session
    session_id = sess_data.get("id", "andinamun-2026-noruega-GA")
    
    # Check if exists
    cursor.execute("SELECT id FROM mun_sessions WHERE id = ?", (session_id,))
    if cursor.fetchone():
        print(f"Session {session_id} already exists, skipping session insert.")
    else:
        now = datetime.now().isoformat()
        cursor.execute("""
            INSERT INTO mun_sessions 
            (id, user_id, mun_name, committee_id, committee_name, country_assigned, country_code, topic, is_current, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            session_id, user_id, 
            sess_data.get("mun_name", "ANDINAMUN 2026"),
            sess_data.get("committee_id", "GA"),
            sess_data.get("committee_name", "Asamblea General"),
            sess_data.get("country_assigned", "Reino de Noruega"),
            sess_data.get("country_code", "NOR"),
            sess_data.get("topic", ""),
            1 if sess_data.get("is_current") else 0,
            now, now
        ))
        print(f"Inserted session: {session_id}")

    # 4. Migrate Documents
    files_to_migrate = [f for f in sess_data.get("files", []) if f.endswith(".md") or f.endswith(".tex")]
    
    for filename in files_to_migrate:
        filepath = os.path.join(SESSION_DIR, filename)
        if not os.path.exists(filepath):
            print(f"File not found: {filename}")
            continue
            
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
            
        doc_ext = filename.split(".")[-1]
        doc_type = "POSITION_PAPER" if "posicion" in filename.lower() else ("RESEARCH" if "investigacion" in filename.lower() else "DRAFT")
        
        doc_id = str(uuid.uuid4())
        
        # Check if already migrated (by title and session)
        cursor.execute("SELECT id FROM session_documents WHERE session_id = ? AND title = ?", (session_id, filename))
        if cursor.fetchone():
            print(f"Document {filename} already exists in session, skipping.")
            continue

        content_latex = content if doc_ext == "tex" else ""
        content_html = content if doc_ext == "md" else "" # Simplified mapping
        
        now = datetime.now().isoformat()
        cursor.execute("""
            INSERT INTO session_documents 
            (id, session_id, doc_type, title, content_latex, content_html, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            doc_id, session_id, doc_type, filename, 
            content_latex, content_html, "FINAL", now, now
        ))
        print(f"Migrated document: {filename}")

    conn.commit()
    conn.close()
    print("Migration completed successfully!")

if __name__ == "__main__":
    main()
