package auth

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// OAuthConfig holds Google OAuth2 configuration.
type OAuthConfig struct {
	ClientID     string
	ClientSecret string
	RedirectURI  string
	FrontendURL  string
}

// OAuthHandler handles Google OAuth2 flow.
type OAuthHandler struct {
	db        *sql.DB
	jwtSecret string
	oauth     OAuthConfig
}

// NewOAuthHandler creates a new OAuth handler.
func NewOAuthHandler(db *sql.DB, jwtSecret string, oauthCfg OAuthConfig) *OAuthHandler {
	return &OAuthHandler{db: db, jwtSecret: jwtSecret, oauth: oauthCfg}
}

// GoogleLogin redirects the user to Google's OAuth2 consent screen.
func (h *OAuthHandler) GoogleLogin(w http.ResponseWriter, r *http.Request) {
	authURL := fmt.Sprintf(
		"https://accounts.google.com/o/oauth2/v2/auth?client_id=%s&redirect_uri=%s&response_type=code&scope=%s&access_type=offline&prompt=consent",
		url.QueryEscape(h.oauth.ClientID),
		url.QueryEscape(h.oauth.RedirectURI),
		url.QueryEscape("openid email profile"),
	)
	http.Redirect(w, r, authURL, http.StatusTemporaryRedirect)
}

// GoogleCallback handles the OAuth2 callback from Google.
func (h *OAuthHandler) GoogleCallback(w http.ResponseWriter, r *http.Request) {
	code := r.URL.Query().Get("code")
	if code == "" {
		http.Redirect(w, r, h.oauth.FrontendURL+"/login?error=no_code", http.StatusTemporaryRedirect)
		return
	}

	// 1. Exchange code for tokens
	tokenData, err := h.exchangeCode(code)
	if err != nil {
		log.Printf("[OAUTH] Token exchange error: %v", err)
		http.Redirect(w, r, h.oauth.FrontendURL+"/login?error=token_exchange", http.StatusTemporaryRedirect)
		return
	}

	// 2. Get user info from Google
	userInfo, err := h.getUserInfo(tokenData.AccessToken)
	if err != nil {
		log.Printf("[OAUTH] User info error: %v", err)
		http.Redirect(w, r, h.oauth.FrontendURL+"/login?error=user_info", http.StatusTemporaryRedirect)
		return
	}

	// 3. Upsert user in DB
	userID, err := h.upsertUser(userInfo)
	if err != nil {
		log.Printf("[OAUTH] User upsert error: %v", err)
		http.Redirect(w, r, h.oauth.FrontendURL+"/login?error=db_error", http.StatusTemporaryRedirect)
		return
	}

	// 4. Generate JWT
	token, err := GenerateToken(h.jwtSecret, userID, userInfo.Email, 24*time.Hour)
	if err != nil {
		log.Printf("[OAUTH] JWT generation error: %v", err)
		http.Redirect(w, r, h.oauth.FrontendURL+"/login?error=jwt_error", http.StatusTemporaryRedirect)
		return
	}

	// 5. Redirect to frontend callback with token
	redirectURL := fmt.Sprintf("%s/auth/callback?token=%s", h.oauth.FrontendURL, url.QueryEscape(token))
	log.Printf("[OAUTH] Login successful for %s, redirecting...", userInfo.Email)
	http.Redirect(w, r, redirectURL, http.StatusTemporaryRedirect)
}

// --- Google API Structs ---

type googleTokenResponse struct {
	AccessToken  string `json:"access_token"`
	TokenType    string `json:"token_type"`
	ExpiresIn    int    `json:"expires_in"`
	RefreshToken string `json:"refresh_token,omitempty"`
	IDToken      string `json:"id_token,omitempty"`
}

type googleUserInfo struct {
	ID            string `json:"id"`
	Email         string `json:"email"`
	VerifiedEmail bool   `json:"verified_email"`
	Name          string `json:"name"`
	Picture       string `json:"picture"`
}

// --- Internal helpers ---

func (h *OAuthHandler) exchangeCode(code string) (*googleTokenResponse, error) {
	data := url.Values{
		"code":          {code},
		"client_id":     {h.oauth.ClientID},
		"client_secret": {h.oauth.ClientSecret},
		"redirect_uri":  {h.oauth.RedirectURI},
		"grant_type":    {"authorization_code"},
	}

	resp, err := http.Post("https://oauth2.googleapis.com/token", "application/x-www-form-urlencoded", strings.NewReader(data.Encode()))
	if err != nil {
		return nil, fmt.Errorf("token request failed: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("token exchange returned %d: %s", resp.StatusCode, string(body))
	}

	var tokenResp googleTokenResponse
	if err := json.Unmarshal(body, &tokenResp); err != nil {
		return nil, fmt.Errorf("failed to parse token response: %w", err)
	}

	return &tokenResp, nil
}

func (h *OAuthHandler) getUserInfo(accessToken string) (*googleUserInfo, error) {
	req, _ := http.NewRequest("GET", "https://www.googleapis.com/oauth2/v2/userinfo", nil)
	req.Header.Set("Authorization", "Bearer "+accessToken)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("user info request failed: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("user info returned %d: %s", resp.StatusCode, string(body))
	}

	var userInfo googleUserInfo
	if err := json.Unmarshal(body, &userInfo); err != nil {
		return nil, fmt.Errorf("failed to parse user info: %w", err)
	}

	return &userInfo, nil
}

func (h *OAuthHandler) upsertUser(info *googleUserInfo) (string, error) {
	var userID string
	err := h.db.QueryRow(`SELECT id FROM users WHERE email = ?`, info.Email).Scan(&userID)
	if err == sql.ErrNoRows {
		userID = generateUUID()
		_, err = h.db.Exec(
			`INSERT INTO users (id, email, name, avatar_url) VALUES (?, ?, ?, ?)`,
			userID, info.Email, info.Name, info.Picture,
		)
		if err != nil {
			return "", fmt.Errorf("insert user: %w", err)
		}
		log.Printf("[OAUTH] Created new user: %s (%s)", info.Name, info.Email)
	} else if err != nil {
		return "", fmt.Errorf("query user: %w", err)
	} else {
		// Update name and avatar on each login
		_, _ = h.db.Exec(`UPDATE users SET name = ?, avatar_url = ? WHERE id = ?`, info.Name, info.Picture, userID)
		log.Printf("[OAUTH] Existing user login: %s (%s)", info.Name, info.Email)
	}

	return userID, nil
}
