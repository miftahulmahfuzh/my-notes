# Phase 2 Detailed Implementation Plan: Authentication & User Management

## Phase Overview
**Duration**: 7 Days

**Prerequisites**: Phase 1 completed successfully (development environment, database schema, basic API structure)

**Objective**: Implement secure Google OAuth 2.0 authentication system with JWT token management for both backend API and Chrome extension.

**Success Criteria**: Users can authenticate with Google accounts, tokens are managed securely, and session persistence works across browser restarts.

## Clear Objectives & Goals

### Primary Goals
1. ✅ Implement Google OAuth 2.0 authentication flow in backend
2. ✅ Create secure JWT token generation, validation, and refresh system
3. ✅ Build Chrome extension authentication interface compatible with extension security model
4. ✅ Implement user profile management and preferences
5. ✅ Establish secure session management with automatic token refresh

### Security Requirements
- Use OAuth 2.0 with PKCE (Proof Key for Code Exchange)
- Implement proper token storage using Chrome extension storage APIs
- Secure JWT handling with appropriate expiration and refresh mechanisms
- Prevent CSRF and XSS attacks in authentication flow
- Follow Chrome extension security best practices

### Success Metrics
- [ ] Google OAuth flow completes successfully in < 5 seconds
- [ ] JWT tokens are generated, validated, and refreshed automatically
- [ ] Authentication persists across browser sessions
- [ ] All authentication endpoints have proper security headers
- [ ] Token storage uses Chrome extension secure storage APIs
- [ ] Session timeout works correctly (idle timeout, absolute timeout)

---

## Day 1: Google OAuth 2.0 Backend Implementation

### Objectives
- Set up Google OAuth 2.0 credentials and configuration
- Implement OAuth authorization code flow in backend
- Create user registration and login endpoints
- Implement proper state handling and CSRF protection

### Google OAuth Configuration

#### OAuth 2.0 Credentials Setup
```go
// internal/auth/google_config.go
type GoogleConfig struct {
    ClientID     string `yaml:"client_id" env:"GOOGLE_CLIENT_ID" envRequired:"true"`
    ClientSecret string `yaml:"client_secret" env:"GOOGLE_CLIENT_SECRET" envRequired:"true"`
    RedirectURL  string `yaml:"redirect_url" env:"GOOGLE_REDIRECT_URL" envRequired:"true"`
    Scopes       []string `yaml:"scopes" env:"GOOGLE_SCOPES" envDefault:"openid,email,profile"`
}

func (g *GoogleConfig) Validate() error {
    if g.ClientID == "" {
        return errors.New("google client ID is required")
    }
    if g.ClientSecret == "" {
        return errors.New("google client secret is required")
    }
    if g.RedirectURL == "" {
        return errors.New("google redirect URL is required")
    }
    return nil
}
```

#### OAuth Service Implementation
```go
// internal/auth/oauth_service.go
type OAuthService struct {
    config *auth.GoogleConfig
    db     *sql.DB
}

func (s *OAuthService) GetAuthURL(state string) (string, error) {
    config := &oauth2.Config{
        ClientID:     s.config.ClientID,
        ClientSecret: s.config.ClientSecret,
        RedirectURL:  s.config.RedirectURL,
        Scopes:       s.config.Scopes,
        Endpoint:     google.Endpoint,
    }

    // Generate PKCE code verifier and challenge
    codeVerifier := generateCodeVerifier()
    codeChallenge := generateCodeChallenge(codeVerifier)

    // Store code verifier in session/cache
    err := s.storeCodeVerifier(state, codeVerifier)
    if err != nil {
        return "", fmt.Errorf("failed to store code verifier: %w", err)
    }

    authURL := config.AuthCodeURL(state, oauth2.AccessTypeOffline,
        oauth2.S256ChallengeOption(codeChallenge))

    return authURL, nil
}

func (s *OAuthService) ExchangeCodeForToken(code, state, codeVerifier string) (*oauth2.Token, error) {
    config := &oauth2.Config{
        ClientID:     s.config.ClientID,
        ClientSecret: s.config.ClientSecret,
        RedirectURL:  s.config.RedirectURL,
        Scopes:       s.config.Scopes,
        Endpoint:     google.Endpoint,
    }

    // Verify state parameter
    if err := s.verifyState(state); err != nil {
        return nil, fmt.Errorf("invalid state parameter: %w", err)
    }

    // Retrieve stored code verifier
    storedVerifier, err := s.getCodeVerifier(state)
    if err != nil {
        return nil, fmt.Errorf("failed to retrieve code verifier: %w", err)
    }

    token, err := config.Exchange(context.Background(), code,
        oauth2.S256ChallengeOption(storedVerifier))
    if err != nil {
        return nil, fmt.Errorf("failed to exchange code for token: %w", err)
    }

    return token, nil
}
```

### Test Cases - Day 1

#### Test Case 1.1: Google OAuth Configuration Validation
```go
// tests/auth/google_config_test.go
func TestGoogleConfigValidation(t *testing.T) {
    tests := []struct {
        name    string
        config  auth.GoogleConfig
        wantErr bool
    }{
        {
            name: "valid config",
            config: auth.GoogleConfig{
                ClientID:     "test-client-id",
                ClientSecret: "test-client-secret",
                RedirectURL:  "http://localhost:8080/auth/callback",
                Scopes:       []string{"openid", "email", "profile"},
            },
            wantErr: false,
        },
        {
            name: "missing client ID",
            config: auth.GoogleConfig{
                ClientSecret: "test-client-secret",
                RedirectURL:  "http://localhost:8080/auth/callback",
            },
            wantErr: true,
        },
        {
            name: "missing client secret",
            config: auth.GoogleConfig{
                ClientID:    "test-client-id",
                RedirectURL: "http://localhost:8080/auth/callback",
            },
            wantErr: true,
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            err := tt.config.Validate()
            if tt.wantErr {
                assert.Error(t, err)
            } else {
                assert.NoError(t, err)
            }
        })
    }
}
```

#### Test Case 1.2: Auth URL Generation
```go
// tests/auth/oauth_service_test.go
func TestGenerateAuthURL(t *testing.T) {
    service := setupOAuthService(t)

    state := "test-state-123"
    authURL, err := service.GetAuthURL(state)

    assert.NoError(t, err)
    assert.Contains(t, authURL, "accounts.google.com")
    assert.Contains(t, authURL, "client_id="+service.config.ClientID)
    assert.Contains(t, authURL, "state="+state)
    assert.Contains(t, authURL, "code_challenge=") // PKCE challenge present
    assert.Contains(t, authURL, "code_challenge_method=S256")
}
```

#### Test Case 1.3: PKCE Implementation
```go
// tests/auth/pkce_test.go
func TestPKCEImplementation(t *testing.T) {
    verifier := generateCodeVerifier()
    challenge := generateCodeChallenge(verifier)

    // Verify code verifier meets requirements (43-128 chars, valid characters)
    assert.True(t, len(verifier) >= 43 && len(verifier) <= 128)
    assert.True(t, regexp.MustCompile(`^[A-Za-z0-9-._~]+$`).MatchString(verifier))

    // Verify code challenge is valid SHA256 base64url encoding
    assert.True(t, regexp.MustCompile(`^[A-Za-z0-9-_]+$`).MatchString(challenge))
    assert.Equal(t, 43, len(challenge)) // SHA256 base64url without padding
}
```

### Expected Behaviors
- Google OAuth configuration validates correctly
- Auth URLs are generated with proper parameters and PKCE
- State parameters prevent CSRF attacks
- Code verifier and challenge follow OAuth 2.0 PKCE standard
- All sensitive data is handled securely

---

## Day 2: JWT Token System Implementation

### Objectives
- Implement JWT token generation with proper claims
- Create token validation and refresh mechanisms
- Implement secure token storage and retrieval
- Add token expiration and refresh logic

### JWT Token Implementation

