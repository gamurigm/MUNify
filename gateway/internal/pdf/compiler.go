package pdf

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
)

type compileRequest struct {
	LaTeX string `json:"latex"`
}

// CompileHandler handles POST /api/compile-pdf
func CompileHandler(templatesDir string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req compileRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error":"invalid JSON"}`, http.StatusBadRequest)
			return
		}

		if req.LaTeX == "" {
			http.Error(w, `{"error":"latex field is required"}`, http.StatusBadRequest)
			return
		}

		tmpDir, err := os.MkdirTemp("", "munify_pdf_")
		if err != nil {
			http.Error(w, `{"error":"failed to create temp dir"}`, http.StatusInternalServerError)
			return
		}
		defer os.RemoveAll(tmpDir)

		texPath := filepath.Join(tmpDir, "document.tex")
		pdfPath := filepath.Join(tmpDir, "document.pdf")

		// Write LaTeX source
		if err := os.WriteFile(texPath, []byte(req.LaTeX), 0644); err != nil {
			http.Error(w, `{"error":"failed to write tex file"}`, http.StatusInternalServerError)
			return
		}

		// Copy templates if available
		if templatesDir != "" {
			copyDir(templatesDir, filepath.Join(tmpDir, "templates"))
		}

		// Run pdflatex twice (for references)
		for i := 0; i < 2; i++ {
			cmd := exec.Command("pdflatex", "-interaction=nonstopmode", "-output-directory", tmpDir, texPath)
			cmd.Dir = tmpDir
			output, err := cmd.CombinedOutput()
			if err != nil && i == 1 {
				log.Printf("[PDF] pdflatex error: %s", string(output))
			}
		}

		// Check if PDF was generated
		if _, err := os.Stat(pdfPath); os.IsNotExist(err) {
			// Read log for error details
			logPath := filepath.Join(tmpDir, "document.log")
			logContent, _ := os.ReadFile(logPath)
			tail := string(logContent)
			if len(tail) > 1000 {
				tail = tail[len(tail)-1000:]
			}
			http.Error(w, fmt.Sprintf(`{"error":"pdflatex failed","log":"%s"}`, tail), http.StatusInternalServerError)
			return
		}

		// Serve PDF
		w.Header().Set("Content-Type", "application/pdf")
		w.Header().Set("Content-Disposition", `attachment; filename="MUNify_Document.pdf"`)
		http.ServeFile(w, r, pdfPath)
	}
}

// copyDir copies a directory recursively.
func copyDir(src, dst string) error {
	return filepath.Walk(src, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		relPath, _ := filepath.Rel(src, path)
		dstPath := filepath.Join(dst, relPath)

		if info.IsDir() {
			return os.MkdirAll(dstPath, 0755)
		}

		data, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		return os.WriteFile(dstPath, data, 0644)
	})
}
