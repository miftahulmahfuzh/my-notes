package auth

import (
	"fmt"
	"time"

	"github.com/gpd/my-notes/internal/models"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// Claims represents the JWT claims structure
type Claims struct {
	UserID    string `json:"user_id"`
	SessionID string `json:"session_id"`
	Email     string `json:"email"`
	Issuer    string `json:"iss"`
	Audience  string `json:"aud"`
	jwt.RegisteredClaims
}

// TokenPair represents an access token and refresh token pair
type TokenPair struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	TokenType    string `json:"token_type"`
	ExpiresIn    int    `json:"expires_in"`
}

// TokenService handles JWT token generation, validation, and refresh
type TokenService struct {
	secretKey     []byte
	accessExpiry  time.Duration
	refreshExpiry time.Duration
	issuer        string
	audience      string
}

// NewTokenService creates a new TokenService instance
func NewTokenService(secretKey string, accessExpiry, refreshExpiry time.Duration, issuer, audience string) *TokenService {
	return &TokenService{
		secretKey:     []byte(secretKey),
		accessExpiry:  accessExpiry,
		refreshExpiry: refreshExpiry,
		issuer:        issuer,
		audience:      audience,
	}
}

// GenerateTokenPair generates a new access token and refresh token pair
func (s *TokenService) GenerateTokenPair(user *models.User) (*TokenPair, error) {
	now := time.Now()
	tokenID := generateTokenID()
	sessionID := generateTokenID()

	// Generate access token
	accessClaims := &Claims{
		UserID:    user.ID.String(),
		SessionID: sessionID,
		Email:     user.Email,
		Issuer:    s.issuer,
		Audience:  s.audience,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(s.accessExpiry)),
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
			Subject:   user.ID.String(),
			ID:        tokenID,
		},
	}

	accessToken := jwt.NewWithClaims(jwt.SigningMethodHS256, accessClaims)
	accessTokenString, err := accessToken.SignedString(s.secretKey)
	if err != nil {
		return nil, fmt.Errorf("failed to sign access token: %w", err)
	}

	// Generate refresh token
	refreshTokenID := generateTokenID()
	refreshClaims := &Claims{
		UserID:    user.ID.String(),
		SessionID: sessionID,
		Email:     user.Email,
		Issuer:    s.issuer,
		Audience:  s.audience,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(s.refreshExpiry)),
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
			Subject:   user.ID.String(),
			ID:        refreshTokenID,
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

// GenerateTokenPairWithSession generates a new access token and refresh token pair with a specific session ID
func (s *TokenService) GenerateTokenPairWithSession(user *models.User, sessionID string) (*TokenPair, error) {
	now := time.Now()
	tokenID := generateTokenID()

	// Generate access token
	accessClaims := &Claims{
		UserID:    user.ID.String(),
		SessionID: sessionID, // Use the provided session ID
		Email:     user.Email,
		Issuer:    s.issuer,
		Audience:  s.audience,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(s.accessExpiry)),
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
			Subject:   user.ID.String(),
			ID:        tokenID,
		},
	}

	accessToken := jwt.NewWithClaims(jwt.SigningMethodHS256, accessClaims)
	accessTokenString, err := accessToken.SignedString(s.secretKey)
	if err != nil {
		return nil, fmt.Errorf("failed to sign access token: %w", err)
	}

	// Generate refresh token
	refreshTokenID := generateTokenID()
	refreshClaims := &Claims{
		UserID:    user.ID.String(),
		SessionID: sessionID, // Use the provided session ID
		Email:     user.Email,
		Issuer:    s.issuer,
		Audience:  s.audience,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(s.refreshExpiry)),
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
			Subject:   user.ID.String(),
			ID:        refreshTokenID,
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

// ValidateToken validates a JWT token and returns the claims
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
		return nil, fmt.Errorf("invalid token claims")
	}

	// Additional validation
	if claims.Issuer != s.issuer {
		return nil, fmt.Errorf("invalid token issuer")
	}

	if claims.Audience != s.audience {
		return nil, fmt.Errorf("invalid token audience")
	}

	return claims, nil
}

// ValidateRefreshToken specifically validates a refresh token
func (s *TokenService) ValidateRefreshToken(tokenString string) (*Claims, error) {
	claims, err := s.ValidateToken(tokenString)
	if err != nil {
		return nil, fmt.Errorf("invalid refresh token: %w", err)
	}

	// Additional check for refresh token usage
	// In a real implementation, you might want to check if this token ID
	// has been marked as a refresh token in your database
	return claims, nil
}

// GenerateTokenID generates a unique token ID
func generateTokenID() string {
	return uuid.New().String()
}

// RefreshTokenRequest represents the request to refresh a token
type RefreshTokenRequest struct {
	RefreshToken string `json:"refresh_token" validate:"required"`
}

// Validate validates the refresh token request
func (r *RefreshTokenRequest) Validate() error {
	if r.RefreshToken == "" {
		return fmt.Errorf("refresh_token is required")
	}
	return nil
}