#### Token Structure and Claims
```go
// internal/auth/jwt.go
type Claims struct {
    UserID   string `json:"user_id"`
    Email    string `json:"email"`
    Name     string `json:"name"`
    Issuer   string `json:"iss"`
    Audience string `json:"aud"`
    jwt.RegisteredClaims
}

type TokenService struct {
    secretKey     []byte
    accessExpiry  time.Duration
    refreshExpiry time.Duration
    issuer        string
    audience      string
}

func (s *TokenService) GenerateTokenPair(user *User) (*TokenPair, error) {
    now := time.Now()

    // Generate access token
    accessClaims := &Claims{
        UserID:   user.ID.String(),
        Email:    user.Email,
        Name:     user.Name,
        Issuer:   s.issuer,
        Audience: s.audience,
        RegisteredClaims: jwt.RegisteredClaims{
            ExpiresAt: jwt.NewNumericDate(now.Add(s.accessExpiry)),
            IssuedAt:  jwt.NewNumericDate(now),
            NotBefore: jwt.NewNumericDate(now),
            Subject:   user.ID.String(),
            ID:        generateTokenID(),
        },
    }

    accessToken := jwt.NewWithClaims(jwt.SigningMethodHS256, accessClaims)
    accessTokenString, err := accessToken.SignedString(s.secretKey)
    if err != nil {
        return nil, fmt.Errorf("failed to sign access token: %w", err)
    }

    // Generate refresh token
    refreshClaims := &Claims{
        UserID:   user.ID.String(),
        Email:    user.Email,
        Name:     user.Name,
        Issuer:   s.issuer,
        Audience: s.audience,
        RegisteredClaims: jwt.RegisteredClaims{
            ExpiresAt: jwt.NewNumericDate(now.Add(s.refreshExpiry)),
            IssuedAt:  jwt.NewNumericDate(now),
            NotBefore: jwt.NewNumericDate(now),
            Subject:   user.ID.String(),
            ID:        generateTokenID(),
        },
    }

    refreshToken := jwt.NewWithClaims(jwt.SigningMethodHS256, refreshClaims)
    refreshTokenString, err := refreshToken.SignedString(s.secretKey)
    if err != nil {
        return nil, fmt.Errorf("failed to sign refresh token: %w", err)
    }

    return &TokenPair{
        AccessToken:  accessTokenString,
        RefreshToken: refreshTokenString,
        TokenType:    "Bearer",
        ExpiresIn:    int(s.accessExpiry.Seconds()),
    }, nil
}
```

#### Token Validation
```go
// internal/auth/jwt.go
func (s *TokenService) ValidateToken(tokenString string) (*Claims, error) {
    token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
        if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
            return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
        }
        return s.secretKey, nil
    })

    if err != nil {
        return nil, fmt.Errorf("failed to parse token: %w", err)
    }

    claims, ok := token.Claims.(*Claims)
    if !ok || !token.Valid {
        return nil, errors.New("invalid token claims")
    }

    // Additional validation
    if claims.Issuer != s.issuer {
        return nil, errors.New("invalid token issuer")
    }

    if claims.Audience != s.audience {
        return nil, errors.New("invalid token audience")
    }

    return claims, nil
}
```

### Test Cases - Day 2

#### Test Case 2.1: JWT Token Generation
```go
// tests/auth/jwt_test.go
func TestTokenGeneration(t *testing.T) {
    tokenService := setupTokenService(t)
    user := createTestUser(t, nil, "test@example.com")

    tokenPair, err := tokenService.GenerateTokenPair(user)
    assert.NoError(t, err)
    assert.NotEmpty(t, tokenPair.AccessToken)
    assert.NotEmpty(t, tokenPair.RefreshToken)
    assert.Equal(t, "Bearer", tokenPair.TokenType)
    assert.True(t, tokenPair.ExpiresIn > 0)
}
```

#### Test Case 2.2: Token Validation
```go
// tests/auth/jwt_validation_test.go
func TestTokenValidation(t *testing.T) {
    tokenService := setupTokenService(t)
    user := createTestUser(t, nil, "test@example.com")

    // Generate valid token
    tokenPair, err := tokenService.GenerateTokenPair(user)
    require.NoError(t, err)

    // Validate token
    claims, err := tokenService.ValidateToken(tokenPair.AccessToken)
    assert.NoError(t, err)
    assert.Equal(t, user.ID.String(), claims.UserID)
    assert.Equal(t, user.Email, claims.Email)
    assert.Equal(t, user.Name, claims.Name)
}
```

#### Test Case 2.3: Token Expiration
```go
// tests/auth/token_expiry_test.go
func TestTokenExpiration(t *testing.T) {
    tokenService := &TokenService{
        secretKey:     []byte("test-secret"),
        accessExpiry:  1 * time.Millisecond, // Very short expiry
        refreshExpiry: 24 * time.Hour,
        issuer:        "notes-app",
        audience:      "notes-users",
    }

    user := createTestUser(t, nil, "test@example.com")
    tokenPair, err := tokenService.GenerateTokenPair(user)
    require.NoError(t, err)

    // Wait for token to expire
    time.Sleep(10 * time.Millisecond)

    // Token should be expired
    _, err = tokenService.ValidateToken(tokenPair.AccessToken)
    assert.Error(t, err)
    assert.Contains(t, err.Error(), "token is expired")
}
```

#### Test Case 2.4: Token Refresh
```go
// tests/auth/token_refresh_test.go
func TestTokenRefresh(t *testing.T) {
    tokenService := setupTokenService(t)
    user := createTestUser(t, nil, "test@example.com")

    // Generate initial tokens
    originalTokens, err := tokenService.GenerateTokenPair(user)
    require.NoError(t, err)

    // Simulate token refresh
    newClaims, err := tokenService.ValidateToken(originalTokens.RefreshToken)
    assert.NoError(t, err)

    // Generate new token pair
    newTokens, err := tokenService.GenerateTokenPair(user)
    assert.NoError(t, err)

    // New tokens should be different
    assert.NotEqual(t, originalTokens.AccessToken, newTokens.AccessToken)
    assert.NotEqual(t, originalTokens.RefreshToken, newTokens.RefreshToken)
}
```

### Expected Behaviors
- JWT tokens contain proper claims and metadata
- Token validation prevents tampering and forgery
- Token expiration is enforced correctly
- Refresh tokens can generate new access tokens
- All operations handle errors gracefully

---

## Day 3: Authentication API Endpoints

### Objectives
- Create OAuth authentication endpoints
- Implement token refresh endpoints
- Add user registration/login flows
- Implement proper error handling and response formatting

### Authentication Endpoints

#### OAuth Authentication Flow
```go
// internal/handlers/auth.go
type AuthHandler struct {
    oauthService  *auth.OAuthService
    tokenService  *auth.TokenService
    userService   *UserService
    sessionStore  sessions.Store
}

// GET /api/v1/auth/google
func (h *AuthHandler) GoogleAuth(w http.ResponseWriter, r *http.Request) {
    // Generate state parameter for CSRF protection
    state := generateSecureState()

    // Store state in session
    session := sessions.Get(r, "auth-session")
    session.Values["oauth_state"] = state
    session.Values["oauth_redirect"] = r.URL.Query().Get("redirect")
    session.Save(r, w)

    // Generate auth URL
    authURL, err := h.oauthService.GetAuthURL(state)
    if err != nil {
        respondWithError(w, http.StatusInternalServerError, "Failed to generate auth URL")
        return
    }

    respondWithJSON(w, http.StatusOK, map[string]string{
        "auth_url": authURL,
        "state":    state,
    })
}

// POST /api/v1/auth/google/callback
func (h *AuthHandler) GoogleCallback(w http.ResponseWriter, r *http.Request) {
    // Verify state parameter
    session := sessions.Get(r, "auth-session")
    storedState, ok := session.Values["oauth_state"].(string)
    if !ok || storedState != r.URL.Query().Get("state") {
        respondWithError(w, http.StatusBadRequest, "Invalid state parameter")
        return
    }

    // Exchange authorization code for tokens
    code := r.URL.Query().Get("code")
    if code == "" {
        respondWithError(w, http.StatusBadRequest, "Authorization code required")
        return
    }

    oauthToken, err := h.oauthService.ExchangeCodeForToken(code, storedState, "")
    if err != nil {
        respondWithError(w, http.StatusInternalServerError, "Failed to exchange code for token")
        return
    }

    // Get user info from Google
    userInfo, err := h.oauthService.GetUserInfo(oauthToken)
    if err != nil {
        respondWithError(w, http.StatusInternalServerError, "Failed to get user info")
        return
    }

    // Create or update user
    user, err := h.userService.CreateOrUpdateFromGoogle(userInfo)
    if err != nil {
        respondWithError(w, http.StatusInternalServerError, "Failed to create user")
        return
    }

    // Generate JWT tokens
    tokenPair, err := h.tokenService.GenerateTokenPair(user)
    if err != nil {
        respondWithError(w, http.StatusInternalServerError, "Failed to generate tokens")
        return
    }

    // Clean up session
    session.Values["oauth_state"] = nil
    session.Values["oauth_redirect"] = nil
    session.Save(r, w)

    respondWithJSON(w, http.StatusOK, AuthResponse{
        User:         user.ToDTO(),
        AccessToken:  tokenPair.AccessToken,
        RefreshToken: tokenPair.RefreshToken,
        TokenType:    tokenPair.TokenType,
        ExpiresIn:    tokenPair.ExpiresIn,
    })
}
```

