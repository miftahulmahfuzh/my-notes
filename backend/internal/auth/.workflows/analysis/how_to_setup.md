# Authentication Package Setup Guide

## Overview

The `/backend/internal/auth` package implements a comprehensive Google OAuth 2.0 authentication system with JWT token management. This guide explains how it works and how to set it up.

## Architecture

### Components Overview

#### 1. `google_config.go`
- Defines `GoogleConfig` struct with OAuth credentials
- **Required credentials:**
  - `GOOGLE_CLIENT_ID` - Google OAuth Client ID
  - `GOOGLE_CLIENT_SECRET` - Google OAuth Client Secret
  - `GOOGLE_REDIRECT_URL` - Callback URL for OAuth flow
- Includes validation for required fields

#### 2. `oauth_service.go`
- Implements the **OAuth 2.0 flow with PKCE (Proof Key for Code Exchange)**
- **Key security features:**
  - PKCE for enhanced security (prevents authorization code interception)
  - State parameter for CSRF protection
  - Code verifier/challenge generation
- **Main methods:**
  - `GetAuthURL()` - Generates Google OAuth URL with PKCE
  - `ExchangeCodeForToken()` - Exchanges auth code for access tokens
  - `GetUserInfo()` - Fetches user profile from Google

#### 3. `jwt.go`
- Handles **JWT token generation and validation**
- **Token types:**
  - Access tokens (short-lived, configurable via `AccessExpiry`)
  - Refresh tokens (long-lived, configurable via `RefreshExpiry`)
- **Features:**
  - HMAC-SHA256 signing
  - Issuer and audience validation
  - Session management via session IDs

#### 4. `google_user.go`
- Defines `GoogleUserInfo` struct for Google API responses
- Converts Google user data to internal `User` model
- Sets default user preferences (theme, language, timezone, etc.)

## Authentication Flow

### Complete OAuth 2.0 + JWT Flow

1. **Initiation**: Frontend requests auth URL
2. **OAuth URL Generation**: `GetAuthURL()` creates Google OAuth URL with PKCE challenge
3. **User Authentication**: User authenticates with Google
4. **Code Exchange**: `ExchangeCodeForToken()` exchanges authorization code for tokens
5. **User Info Fetch**: `GetUserInfo()` retrieves user profile from Google
6. **JWT Generation**: `GenerateTokenPair()` creates access/refresh tokens
7. **Token Validation**: `ValidateToken()` validates subsequent requests

### Security Features

- **PKCE**: Prevents authorization code interception attacks
- **State Parameter**: CSRF protection during OAuth flow
- **JWT Validation**: Issuer/audience validation prevents token misuse
- **Secure Defaults**: Reasonable token expiry times
- **Token Blacklist**: Support for revoking tokens (via `EnableBlacklist`)

## Required Credentials

You need to provide the following credentials for the authentication system to work:

### Google OAuth 2.0 Credentials (Required)

1. **Google Client ID** (`GOOGLE_CLIENT_ID`)
   - Get from Google Cloud Console → APIs & Services → Credentials
   - Create "OAuth 2.0 Client ID" for "Web application"

2. **Google Client Secret** (`GOOGLE_CLIENT_SECRET`)
   - Provided when you create the OAuth 2.0 Client ID
   - Keep this secret!

3. **Redirect URL** (`GOOGLE_REDIRECT_URL`)
   - Must match what's configured in Google Cloud Console
   - Example: `http://localhost:8080/api/auth/google/callback`

### JWT Configuration (Required)

4. **JWT Secret** (`JWT_SECRET`)
   - Must be at least 32 characters long (validated in `config.go:168-170`)
   - Used to sign/verify JWT tokens
   - Generate with: `openssl rand -base64 32`

## Setup Instructions

### 1. Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing project
3. Go to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth 2.0 Client IDs**
5. Select **Web application** as the application type
6. Configure **Authorized redirect URIs**:
   - Development: `http://localhost:8080/api/auth/google/callback`
   - Production: `https://your-domain.com/api/auth/google/callback`
7. Note the **Client ID** and **Client Secret** provided

### 2. Environment Configuration

Create a `.env` file in the backend directory or set environment variables:

```bash
# Google OAuth Credentials
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URL=http://localhost:8080/api/auth/google/callback

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-at-least-32-characters-long

# Optional: Token expiry settings (hours)
AUTH_TOKEN_EXPIRY=24        # Access token expiry (default: 24 hours)
AUTH_REFRESH_EXPIRY=168     # Refresh token expiry (default: 7 days)

# Optional: Server configuration
SERVER_HOST=localhost
SERVER_PORT=8080

# Database configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=notes_dev
DB_USER=postgres
DB_PASSWORD=your-db-password
DB_SSLMODE=disable
```

### 3. Default OAuth Scopes

The system requests these default scopes (defined in `google_config.go:42-44`):
- `openid` - Required for authentication
- `email` - User's email address
- `profile` - Basic profile information

### 4. Token Configuration

Default token settings (configurable via environment variables):

```go
// Access token: 15 minutes (can be overridden)
AccessExpiry: 15 * time.Minute,

// Refresh token: 24 hours (can be overridden)
RefreshExpiry: 24 * time.Hour,

// JWT claims
Issuer:    "silence-notes"
Audience:  "silence-notes-users"
```

## Configuration Integration

The auth package integrates with the main configuration system via:

- `/backend/internal/config/config.go:119-126` - Auth configuration struct
- `/backend/internal/config/security.go:233-243` - Token security settings

## Testing the Setup

1. Start the backend server:
   ```bash
   cd backend
   go run cmd/server/main.go
   ```

2. Test the auth endpoint:
   ```bash
   curl http://localhost:8080/api/auth/google/url
   ```

3. Visit the returned URL to authenticate with Google

## Security Considerations

- **Environment Variables**: Never commit `.env` files to version control
- **HTTPS**: Always use HTTPS in production for OAuth callbacks
- **Secret Rotation**: Regularly rotate JWT secrets and OAuth client secrets
- **Domain Validation**: Ensure redirect URLs match your domain exactly
- **Rate Limiting**: The system includes rate limiting for auth endpoints

## Troubleshooting

### Common Issues

1. **Invalid redirect URI**: Ensure `GOOGLE_REDIRECT_URL` matches Google Cloud Console exactly
2. **JWT secret too short**: Must be at least 32 characters
3. **CORS errors**: Configure allowed origins in security config
4. **Token validation failures**: Check issuer/audience settings

### Debug Mode

Enable debug logging:
```bash
APP_DEBUG=true
LOG_LEVEL=debug
```

## API Endpoints

The auth package supports these typical endpoints (implementation in handlers):

- `GET /api/auth/google/url` - Get Google OAuth URL
- `POST /api/auth/google/callback` - OAuth callback handler
- `POST /api/auth/refresh` - Refresh access token
- `DELETE /api/auth/logout` - Logout/revoke tokens

## File Dependencies

- `golang.org/x/oauth2` - OAuth2 implementation
- `golang.org/x/oauth2/google` - Google OAuth2 endpoints
- `github.com/golang-jwt/jwt/v5` - JWT token handling
- `github.com/google/uuid` - UUID generation for tokens
- `github.com/go-playground/validator/v10` - Configuration validation