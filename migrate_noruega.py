import requests
import json
import os

GATEWAY_URL = "http://localhost:8080"
SESSION_DIR = "sessions/andinamun-2026-noruega-GA"

def main():
    # 1. Login to get token
    login_res = requests.post(f"{GATEWAY_URL}/api/auth/login", json={
        "email": "migration@munify.local",
        "name": "Migration Admin",
        "password": "none"  # Dev mode ignores password
    })
    
    if login_res.status_code != 200:
        print("Login failed:", login_res.text)
        return
        
    token = login_res.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # 2. Read session.json
    with open(f"{SESSION_DIR}/session.json", "r", encoding="utf-8") as f:
        sess_data = json.load(f)
        
    # 3. Create Session
    create_sess_res = requests.post(f"{GATEWAY_URL}/api/sessions", headers=headers, json={
        "mun_name": sess_data.get("mun_name", "Migrated MUN"),
        "committee_id": sess_data.get("committee_id", "GA"),
        "committee_name": sess_data.get("committee_name", "Asamblea General"),
        "country_assigned": sess_data.get("country_assigned", "Noruega"),
        "country_code": sess_data.get("country_code", "NOR"),
        "topic": sess_data.get("topic", ""),
        "start_date": "2026-04-01",
        "end_date": "2026-04-05"
    })
    
    if create_sess_res.status_code != 201:
        print("Failed to create session:", create_sess_res.text)
        return
        
    new_session_id = create_sess_res.json()["id"]
    print(f"Session created with ID: {new_session_id}")
    
    # 4. Migrate Text/Markdown/Tex Files as Documents
    files_to_migrate = [f for f in sess_data.get("files", []) if f.endswith(".md") or f.endswith(".tex")]
    
    for filename in files_to_migrate:
        filepath = os.path.join(SESSION_DIR, filename)
        if not os.path.exists(filepath):
            print(f"File not found: {filename}")
            continue
            
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
            
        doc_ext = filename.split(".")[-1]
        
        doc_payload = {
            "title": filename,
            "doc_type": "markdown" if doc_ext == "md" else "latex"
        }
        
        if doc_ext == "md":
            # Store markdown as html or metadata just to keep it
            doc_payload["content_html"] = content
        else:
            doc_payload["content_latex"] = content
            
        doc_res = requests.post(f"{GATEWAY_URL}/api/sessions/{new_session_id}/documents", headers=headers, json=doc_payload)
        if doc_res.status_code == 201:
            print(f"Migrated document: {filename}")
        else:
            print(f"Failed to migrate document {filename}: {doc_res.text}")
            
    print("Migration completed!")

if __name__ == "__main__":
    main()