#### Token Refresh Endpoint
```go
// internal/handlers/auth.go
// POST /api/v1/auth/refresh
func (h *AuthHandler) RefreshToken(w http.ResponseWriter, r *http.Request) {
    var req RefreshTokenRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        respondWithError(w, http.StatusBadRequest, "Invalid request body")
        return
    }

    // Validate refresh token
    claims, err := h.tokenService.ValidateToken(req.RefreshToken)
    if err != nil {
        respondWithError(w, http.StatusUnauthorized, "Invalid refresh token")
        return
    }

    // Get user from database
    user, err := h.userService.GetByID(claims.UserID)
    if err != nil {
        respondWithError(w, http.StatusUnauthorized, "User not found")
        return
    }

    // Generate new token pair
    tokenPair, err := h.tokenService.GenerateTokenPair(user)
    if err != nil {
        respondWithError(w, http.StatusInternalServerError, "Failed to generate tokens")
        return
    }

    respondWithJSON(w, http.StatusOK, map[string]interface{}{
        "access_token":  tokenPair.AccessToken,
        "refresh_token": tokenPair.RefreshToken,
        "token_type":    tokenPair.TokenType,
        "expires_in":    tokenPair.ExpiresIn,
    })
}

// POST /api/v1/auth/logout
func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
    // Get user from context (set by auth middleware)
    user := r.Context().Value("user").(*User)

    // Invalidate refresh token (implement token blacklist)
    err := h.tokenService.InvalidateToken(user.ID.String())
    if err != nil {
        // Log error but don't fail logout
        log.Printf("Failed to invalidate token for user %s: %v", user.ID, err)
    }

    respondWithJSON(w, http.StatusOK, map[string]string{
        "message": "Successfully logged out",
    })
}
```

### Test Cases - Day 3

#### Test Case 3.1: Google Auth URL Generation
```go
// tests/handlers/auth_test.go
func TestGoogleAuth(t *testing.T) {
    handler := setupAuthHandler(t)

    req := httptest.NewRequest("GET", "/api/v1/auth/google", nil)
    w := httptest.NewRecorder()

    handler.GoogleAuth(w, req)

    assert.Equal(t, http.StatusOK, w.Code)

    var response map[string]string
    err := json.Unmarshal(w.Body.Bytes(), &response)
    assert.NoError(t, err)

    assert.NotEmpty(t, response["auth_url"])
    assert.NotEmpty(t, response["state"])
    assert.Contains(t, response["auth_url"], "accounts.google.com")
}
```

#### Test Case 3.2: OAuth Callback Processing
```go
// tests/handlers/callback_test.go
func TestGoogleCallback(t *testing.T) {
    handler := setupAuthHandler(t)
    mockOAuth := &MockOAuthService{}
    handler.oauthService = mockOAuth

    // Mock OAuth token exchange
    mockOAuth.On("ExchangeCodeForToken", mock.Anything, mock.Anything, mock.Anything).
        Return(&oauth2.Token{AccessToken: "mock-token"}, nil)

    // Mock user info
    mockOAuth.On("GetUserInfo", mock.Anything).
        Return(&GoogleUserInfo{
            ID:    "google-123",
            Email: "test@example.com",
            Name:  "Test User",
        }, nil)

    // Create callback request
    req := httptest.NewRequest("GET", "/api/v1/auth/google/callback?code=auth-code&state=test-state", nil)
    w := httptest.NewRecorder()

    // Set up session with state
    session := sessions.Get(req, "auth-session")
    session.Values["oauth_state"] = "test-state"
    session.Save(req, w)

    handler.GoogleCallback(w, req)

    assert.Equal(t, http.StatusOK, w.Code)

    var response AuthResponse
    err := json.Unmarshal(w.Body.Bytes(), &response)
    assert.NoError(t, err)

    assert.NotEmpty(t, response.AccessToken)
    assert.NotEmpty(t, response.RefreshToken)
    assert.Equal(t, "Bearer", response.TokenType)
    assert.Equal(t, "test@example.com", response.User.Email)
}
```

#### Test Case 3.3: Token Refresh Endpoint
```go
// tests/handlers/refresh_test.go
func TestTokenRefresh(t *testing.T) {
    handler := setupAuthHandler(t)
    user := createTestUser(t, handler.userService.DB(), "test@example.com")

    // Generate initial tokens
    tokenPair, err := handler.tokenService.GenerateTokenPair(user)
    require.NoError(t, err)

    // Create refresh request
    reqBody := RefreshTokenRequest{
        RefreshToken: tokenPair.RefreshToken,
    }

    body, _ := json.Marshal(reqBody)
    req := httptest.NewRequest("POST", "/api/v1/auth/refresh", bytes.NewBuffer(body))
    req.Header.Set("Content-Type", "application/json")
    w := httptest.NewRecorder()

    handler.RefreshToken(w, req)

    assert.Equal(t, http.StatusOK, w.Code)

    var response map[string]interface{}
    err = json.Unmarshal(w.Body.Bytes(), &response)
    assert.NoError(t, err)

    assert.NotEmpty(t, response["access_token"])
    assert.NotEmpty(t, response["refresh_token"])
    assert.NotEqual(t, tokenPair.AccessToken, response["access_token"])
}
```

### Expected Behaviors
- OAuth endpoints generate proper redirect URLs with CSRF protection
- Callback processes authorization codes correctly
- Token refresh generates new valid tokens
- Logout invalidates user sessions
- Error responses are properly formatted and secure

---

## Day 4: Chrome Extension Authentication Interface

### Objectives
- Create Google Sign-In interface within Chrome extension constraints
- Handle OAuth flow in extension popup/options page
- Implement secure token storage using Chrome extension APIs
- Handle authentication state management in extension

### Chrome Extension Authentication Structure

#### Extension Manifest Updates
```json
// manifest.json
{
  "name": "Silence Notes",
  "version": "1.0.0",
  "manifest_version": 3,
  "permissions": [
    "storage",
    "identity"
  ],
  "host_permissions": [
    "https://accounts.google.com/*",
    "https://localhost:8080/*"
  ],
  "action": {
    "default_popup": "src/popup/index.html"
  },
  "background": {
    "service_worker": "src/background/index.js"
  }
}
```

