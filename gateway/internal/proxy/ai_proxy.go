package proxy

import (
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
)

// AIProxy creates a reverse proxy to the AI Engine (FastAPI).
func AIProxy(targetURL string) http.Handler {
	target, err := url.Parse(targetURL)
	if err != nil {
		log.Fatalf("[PROXY] Invalid AI Engine URL: %v", err)
	}

	proxy := httputil.NewSingleHostReverseProxy(target)

	// Custom director to rewrite paths: /api/ai/* → /api/v1/*
	originalDirector := proxy.Director
	proxy.Director = func(req *http.Request) {
		originalDirector(req)
		// Strip /api/ai prefix and forward as /api/v1
		req.URL.Path = "/api/v1" + req.URL.Path[len("/api/ai"):]
		req.Host = target.Host
		log.Printf("[PROXY] → %s %s", req.Method, req.URL.String())
	}

	proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
		log.Printf("[PROXY] AI Engine unreachable: %v", err)
		http.Error(w, `{"error":"AI Engine unavailable","detail":"FastAPI service at `+targetURL+` is not responding"}`, http.StatusBadGateway)
	}

	return proxy
}
