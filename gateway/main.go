package main

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/gamurigm/munify-gateway/internal/auth"
	"github.com/gamurigm/munify-gateway/internal/collab"
	"github.com/gamurigm/munify-gateway/internal/document"
	"github.com/gamurigm/munify-gateway/internal/pdf"
	"github.com/gamurigm/munify-gateway/internal/proxy"
	"github.com/gamurigm/munify-gateway/internal/session"

	"github.com/joho/godotenv"
	_ "github.com/mattn/go-sqlite3"
)

func main() {
	// Intentar cargar .env desde la raíz del proyecto o desde el directorio actual
	if err := godotenv.Load("../.env"); err != nil {
		_ = godotenv.Load(".env")
	}

	// ─── Configuration ───
	port := getEnv("PORT", "8080")
	jwtSecret := getEnv("JWT_SECRET", "YmFzZTY0LWVuY29kZWQtbXVuaWZ5LXNlY3JldC1rZXktdGhhdC1pcy1hdC1sZWFzdC0yNTYtYml0cy1sb25n")
	aiEngineURL := getEnv("AI_ENGINE_URL", "http://localhost:8000")
	dbPath := getEnv("DB_PATH", "./data/munify.db")
	frontendOrigin := getEnv("FRONTEND_ORIGIN", "http://localhost:3001")

	// ─── Google OAuth2 ───
	googleClientID := getEnv("GOOGLE_CLIENT_ID", "")
	googleClientSecret := getEnv("GOOGLE_CLIENT_SECRET", "")
	googleRedirectURI := getEnv("GOOGLE_REDIRECT_URI", "http://localhost:8080/api/auth/google/callback")

	// ─── Database ───
	os.MkdirAll(filepath.Dir(dbPath), 0755)
	db, err := sql.Open("sqlite3", dbPath+"?_journal_mode=WAL&_busy_timeout=5000")
	if err != nil {
		log.Fatalf("Failed to open database: %v", err)
	}
	defer db.Close()

	// Run migrations
	runMigrations(db)

	// ─── Repositories & Handlers ───
	sessionRepo := session.NewRepository(db)
	documentRepo := document.NewRepository(db)

	authHandler := auth.NewHandler(db, jwtSecret)
	oauthHandler := auth.NewOAuthHandler(db, jwtSecret, auth.OAuthConfig{
		ClientID:     googleClientID,
		ClientSecret: googleClientSecret,
		RedirectURI:  googleRedirectURI,
		FrontendURL:  frontendOrigin,
	})
	sessionHandler := session.NewHandler(sessionRepo)
	documentHandler := document.NewHandler(documentRepo)

	// ─── Collaboration Hub ───
	collabHub := collab.NewHub()

	// ─── AI Proxy ───
	aiProxy := proxy.AIProxy(aiEngineURL)

	// ─── PDF Compiler ───
	templatesDir := getEnv("TEMPLATES_DIR", "../apps/ai-agents/templates")
	pdfHandler := pdf.CompileHandler(templatesDir)

	// ─── Router ───
	mux := http.NewServeMux()

	// CORS middleware wrapper
	corsHandler := corsMiddleware(frontendOrigin)

	// Auth middleware
	authMiddleware := auth.Middleware(jwtSecret)

	// ── Public routes ──
	mux.HandleFunc("POST /api/auth/login", authHandler.Login)

	// ── Google OAuth2 ──
	mux.HandleFunc("GET /api/auth/google", oauthHandler.GoogleLogin)
	mux.HandleFunc("GET /api/auth/google/callback", oauthHandler.GoogleCallback)

	// ── Health check ──
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprint(w, `{"status":"ok","service":"munify-gateway","version":"3.0.0"}`)
	})

	// ── Protected routes (require JWT) ──
	// Auth
	mux.Handle("GET /api/auth/me", authMiddleware(http.HandlerFunc(authHandler.Me)))

	// Sessions
	mux.Handle("GET /api/sessions", authMiddleware(http.HandlerFunc(sessionHandler.List)))
	mux.Handle("POST /api/sessions", authMiddleware(http.HandlerFunc(sessionHandler.Create)))
	mux.Handle("GET /api/sessions/{id}", authMiddleware(http.HandlerFunc(sessionHandler.Get)))
	mux.Handle("POST /api/sessions/{id}/activate", authMiddleware(http.HandlerFunc(sessionHandler.SetCurrent)))
	mux.Handle("DELETE /api/sessions/{id}", authMiddleware(http.HandlerFunc(sessionHandler.Delete)))

	// Documents (scoped to sessions)
	mux.Handle("GET /api/sessions/{sessionId}/documents", authMiddleware(http.HandlerFunc(documentHandler.List)))
	mux.Handle("POST /api/sessions/{sessionId}/documents", authMiddleware(http.HandlerFunc(documentHandler.Create)))
	mux.Handle("GET /api/documents/{id}", authMiddleware(http.HandlerFunc(documentHandler.Get)))
	mux.Handle("PATCH /api/documents/{id}", authMiddleware(http.HandlerFunc(documentHandler.Update)))
	mux.Handle("DELETE /api/documents/{id}", authMiddleware(http.HandlerFunc(documentHandler.Delete)))

	// PDF Compilation
	mux.Handle("POST /api/compile-pdf", authMiddleware(http.HandlerFunc(pdfHandler)))

	// AI Proxy (forward everything under /api/ai/ to FastAPI)
	mux.Handle("/api/ai/", authMiddleware(aiProxy))

	// ── WebSocket (no JWT needed for collab in dev mode) ──
	mux.Handle("/ws/collab/", collabHub.Handler())

	// ─── Start Server ───
	handler := corsHandler(mux)

	log.Println("═══════════════════════════════════════════════════")
	log.Println("  MUNify Gateway v3.0.0")
	log.Println("═══════════════════════════════════════════════════")
	log.Printf("  HTTP Server:    http://localhost:%s", port)
	log.Printf("  AI Engine:      %s", aiEngineURL)
	log.Printf("  WebSocket:      ws://localhost:%s/ws/collab/", port)
	log.Printf("  Database:       %s", dbPath)
	log.Printf("  Frontend CORS:  %s", frontendOrigin)
	log.Println("═══════════════════════════════════════════════════")

	if err := http.ListenAndServe(":"+port, handler); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}

// corsMiddleware adds CORS headers for frontend integration.
func corsMiddleware(allowedOrigin string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")
			// Allow the configured origin or any localhost for dev
			if origin == allowedOrigin || strings.HasPrefix(origin, "http://localhost") {
				w.Header().Set("Access-Control-Allow-Origin", origin)
			}
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
			w.Header().Set("Access-Control-Allow-Credentials", "true")

			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// runMigrations executes SQL migration files.
func runMigrations(db *sql.DB) {
	migrationsDir := filepath.Join(".", "migrations")
	files, err := os.ReadDir(migrationsDir)
	if err != nil {
		log.Printf("[DB] No migrations directory found, skipping: %v", err)
		return
	}

	for _, f := range files {
		if !strings.HasSuffix(f.Name(), ".sql") {
			continue
		}
		content, err := os.ReadFile(filepath.Join(migrationsDir, f.Name()))
		if err != nil {
			log.Printf("[DB] Failed to read migration %s: %v", f.Name(), err)
			continue
		}
		if _, err := db.Exec(string(content)); err != nil {
			log.Printf("[DB] Migration %s error (may already exist): %v", f.Name(), err)
		} else {
			log.Printf("[DB] Migration applied: %s", f.Name())
		}
	}
}

func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}