#### Authentication Service for Extension
```typescript
// src/services/auth.ts
interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  tokens: TokenPair | null;
}

interface GoogleUserInfo {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

class AuthService {
  private static instance: AuthService;
  private authState: AuthState = {
    isAuthenticated: false,
    user: null,
    tokens: null,
  };

  private constructor() {
    this.initializeAuth();
  }

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  private async initializeAuth(): Promise<void> {
    try {
      // Load stored tokens from Chrome storage
      const result = await chrome.storage.local.get(['tokens', 'user']);

      if (result.tokens && result.user) {
        this.authState.tokens = result.tokens;
        this.authState.user = result.user;

        // Validate token expiration
        if (await this.validateTokens()) {
          this.authState.isAuthenticated = true;
        } else {
          // Refresh tokens if needed
          await this.refreshTokens();
        }
      }
    } catch (error) {
      console.error('Failed to initialize auth:', error);
      this.clearAuthData();
    }
  }

  async signInWithGoogle(): Promise<void> {
    try {
      // Get auth URL from backend
      const response = await fetch('/api/v1/auth/google');
      const { auth_url, state } = await response.json();

      // Store state for validation
      await chrome.storage.local.set({ oauth_state: state });

      // Open Google OAuth in new window (Chrome extension specific)
      const authWindow = await chrome.windows.create({
        url: auth_url,
        type: 'popup',
        width: 500,
        height: 600,
      });

      // Listen for window close and handle callback
      if (authWindow.id) {
        const listener = (windowId: number) => {
          if (windowId === authWindow.id) {
            chrome.windows.onRemoved.removeListener(listener);
            this.handleOAuthCallback();
          }
        };
        chrome.windows.onRemoved.addListener(listener);
      }
    } catch (error) {
      console.error('Google sign-in failed:', error);
      throw error;
    }
  }

  private async handleOAuthCallback(): Promise<void> {
    try {
      // Check for OAuth callback in URL parameters
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab.url?.includes('/auth/google/callback')) {
        const url = new URL(tab.url);
        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');

        if (code && state) {
          await this.exchangeCodeForTokens(code, state);
        }
      }
    } catch (error) {
      console.error('OAuth callback handling failed:', error);
      throw error;
    }
  }

  private async exchangeCodeForTokens(code: string, state: string): Promise<void> {
    try {
      // Verify stored state
      const result = await chrome.storage.local.get(['oauth_state']);
      if (result.oauth_state !== state) {
        throw new Error('Invalid OAuth state');
      }

      // Exchange code for tokens
      const response = await fetch('/api/v1/auth/google/callback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code, state }),
      });

      if (!response.ok) {
        throw new Error('Failed to exchange code for tokens');
      }

      const authData = await response.json();

      // Store auth data
      await chrome.storage.local.set({
        tokens: {
          access_token: authData.access_token,
          refresh_token: authData.refresh_token,
          token_type: authData.token_type,
          expires_in: authData.expires_in,
        },
        user: authData.user,
      });

      // Update auth state
      this.authState.isAuthenticated = true;
      this.authState.user = authData.user;
      this.authState.tokens = authData;

      // Clean up OAuth state
      await chrome.storage.local.remove(['oauth_state']);

    } catch (error) {
      console.error('Token exchange failed:', error);
      throw error;
    }
  }

  async signOut(): Promise<void> {
    try {
      if (this.authState.tokens?.access_token) {
        // Call backend logout endpoint
        await fetch('/api/v1/auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.authState.tokens.access_token}`,
          },
        });
      }
    } catch (error) {
      console.error('Backend logout failed:', error);
    } finally {
      // Clear local auth data regardless of backend response
      await this.clearAuthData();
    }
  }

  private async clearAuthData(): Promise<void> {
    await chrome.storage.local.remove(['tokens', 'user', 'oauth_state']);
    this.authState = {
      isAuthenticated: false,
      user: null,
      tokens: null,
    };
  }

  private async validateTokens(): Promise<boolean> {
    if (!this.authState.tokens) return false;

    try {
      // Make a test request to validate token
      const response = await fetch('/api/v1/auth/validate', {
        headers: {
          'Authorization': `Bearer ${this.authState.tokens.access_token}`,
        },
      });

      return response.ok;
    } catch (error) {
      return false;
    }
  }

  private async refreshTokens(): Promise<boolean> {
    if (!this.authState.tokens?.refresh_token) return false;

    try {
      const response = await fetch('/api/v1/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refresh_token: this.authState.tokens.refresh_token,
        }),
      });

      if (response.ok) {
        const newTokens = await response.json();

        // Update stored tokens
        await chrome.storage.local.set({
          tokens: {
            access_token: newTokens.access_token,
            refresh_token: newTokens.refresh_token,
            token_type: newTokens.token_type,
            expires_in: newTokens.expires_in,
          },
        });

        this.authState.tokens = newTokens;
        return true;
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
    }

    // If refresh fails, clear auth data
    await this.clearAuthData();
    return false;
  }

  getAuthState(): AuthState {
    return { ...this.authState };
  }

  async getCurrentUser(): Promise<User | null> {
    if (!this.authState.isAuthenticated) {
      return null;
    }
    return this.authState.user;
  }
}

export default AuthService;
```

### Test Cases - Day 4

#### Test Case 4.1: Chrome Extension Auth Initialization
```typescript
// src/services/__tests__/auth.test.ts
describe('AuthService', () => {
  let authService: AuthService;
  let mockChrome: any;

  beforeEach(() => {
    // Mock Chrome APIs
    mockChrome = {
      storage: {
        local: {
          get: jest.fn(),
          set: jest.fn(),
          remove: jest.fn(),
        },
      },
      windows: {
        create: jest.fn(),
        onRemoved: {
          addListener: jest.fn(),
          removeListener: jest.fn(),
        },
      },
      tabs: {
        query: jest.fn(),
      },
    };

    global.chrome = mockChrome;
    authService = AuthService.getInstance();
  });

  test('initializes with stored tokens', async () => {
    const mockTokens = {
      access_token: 'test-access-token',
      refresh_token: 'test-refresh-token',
    };
    const mockUser = { id: '1', email: 'test@example.com', name: 'Test User' };

    mockChrome.storage.local.get.mockResolvedValue({
      tokens: mockTokens,
      user: mockUser,
    });

    // Mock fetch for token validation
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
    });

    await authService.initializeAuth();

    const authState = authService.getAuthState();
    expect(authState.isAuthenticated).toBe(true);
    expect(authState.user).toEqual(mockUser);
    expect(authState.tokens).toEqual(mockTokens);
  });
});
```

#### Test Case 4.2: Google Sign-In Flow
```typescript
// src/services/__tests__/auth.test.ts
test('initiates Google sign-in flow', async () => {
  const mockAuthUrl = 'https://accounts.google.com/oauth/authorize?client_id=test&redirect_uri=test&state=test-state';

  mockChrome.storage.local.get.mockResolvedValue({});

  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ auth_url: mockAuthUrl, state: 'test-state' }),
  });

  mockChrome.windows.create.mockResolvedValue({ id: 123 });

  await authService.signInWithGoogle();

  expect(mockChrome.storage.local.set).toHaveBeenCalledWith({
    oauth_state: 'test-state',
  });
  expect(mockChrome.windows.create).toHaveBeenCalledWith({
    url: mockAuthUrl,
    type: 'popup',
    width: 500,
    height: 600,
  });
});
```

#### Test Case 4.3: Token Storage and Retrieval
```typescript
// src/services/__tests__/auth.test.ts
test('stores tokens securely in Chrome storage', async () => {
  const mockAuthData = {
    access_token: 'new-access-token',
    refresh_token: 'new-refresh-token',
    token_type: 'Bearer',
    expires_in: 3600,
    user: { id: '1', email: 'test@example.com', name: 'Test User' },
  };

  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(mockAuthData),
  });

  await authService.exchangeCodeForTokens('test-code', 'test-state');

  expect(mockChrome.storage.local.set).toHaveBeenCalledWith({
    tokens: {
      access_token: 'new-access-token',
      refresh_token: 'new-refresh-token',
      token_type: 'Bearer',
      expires_in: 3600,
    },
    user: mockAuthData.user,
  });

  const authState = authService.getAuthState();
  expect(authState.isAuthenticated).toBe(true);
  expect(authState.tokens).toEqual({
    access_token: 'new-access-token',
    refresh_token: 'new-refresh-token',
    token_type: 'Bearer',
    expires_in: 3600,
  });
});
```

### Expected Behaviors
- Chrome extension authentication works within extension security model
- Google OAuth flow opens in proper extension window
- Tokens are stored securely using Chrome storage APIs
- Authentication state persists across browser sessions
- Token refresh happens automatically when needed

---

## Day 5: User Profile Management

### Objectives
- Implement user profile CRUD operations
- Create user preferences management system
- Add user session tracking and activity logging
- Implement user account deletion and data export

### User Profile Service Implementation

#### User Profile Data Models
```go
// internal/models/user.go
type UserPreferences struct {
    Theme           string `json:"theme" db:"theme"`
    Language        string `json:"language" db:"language"`
    TimeZone        string `json:"timezone" db:"timezone"`
    EmailNotifications bool `json:"email_notifications" db:"email_notifications"`
    AutoSave        bool   `json:"auto_save" db:"auto_save"`
    DefaultNoteView string `json:"default_note_view" db:"default_note_view"`
}

type UserSession struct {
    ID        string    `json:"id" db:"id"`
    UserID    string    `json:"user_id" db:"user_id"`
    IPAddress string    `json:"ip_address" db:"ip_address"`
    UserAgent string    `json:"user_agent" db:"user_agent"`
    CreatedAt time.Time `json:"created_at" db:"created_at"`
    LastSeen  time.Time `json:"last_seen" db:"last_seen"`
    IsActive  bool      `json:"is_active" db:"is_active"`
}

type User struct {
    ID          string          `json:"id" db:"id"`
    GoogleID    string          `json:"google_id" db:"google_id"`
    Email       string          `json:"email" db:"email"`
    Name        string          `json:"name" db:"name"`
    AvatarURL   string          `json:"avatar_url" db:"avatar_url"`
    Preferences UserPreferences `json:"preferences" db:"preferences"`
    CreatedAt   time.Time       `json:"created_at" db:"created_at"`
    UpdatedAt   time.Time       `json:"updated_at" db:"updated_at"`
}
```

#### User Service Implementation
```go
// internal/services/user_service.go
type UserService struct {
    db          *sql.DB
    tokenService *auth.TokenService
}

func (s *UserService) CreateOrUpdateFromGoogle(userInfo *GoogleUserInfo) (*User, error) {
    ctx := context.Background()

    // Check if user exists
    var user User
    err := s.db.QueryRowContext(ctx,
        "SELECT id, google_id, email, name, avatar_url, preferences, created_at, updated_at FROM users WHERE google_id = $1",
        userInfo.ID).Scan(
        &user.ID, &user.GoogleID, &user.Email, &user.Name, &user.AvatarURL,
        &user.Preferences, &user.CreatedAt, &user.UpdatedAt)

    if err == sql.ErrNoRows {
        // Create new user
        user = User{
            ID:        generateUUID(),
            GoogleID:  userInfo.ID,
            Email:     userInfo.Email,
            Name:      userInfo.Name,
            AvatarURL: userInfo.Picture,
            Preferences: UserPreferences{
                Theme:             "light",
                Language:          "en",
                TimeZone:          "UTC",
                EmailNotifications: true,
                AutoSave:          true,
                DefaultNoteView:   "grid",
            },
            CreatedAt: time.Now(),
            UpdatedAt: time.Now(),
        }

        err = s.createUser(ctx, &user)
        if err != nil {
            return nil, fmt.Errorf("failed to create user: %w", err)
        }
    } else if err != nil {
        return nil, fmt.Errorf("failed to query user: %w", err)
    } else {
        // Update existing user
        user.Name = userInfo.Name
        user.AvatarURL = userInfo.Picture
        user.UpdatedAt = time.Now()

        err = s.updateUser(ctx, &user)
        if err != nil {
            return nil, fmt.Errorf("failed to update user: %w", err)
        }
    }

    return &user, nil
}

func (s *UserService) UpdatePreferences(userID string, preferences UserPreferences) error {
    ctx := context.Background()

    query := `
        UPDATE users
        SET preferences = $1, updated_at = $2
        WHERE id = $3
    `

    _, err := s.db.ExecContext(ctx, query, preferences, time.Now(), userID)
    if err != nil {
        return fmt.Errorf("failed to update user preferences: %w", err)
    }

    return nil
}

func (s *UserService) GetPreferences(userID string) (*UserPreferences, error) {
    ctx := context.Background()

    var preferences UserPreferences
    err := s.db.QueryRowContext(ctx,
        "SELECT preferences FROM users WHERE id = $1", userID).Scan(&preferences)

    if err == sql.ErrNoRows {
        return nil, errors.New("user not found")
    } else if err != nil {
        return nil, fmt.Errorf("failed to get user preferences: %w", err)
    }

    return &preferences, nil
}

func (s *UserService) CreateSession(userID, ipAddress, userAgent string) (*UserSession, error) {
    ctx := context.Background()

    session := &UserSession{
        ID:        generateUUID(),
        UserID:    userID,
        IPAddress: ipAddress,
        UserAgent: userAgent,
        CreatedAt: time.Now(),
        LastSeen:  time.Now(),
        IsActive:  true,
    }

    query := `
        INSERT INTO user_sessions (id, user_id, ip_address, user_agent, created_at, last_seen, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
    `

    _, err := s.db.ExecContext(ctx, query,
        session.ID, session.UserID, session.IPAddress, session.UserAgent,
        session.CreatedAt, session.LastSeen, session.IsActive)

    if err != nil {
        return nil, fmt.Errorf("failed to create user session: %w", err)
    }

    return session, nil
}

func (s *UserService) GetActiveSessions(userID string) ([]UserSession, error) {
    ctx := context.Background()

    query := `
        SELECT id, user_id, ip_address, user_agent, created_at, last_seen, is_active
        FROM user_sessions
        WHERE user_id = $1 AND is_active = true
        ORDER BY last_seen DESC
    `

    rows, err := s.db.QueryContext(ctx, query, userID)
    if err != nil {
        return nil, fmt.Errorf("failed to get user sessions: %w", err)
    }
    defer rows.Close()

    var sessions []UserSession
    for rows.Next() {
        var session UserSession
        err := rows.Scan(&session.ID, &session.UserID, &session.IPAddress,
            &session.UserAgent, &session.CreatedAt, &session.LastSeen, &session.IsActive)
        if err != nil {
            return nil, fmt.Errorf("failed to scan session: %w", err)
        }
        sessions = append(sessions, session)
    }

    return sessions, nil
}
```

### Test Cases - Day 5

#### Test Case 5.1: User Creation from Google Info
```go
// tests/services/user_service_test.go
func TestCreateUserFromGoogle(t *testing.T) {
    db := setupTestDB(t)
    defer cleanupTestDB(t, db)

    userService := &UserService{db: db, tokenService: setupTokenService(t)}

    googleInfo := &GoogleUserInfo{
        ID:      "google-123",
        Email:   "test@example.com",
        Name:    "Test User",
        Picture: "https://example.com/avatar.jpg",
    }

    user, err := userService.CreateOrUpdateFromGoogle(googleInfo)
    assert.NoError(t, err)
    assert.NotEmpty(t, user.ID)
    assert.Equal(t, googleInfo.ID, user.GoogleID)
    assert.Equal(t, googleInfo.Email, user.Email)
    assert.Equal(t, googleInfo.Name, user.Name)
    assert.Equal(t, googleInfo.Picture, user.AvatarURL)
    assert.Equal(t, "light", user.Preferences.Theme)
    assert.True(t, user.Preferences.AutoSave)
}

func TestUpdateExistingUserFromGoogle(t *testing.T) {
    db := setupTestDB(t)
    defer cleanupTestDB(t, db)

    userService := &UserService{db: db, tokenService: setupTokenService(t)}

    // Create initial user
    googleInfo1 := &GoogleUserInfo{
        ID:    "google-123",
        Email: "test@example.com",
        Name:  "Test User",
    }

    user1, err := userService.CreateOrUpdateFromGoogle(googleInfo1)
    require.NoError(t, err)
    require.NotEmpty(t, user1.ID)

    // Update user with new info
    googleInfo2 := &GoogleUserInfo{
        ID:      "google-123", // Same Google ID
        Email:   "test@example.com", // Same email
        Name:    "Updated Name", // Updated name
        Picture: "https://example.com/new-avatar.jpg", // New avatar
    }

    user2, err := userService.CreateOrUpdateFromGoogle(googleInfo2)
    assert.NoError(t, err)
    assert.Equal(t, user1.ID, user2.ID) // Same user ID
    assert.Equal(t, "Updated Name", user2.Name)
    assert.Equal(t, "https://example.com/new-avatar.jpg", user2.AvatarURL)
    assert.True(t, user2.UpdatedAt.After(user1.UpdatedAt))
}
```

#### Test Case 5.2: User Preferences Management
```go
// tests/services/preferences_test.go
func TestUpdateUserPreferences(t *testing.T) {
    db := setupTestDB(t)
    defer cleanupTestDB(t, db)

    userService := &UserService{db: db, tokenService: setupTokenService(t)}
    user := createTestUser(t, db, "test@example.com")

    preferences := UserPreferences{
        Theme:             "dark",
        Language:          "es",
        TimeZone:          "America/New_York",
        EmailNotifications: false,
        AutoSave:          false,
        DefaultNoteView:   "list",
    }

    err := userService.UpdatePreferences(user.ID, preferences)
    assert.NoError(t, err)

    retrieved, err := userService.GetPreferences(user.ID)
    assert.NoError(t, err)
    assert.Equal(t, preferences.Theme, retrieved.Theme)
    assert.Equal(t, preferences.Language, retrieved.Language)
    assert.Equal(t, preferences.TimeZone, retrieved.TimeZone)
    assert.Equal(t, preferences.EmailNotifications, retrieved.EmailNotifications)
    assert.Equal(t, preferences.AutoSave, retrieved.AutoSave)
    assert.Equal(t, preferences.DefaultNoteView, retrieved.DefaultNoteView)
}
```

#### Test Case 5.3: User Session Management
```go
// tests/services/sessions_test.go
func TestUserSessionManagement(t *testing.T) {
    db := setupTestDB(t)
    defer cleanupTestDB(t, db)

    userService := &UserService{db: db, tokenService: setupTokenService(t)}
    user := createTestUser(t, db, "test@example.com")

    // Create session
    session, err := userService.CreateSession(user.ID, "127.0.0.1", "Mozilla/5.0")
    assert.NoError(t, err)
    assert.NotEmpty(t, session.ID)
    assert.Equal(t, user.ID, session.UserID)
    assert.Equal(t, "127.0.0.1", session.IPAddress)
    assert.True(t, session.IsActive)

    // Get active sessions
    sessions, err := userService.GetActiveSessions(user.ID)
    assert.NoError(t, err)
    assert.Len(t, sessions, 1)
    assert.Equal(t, session.ID, sessions[0].ID)
}
```

### Expected Behaviors
- Users are created from Google OAuth information
- Existing users are updated with latest Google profile data
- User preferences are stored and retrieved correctly
- User sessions are tracked with IP and user agent
- Default preferences are applied to new users

---

## Day 6: Session Management & Security

### Objectives
- Implement secure session management with proper timeouts
- Add automatic token refresh mechanisms
- Implement session invalidation and logout
- Add security headers and middleware

### Session Management Implementation

#### Session Middleware
```go
// internal/middleware/auth.go
func (s *Server) authMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        authHeader := r.Header.Get("Authorization")
        if authHeader == "" {
            respondWithError(w, http.StatusUnauthorized, "Authorization header required")
            return
        }

        // Extract token from "Bearer <token>" format
        tokenParts := strings.Split(authHeader, " ")
        if len(tokenParts) != 2 || tokenParts[0] != "Bearer" {
            respondWithError(w, http.StatusUnauthorized, "Invalid authorization header format")
            return
        }

        // Validate token
        claims, err := s.tokenService.ValidateToken(tokenParts[1])
        if err != nil {
            respondWithError(w, http.StatusUnauthorized, "Invalid token")
            return
        }

        // Check if token is blacklisted
        if s.tokenService.IsTokenBlacklisted(claims.ID) {
            respondWithError(w, http.StatusUnauthorized, "Token has been revoked")
            return
        }

        // Get user from database
        user, err := s.userService.GetByID(claims.UserID)
        if err != nil {
            respondWithError(w, http.StatusUnauthorized, "User not found")
            return
        }

        // Update session activity
        if err := s.userService.UpdateSessionActivity(claims.ID, r.RemoteAddr, r.UserAgent()); err != nil {
            // Log error but don't fail the request
            log.Printf("Failed to update session activity: %v", err)
        }

        // Add user to context
        ctx := context.WithValue(r.Context(), "user", user)
        ctx = context.WithValue(ctx, "claims", claims)

        next.ServeHTTP(w, r.WithContext(ctx))
    })
}

func (s *Server) rateLimitMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        // Implement rate limiting based on user ID or IP
        // This is a simplified version - in production, use a proper rate limiting library
        clientID := getClientIdentifier(r)

        if !s.rateLimiter.Allow(clientID) {
            respondWithError(w, http.StatusTooManyRequests, "Rate limit exceeded")
            return
        }

        next.ServeHTTP(w, r)
    })
}
```

#### Token Blacklist Service
```go
// internal/auth/token_blacklist.go
type TokenBlacklist struct {
    redis *redis.Client
    db    *sql.DB
}

func (tb *TokenBlacklist) BlacklistToken(tokenID string, expiration time.Time) error {
    ctx := context.Background()

    // Store in Redis with expiration
    err := tb.redis.Set(ctx, fmt.Sprintf("blacklist:%s", tokenID), "1",
        time.Until(expiration)).Err()
    if err != nil {
        return fmt.Errorf("failed to blacklist token in Redis: %w", err)
    }

    // Also store in database as backup
    query := `
        INSERT INTO token_blacklist (token_id, expires_at, created_at)
        VALUES ($1, $2, $3)
        ON CONFLICT (token_id) DO NOTHING
    `

    _, err = tb.db.ExecContext(ctx, query, tokenID, expiration, time.Now())
    if err != nil {
        // Log error but don't fail - Redis is primary
        log.Printf("Failed to blacklist token in database: %v", err)
    }

    return nil
}

func (tb *TokenBlacklist) IsTokenBlacklisted(tokenID string) bool {
    ctx := context.Background()

    // Check Redis first (fast)
    exists, err := tb.redis.Exists(ctx, fmt.Sprintf("blacklist:%s", tokenID)).Result()
    if err == nil && exists > 0 {
        return true
    }

    // Fallback to database check
    var count int
    err = tb.db.QueryRowContext(ctx,
        "SELECT COUNT(*) FROM token_blacklist WHERE token_id = $1 AND expires_at > NOW()",
        tokenID).Scan(&count)

    if err == nil && count > 0 {
        // Update Redis cache
        tb.redis.Set(ctx, fmt.Sprintf("blacklist:%s", tokenID), "1", time.Hour)
        return true
    }

    return false
}
```

### Security Headers Middleware
```go
// internal/middleware/security.go
func (s *Server) securityHeadersMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        // Security headers
        w.Header().Set("X-Content-Type-Options", "nosniff")
        w.Header().Set("X-Frame-Options", "DENY")
        w.Header().Set("X-XSS-Protection", "1; mode=block")
        w.Header().Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
        w.Header().Set("Content-Security-Policy",
            "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'")
        w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")

        // CORS headers for Chrome extension
        origin := r.Header.Get("Origin")
        if strings.HasPrefix(origin, "chrome-extension://") {
            w.Header().Set("Access-Control-Allow-Origin", origin)
            w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
            w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
            w.Header().Set("Access-Control-Allow-Credentials", "true")
            w.Header().Set("Access-Control-Max-Age", "3600")
        }

        next.ServeHTTP(w, r)
    })
}
```

### Test Cases - Day 6

#### Test Case 6.1: Authentication Middleware
```go
// tests/middleware/auth_test.go
func TestAuthMiddleware(t *testing.T) {
    server := setupTestServer(t)
    user := createTestUser(t, server.DB(), "test@example.com")
    tokenPair, _ := server.TokenService().GenerateTokenPair(user)

    tests := []struct {
        name           string
        authHeader     string
        expectedStatus int
        expectedError  string
    }{
        {
            name:           "valid token",
            authHeader:     "Bearer " + tokenPair.AccessToken,
            expectedStatus: http.StatusOK,
        },
        {
            name:           "missing auth header",
            authHeader:     "",
            expectedStatus: http.StatusUnauthorized,
            expectedError:  "Authorization header required",
        },
        {
            name:           "invalid auth format",
            authHeader:     "InvalidFormat token",
            expectedStatus: http.StatusUnauthorized,
            expectedError:  "Invalid authorization header format",
        },
        {
            name:           "invalid token",
            authHeader:     "Bearer invalid-token",
            expectedStatus: http.StatusUnauthorized,
            expectedError:  "Invalid token",
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            req := httptest.NewRequest("GET", "/api/v1/protected", nil)
            if tt.authHeader != "" {
                req.Header.Set("Authorization", tt.authHeader)
            }
            w := httptest.NewRecorder()

            handler := server.authMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
                w.WriteHeader(http.StatusOK)
            }))

            handler.ServeHTTP(w, req)

            assert.Equal(t, tt.expectedStatus, w.Code)
            if tt.expectedError != "" {
                var response map[string]string
                err := json.Unmarshal(w.Body.Bytes(), &response)
                assert.NoError(t, err)
                assert.Equal(t, tt.expectedError, response["error"])
            }
        })
    }
}
```

#### Test Case 6.2: Token Blacklisting
```go
// tests/auth/blacklist_test.go
func TestTokenBlacklisting(t *testing.T) {
    blacklist := setupTokenBlacklist(t)
    tokenService := setupTokenService(t)
    user := createTestUser(t, nil, "test@example.com")

    // Generate token
    tokenPair, err := tokenService.GenerateTokenPair(user)
    require.NoError(t, err)

    // Extract token ID from claims
    claims, err := tokenService.ValidateToken(tokenPair.AccessToken)
    require.NoError(t, err)

    // Token should not be blacklisted initially
    assert.False(t, blacklist.IsTokenBlacklisted(claims.ID))

    // Blacklist the token
    err = blacklist.BlacklistToken(claims.ID, time.Now().Add(time.Hour))
    assert.NoError(t, err)

    // Token should now be blacklisted
    assert.True(t, blacklist.IsTokenBlacklisted(claims.ID))

    // Validate token should fail
    _, err = tokenService.ValidateToken(tokenPair.AccessToken)
    assert.Error(t, err)
    assert.Contains(t, err.Error(), "revoked")
}
```

#### Test Case 6.3: Session Activity Tracking
```go
// tests/services/session_activity_test.go
func TestSessionActivityTracking(t *testing.T) {
    db := setupTestDB(t)
    defer cleanupTestDB(t, db)

    userService := &UserService{db: db, tokenService: setupTokenService(t)}
    user := createTestUser(t, db, "test@example.com")

    // Create initial session
    session, err := userService.CreateSession(user.ID, "127.0.0.1", "Mozilla/5.0")
    require.NoError(t, err)
    originalLastSeen := session.LastSeen

    // Wait a bit and update activity
    time.Sleep(100 * time.Millisecond)

    err = userService.UpdateSessionActivity(session.ID, "127.0.0.1", "Mozilla/5.0")
    assert.NoError(t, err)

    // Verify session was updated
    sessions, err := userService.GetActiveSessions(user.ID)
    assert.NoError(t, err)
    assert.Len(t, sessions, 1)
    assert.True(t, sessions[0].LastSeen.After(originalLastSeen))
}
```

### Expected Behaviors
- Authentication middleware validates tokens correctly
- Invalid or missing tokens are rejected with proper error messages
- Blacklisted tokens cannot be used
- Security headers are set on all responses
- CORS headers allow Chrome extension access
- Session activity is tracked and updated

---

## Day 7: Integration Testing & Documentation

### Objectives
- Complete end-to-end authentication flow testing
- Create comprehensive API documentation
- Implement error handling edge cases
- Performance testing and optimization

### Integration Tests

#### Complete Authentication Flow Test
```go
// tests/integration/auth_flow_test.go
func TestCompleteAuthenticationFlow(t *testing.T) {
    server := setupTestServer(t)
    defer server.Close()

    // Step 1: Get auth URL
    resp, err := http.Get(server.URL + "/api/v1/auth/google")
    require.NoError(t, err)
    assert.Equal(t, http.StatusOK, resp.StatusCode)

    var authResponse map[string]string
    err = json.NewDecoder(resp.Body).Decode(&authResponse)
    require.NoError(t, err)

    assert.NotEmpty(t, authResponse["auth_url"])
    assert.NotEmpty(t, authResponse["state"])

    // Step 2: Mock OAuth callback
    // In real test, this would involve actual OAuth flow
    // For integration test, we'll mock the callback processing

    // Step 3: Create user directly (simulating successful OAuth)
    user := &User{
        GoogleID: "test-google-id",
        Email:    "test@example.com",
        Name:     "Test User",
    }
    err = server.UserService().CreateOrUpdateFromGoogle(&GoogleUserInfo{
        ID:    user.GoogleID,
        Email: user.Email,
        Name:  user.Name,
    })
    require.NoError(t, err)

    // Step 4: Generate tokens
    tokenPair, err := server.TokenService().GenerateTokenPair(user)
    require.NoError(t, err)

    // Step 5: Use token to access protected endpoint
    req, _ := http.NewRequest("GET", server.URL+"/api/v1/user/profile", nil)
    req.Header.Set("Authorization", "Bearer "+tokenPair.AccessToken)

    resp, err = http.DefaultClient.Do(req)
    require.NoError(t, err)
    assert.Equal(t, http.StatusOK, resp.StatusCode)

    var profileResponse User
    err = json.NewDecoder(resp.Body).Decode(&profileResponse)
    require.NoError(t, err)
    assert.Equal(t, user.Email, profileResponse.Email)

    // Step 6: Refresh token
    refreshReq := RefreshTokenRequest{
        RefreshToken: tokenPair.RefreshToken,
    }
    refreshBody, _ := json.Marshal(refreshReq)

    req, _ = http.NewRequest("POST", server.URL+"/api/v1/auth/refresh",
        bytes.NewBuffer(refreshBody))
    req.Header.Set("Content-Type", "application/json")

    resp, err = http.DefaultClient.Do(req)
    require.NoError(t, err)
    assert.Equal(t, http.StatusOK, resp.StatusCode)

    var refreshResponse map[string]interface{}
    err = json.NewDecoder(resp.Body).Decode(&refreshResponse)
    require.NoError(t, err)
    assert.NotEmpty(t, refreshResponse["access_token"])
    assert.NotEqual(t, tokenPair.AccessToken, refreshResponse["access_token"])

    // Step 7: Logout
    logoutReq, _ := http.NewRequest("POST", server.URL+"/api/v1/auth/logout", nil)
    logoutReq.Header.Set("Authorization", "Bearer "+refreshResponse["access_token"].(string))

    resp, err = http.DefaultClient.Do(logoutReq)
    require.NoError(t, err)
    assert.Equal(t, http.StatusOK, resp.StatusCode)

    // Step 8: Verify token is invalidated
    req, _ = http.NewRequest("GET", server.URL+"/api/v1/user/profile", nil)
    req.Header.Set("Authorization", "Bearer "+refreshResponse["access_token"].(string))

    resp, err = http.DefaultClient.Do(req)
    require.NoError(t, err)
    assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
}
```

### Performance Tests

#### Authentication Performance Test
```go
// tests/performance/auth_performance_test.go
func TestAuthenticationPerformance(t *testing.T) {
    if testing.Short() {
        t.Skip("Skipping performance test in short mode")
    }

    server := setupTestServer(t)
    defer server.Close()

    // Create test users
    var users []User
    for i := 0; i < 100; i++ {
        user := &User{
            GoogleID: fmt.Sprintf("google-id-%d", i),
            Email:    fmt.Sprintf("user%d@example.com", i),
            Name:     fmt.Sprintf("User %d", i),
        }
        err := server.UserService().CreateOrUpdateFromGoogle(&GoogleUserInfo{
            ID:    user.GoogleID,
            Email: user.Email,
            Name:  user.Name,
        })
        require.NoError(t, err)
        users = append(users, *user)
    }

    // Test token generation performance
    start := time.Now()
    for _, user := range users {
        _, err := server.TokenService().GenerateTokenPair(&user)
        require.NoError(t, err)
    }
    duration := time.Since(start)

    avgTime := duration / time.Duration(len(users))
    assert.Less(t, avgTime, 5*time.Millisecond, "Token generation should be fast")

    // Test token validation performance
    var tokens []string
    for _, user := range users {
        tokenPair, _ := server.TokenService().GenerateTokenPair(&user)
        tokens = append(tokens, tokenPair.AccessToken)
    }

    start = time.Now()
    for _, token := range tokens {
        _, err := server.TokenService().ValidateToken(token)
        require.NoError(t, err)
    }
    duration = time.Since(start)

    avgTime = duration / time.Duration(len(tokens))
    assert.Less(t, avgTime, 2*time.Millisecond, "Token validation should be very fast")
}
```

### API Documentation

#### OpenAPI/Swagger Documentation
```yaml
# docs/api.yaml
openapi: 3.0.0
info:
  title: Silence Notes API
  version: 1.0.0
  description: API for Silence Notes Chrome extension

servers:
  - url: http://localhost:8080/api/v1
    description: Development server

paths:
  /auth/google:
    get:
      summary: Get Google OAuth URL
      description: Generates Google OAuth authorization URL with CSRF protection
      tags:
        - Authentication
      responses:
        '200':
          description: Successful response
          content:
            application/json:
              schema:
                type: object
                properties:
                  auth_url:
                    type: string
                    description: Google OAuth authorization URL
                  state:
                    type: string
                    description: CSRF protection state parameter

  /auth/google/callback:
    post:
      summary: Google OAuth callback
      description: Processes Google OAuth callback and returns JWT tokens
      tags:
        - Authentication
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                code:
                  type: string
                  description: Authorization code from Google
                state:
                  type: string
                  description: State parameter for CSRF protection
      responses:
        '200':
          description: Authentication successful
          content:
            application/json:
              schema:
                type: object
                properties:
                  user:
                    $ref: '#/components/schemas/User'
                  access_token:
                    type: string
                  refresh_token:
                    type: string
                  token_type:
                    type: string
                    enum: [Bearer]
                  expires_in:
                    type: integer
        '400':
          description: Bad request - invalid parameters
        '401':
          description: Unauthorized - invalid state or code

  /auth/refresh:
    post:
      summary: Refresh access token
      description: Generates new access token using refresh token
      tags:
        - Authentication
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                refresh_token:
                  type: string
      responses:
        '200':
          description: Token refreshed successfully
          content:
            application/json:
              schema:
                type: object
                properties:
                  access_token:
                    type: string
                  refresh_token:
                    type: string
                  token_type:
                    type: string
                  expires_in:
                    type: integer
        '401':
          description: Unauthorized - invalid refresh token

components:
  schemas:
    User:
      type: object
      properties:
        id:
          type: string
          format: uuid
        email:
          type: string
          format: email
        name:
          type: string
        avatar_url:
          type: string
          format: uri
        preferences:
          $ref: '#/components/schemas/UserPreferences'
        created_at:
          type: string
          format: date-time
        updated_at:
          type: string
          format: date-time

    UserPreferences:
      type: object
      properties:
        theme:
          type: string
          enum: [light, dark]
        language:
          type: string
        timezone:
          type: string
        email_notifications:
          type: boolean
        auto_save:
          type: boolean
        default_note_view:
          type: string
          enum: [grid, list]

  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
```

### Test Cases - Day 7

#### Test Case 7.1: Error Handling Edge Cases
```go
// tests/integration/error_handling_test.go
func TestErrorHandlingEdgeCases(t *testing.T) {
    server := setupTestServer(t)
    defer server.Close()

    tests := []struct {
        name           string
        endpoint       string
        method         string
        body           interface{}
        headers        map[string]string
        expectedStatus int
        expectedError  string
    }{
        {
            name:           "invalid JSON in refresh request",
            endpoint:       "/auth/refresh",
            method:         "POST",
            body:           "invalid json",
            expectedStatus: http.StatusBadRequest,
            expectedError:  "Invalid request body",
        },
        {
            name:           "missing refresh token",
            endpoint:       "/auth/refresh",
            method:         "POST",
            body:           map[string]interface{}{},
            expectedStatus: http.StatusBadRequest,
            expectedError:  "refresh_token is required",
        },
        {
            name:           "malformed authorization header",
            endpoint:       "/user/profile",
            method:         "GET",
            headers:        map[string]string{"Authorization": "InvalidHeader"},
            expectedStatus: http.StatusUnauthorized,
            expectedError:  "Invalid authorization header format",
        },
        {
            name:           "expired token",
            endpoint:       "/user/profile",
            method:         "GET",
            headers:        map[string]string{"Authorization": "Bearer expired-token"},
            expectedStatus: http.StatusUnauthorized,
            expectedError:  "Invalid token",
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            var body io.Reader
            if tt.body != nil {
                if str, ok := tt.body.(string); ok {
                    body = strings.NewReader(str)
                } else {
                    jsonBody, _ := json.Marshal(tt.body)
                    body = bytes.NewBuffer(jsonBody)
                }
            }

            req, _ := http.NewRequest(tt.method, server.URL+tt.endpoint, body)
            for k, v := range tt.headers {
                req.Header.Set(k, v)
            }
            if tt.body != nil && tt.method == "POST" {
                req.Header.Set("Content-Type", "application/json")
            }

            resp, err := http.DefaultClient.Do(req)
            require.NoError(t, err)
            assert.Equal(t, tt.expectedStatus, resp.StatusCode)

            if tt.expectedError != "" {
                var response map[string]string
                err = json.NewDecoder(resp.Body).Decode(&response)
                assert.NoError(t, err)
                assert.Equal(t, tt.expectedError, response["error"])
            }
        })
    }
}
```

#### Test Case 7.2: Concurrent Authentication Requests
```go
// tests/integration/concurrent_auth_test.go
func TestConcurrentAuthentication(t *testing.T) {
    server := setupTestServer(t)
    defer server.Close()

    user := createTestUser(t, server.DB(), "test@example.com")

    // Test concurrent token generation
    const numGoroutines = 50
    var wg sync.WaitGroup
    tokens := make(chan string, numGoroutines)
    errors := make(chan error, numGoroutines)

    for i := 0; i < numGoroutines; i++ {
        wg.Add(1)
        go func() {
            defer wg.Done()
            tokenPair, err := server.TokenService().GenerateTokenPair(user)
            if err != nil {
                errors <- err
                return
            }
            tokens <- tokenPair.AccessToken
        }()
    }

    wg.Wait()
    close(tokens)
    close(errors)

    // Check for errors
    for err := range errors {
        t.Errorf("Token generation failed: %v", err)
    }

    // Verify all tokens are valid
    validTokens := 0
    for token := range tokens {
        _, err := server.TokenService().ValidateToken(token)
        if err == nil {
            validTokens++
        }
    }

    assert.Equal(t, numGoroutines, validTokens, "All tokens should be valid")
}
```

### Expected Behaviors
- Complete authentication flow works end-to-end
- Error cases are handled gracefully with proper error messages
- API responds quickly under load
- Concurrent requests are handled correctly
- Documentation accurately describes the API
- All security measures are enforced

---

## Phase 2 Completion Criteria

### Technical Requirements
- [ ] Google OAuth 2.0 flow works correctly with PKCE
- [ ] JWT tokens are generated, validated, and refreshed automatically
- [ ] Chrome extension authentication persists across sessions
- [ ] All authentication endpoints have proper security headers
- [ ] Token blacklist prevents revoked token usage
- [ ] Session management tracks user activity correctly

### Functional Requirements
- [ ] Users can sign in with Google accounts
- [ ] User profiles are created and updated from Google data
- [ ] User preferences are stored and managed
- [ ] Authentication state persists in Chrome extension
- [ ] Logout invalidates all active sessions
- [ ] Token refresh happens seamlessly

### Security Requirements
- [ ] CSRF protection is implemented throughout
- [ ] All tokens use proper expiration and refresh mechanisms
- [ ] Sensitive data is stored securely
- [ ] Rate limiting prevents abuse
- [ ] Security headers are set on all responses
- [ ] Chrome extension security model is respected

### Performance Requirements
- [ ] Authentication completes in < 5 seconds
- [ ] Token generation takes < 5ms per request
- [ ] Token validation takes < 2ms per request
- [ ] System handles 100+ concurrent auth requests
- [ ] Chrome extension starts with authentication state in < 1 second

### Testing Requirements
- [ ] Unit test coverage > 95% for authentication code
- [ ] Integration tests cover complete authentication flow
- [ ] Performance tests meet benchmark requirements
- [ ] Security tests verify all protections work
- [ ] Error handling tests cover edge cases

### Deliverables
1. **Backend**: Complete OAuth 2.0 authentication system
2. **Chrome Extension**: Authentication interface with Google Sign-In
3. **Security**: Comprehensive security middleware and protections
4. **Documentation**: Complete API documentation and setup guides
5. **Testing**: Full test suite with >95% coverage
6. **Performance**: Optimized authentication system

### Success Metrics
- ✅ Google OAuth flow success rate > 99%
- ✅ Authentication response time < 5 seconds
- ✅ Token validation performance < 2ms
- ✅ Zero security vulnerabilities in penetration testing
- ✅ Chrome extension authentication persistence > 99%
- ✅ Complete test coverage of authentication flows

When all these criteria are met, Phase 2 is considered complete and we can proceed to Phase 3: Core Note Functionality.
