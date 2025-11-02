package server

import (
	"context"
	"database/sql"
	"log"
	"net/http"
	"time"

	"github.com/gpd/my-notes/internal/auth"
	"github.com/gpd/my-notes/internal/config"
	"github.com/gpd/my-notes/internal/handlers"
	"github.com/gpd/my-notes/internal/middleware"
	"github.com/gpd/my-notes/internal/services"
	"github.com/gorilla/mux"
	"github.com/gorilla/sessions"
)

// Server represents the HTTP server
type Server struct {
	config        *config.Config
	router        *mux.Router
	httpServ      *http.Server
	handlers      *handlers.Handlers
	db            *sql.DB
	userService   services.UserServiceInterface
	tokenService  *auth.TokenService
	oauthService  *auth.OAuthService
	sessionStore  sessions.Store
	securityMW    *middleware.SecurityMiddleware
	sessionMW     *middleware.SessionMiddleware
	rateLimitMW   *middleware.RateLimitingMiddleware
}

// NewServer creates a new server instance
func NewServer(cfg *config.Config, h *handlers.Handlers, db *sql.DB) *Server {
	s := &Server{
		config:   cfg,
		router:   mux.NewRouter(),
		handlers: h,
		db:       db,
	}

	s.initializeServices()
	s.setupMiddleware()
	s.setupRoutes()

	return s
}

// initializeServices initializes all services needed for middleware
func (s *Server) initializeServices() {
	// Initialize user service
	s.userService = services.NewUserService(s.db)

	// Initialize tag service
	tagService := services.NewTagService(s.db)

	// Initialize token service
	tokenSecret := s.config.Auth.JWTSecret
	if tokenSecret == "" {
		log.Println("⚠️  Warning: Using default JWT secret key - please set JWT_SECRET in production")
		tokenSecret = "your-secret-key-change-in-production"
	}
	s.tokenService = auth.NewTokenService(
		tokenSecret,
		time.Duration(s.config.Auth.TokenExpiry)*time.Hour,
		time.Duration(s.config.Auth.RefreshExpiry)*time.Hour,
		"silence-notes",
		"silence-notes-users",
	)

	// Initialize security configuration
	var securityConfig *config.SecurityConfig
	switch s.config.App.Environment {
	case "development":
		securityConfig = config.GetDevelopmentSecurityConfig()
	case "production":
		securityConfig = config.GetProductionSecurityConfig()
	default:
		securityConfig = config.GetDefaultSecurityConfig()
	}

	// Initialize security middleware
	s.securityMW = middleware.NewSecurityMiddleware(
		s.tokenService,
		s.userService,
		securityConfig,
		&securityConfig.CORS,
	)

	// Initialize session middleware
	sessionConfig := &middleware.SessionConfig{
		SessionTimeout:     securityConfig.Session.SessionTimeout,
		MaxSessions:        securityConfig.Session.MaxSessions,
		EnableConcurrency:  securityConfig.Session.EnableConcurrency,
		InactiveTimeout:    securityConfig.Session.InactiveTimeout,
		RefreshThreshold:   securityConfig.Session.RefreshThreshold,
	}
	s.sessionMW = middleware.NewSessionMiddleware(s.userService, s.db, sessionConfig)

	// Initialize rate limiting middleware
	rateLimitConfig := &middleware.RateLimitConfig{
		GlobalRequestsPerSecond: securityConfig.RateLimiting.GlobalRequestsPerSecond,
		GlobalBurstSize:         securityConfig.RateLimiting.GlobalBurstSize,
		UserRequestsPerMinute:   securityConfig.RateLimiting.UserRequestsPerMinute,
		UserRequestsPerHour:     securityConfig.RateLimiting.UserRequestsPerHour,
		UserRequestsPerDay:      securityConfig.RateLimiting.UserRequestsPerDay,
		AuthRequestsPerMinute:   securityConfig.RateLimiting.AuthRequestsPerMinute,
		ProfileRequestsPerMinute: securityConfig.RateLimiting.ProfileRequestsPerMinute,
		SearchRequestsPerMinute: securityConfig.RateLimiting.SearchRequestsPerMinute,
		WhitelistedIPs:          securityConfig.RateLimiting.WhitelistedIPs,
		WhitelistedUsers:        securityConfig.RateLimiting.WhitelistedUsers,
	}
	s.rateLimitMW = middleware.NewRateLimitingMiddleware(s.userService, s.tokenService, rateLimitConfig)

	// Initialize OAuth service
	googleConfig := &auth.GoogleConfig{
		ClientID:     s.config.Auth.GoogleClientID,
		ClientSecret: s.config.Auth.GoogleClientSecret,
		RedirectURL:  s.config.Auth.GoogleRedirectURL,
		Scopes:       auth.DefaultScopes(),
	}
	s.oauthService = auth.NewOAuthService(googleConfig)

	// Initialize session store
	sessionSecret := []byte(s.config.Auth.JWTSecret)
	if len(sessionSecret) == 0 {
		sessionSecret = []byte("your-session-secret-change-in-production")
		log.Println("⚠️  Warning: Using default session secret - please set JWT_SECRET in production")
	}
	s.sessionStore = sessions.NewCookieStore(sessionSecret)
	if cookieStore, ok := s.sessionStore.(*sessions.CookieStore); ok {
		cookieStore.Options = &sessions.Options{
			Path:     "/",
			MaxAge:   int(securityConfig.Session.SessionTimeout.Seconds()),
			HttpOnly: true,
			Secure:   s.config.App.Environment == "production",
			SameSite: http.SameSiteStrictMode,
		}
	}

	// Initialize auth handlers
	authHandler := handlers.NewAuthHandler(
		s.oauthService,
		s.tokenService,
		s.userService,
		s.sessionStore,
	)

	// Initialize Chrome extension auth handler
	chromeAuthHandler := handlers.NewChromeAuthHandler(
		s.tokenService,
		s.userService,
	)

	userHandler := handlers.NewUserHandler(s.userService)

	// Initialize note service and handler
	noteService := services.NewNoteService(s.db, tagService)
	notesHandler := handlers.NewNotesHandler(noteService)

	// Initialize security handler with middleware dependencies
	s.handlers.SetSecurityMiddleware(s.rateLimitMW, s.sessionMW)

	// Initialize auth handlers
	s.handlers.SetAuthHandlers(authHandler, chromeAuthHandler, userHandler)

	// Initialize notes handler
	s.handlers.SetNotesHandler(notesHandler)

	// Initialize markdown handler
	markdownHandler := handlers.NewMarkdownHandler()
	s.handlers.SetMarkdownHandler(markdownHandler)

	// Initialize template service and handler
	templateService := services.NewTemplateService(s.db)
	templateHandler := handlers.NewTemplateHandler(templateService)
	s.handlers.SetTemplateHandler(templateHandler)

	// Initialize export/import service and handler
	exportImportService := services.NewExportImportService(s.db)
	exportImportHandler := handlers.NewExportImportHandler(exportImportService)
	s.handlers.SetExportImportHandler(exportImportHandler)

	log.Printf("✅ Security services initialized")
	log.Printf("🔒 Security mode: %s", s.config.App.Environment)
	log.Printf("🚦 Rate limiting: %.0f req/sec global, %d req/min per user",
		securityConfig.RateLimiting.GlobalRequestsPerSecond,
		securityConfig.RateLimiting.UserRequestsPerMinute)
}

// setupMiddleware configures the middleware stack
func (s *Server) setupMiddleware() {
	// Apply core middleware first
	s.router.Use(middleware.Recovery)
	s.router.Use(middleware.RequestID)
	s.router.Use(middleware.Logging)
	s.router.Use(middleware.ContentType)

	// Apply comprehensive security middleware
	if s.securityMW != nil {
		s.router.Use(s.securityMW.Security)
	}

	// Apply rate limiting middleware
	if s.rateLimitMW != nil {
		s.router.Use(s.rateLimitMW.RateLimit)
	}

	// Apply session management middleware (only to authenticated routes)
	if s.sessionMW != nil {
		// Session middleware will be applied selectively to protected routes
		// to avoid session checks on public endpoints like health check
	}

	// Timeout middleware (disabled for tests to prevent interference)
	if !s.config.IsTest() {
		timeoutDuration := time.Duration(s.config.Server.ReadTimeout) * time.Second
		s.router.Use(middleware.Timeout(timeoutDuration))
	}

	log.Printf("✅ Middleware stack configured")
}

// setupRoutes configures the API routes
func (s *Server) setupRoutes() {
	api := s.router.PathPrefix("/api/v1").Subrouter()

	// Health check endpoint (no authentication required)
	api.HandleFunc("/health", s.handlers.Health.HealthCheck).Methods("GET")

	// Public authentication routes (no session middleware needed)
	auth := api.PathPrefix("/auth").Subrouter()
	if s.handlers.Auth != nil {
		auth.HandleFunc("/google", s.handlers.Auth.GoogleAuth).Methods("POST")
		auth.HandleFunc("/exchange", s.handlers.Auth.GoogleCallback).Methods("POST") // for test compatibility
		auth.HandleFunc("/refresh", s.handlers.Auth.RefreshToken).Methods("POST") // token refresh doesn't need auth
		auth.HandleFunc("/validate", s.handlers.Auth.ValidateToken).Methods("GET")
	}

	// Chrome extension specific authentication route
	if s.handlers.ChromeAuth != nil {
		auth.HandleFunc("/chrome", s.handlers.ChromeAuth.ExchangeChromeToken).Methods("POST")
	}

	// Protected routes with authentication and session management
	protected := api.PathPrefix("/").Subrouter()

	// Apply authentication middleware
	if s.securityMW != nil {
		protected.Use(s.securityMW.EnhancedAuth)
	}

	// Apply session management middleware
	if s.sessionMW != nil {
		protected.Use(s.sessionMW.SessionManager)
	}

	// Token management routes
	if s.handlers.Auth != nil {
		protected.HandleFunc("/auth/logout", s.handlers.Auth.Logout).Methods("DELETE")
	}

	// User profile routes
	if s.handlers.User != nil {
		protected.HandleFunc("/user/profile", s.handlers.User.GetProfile).Methods("GET")
		protected.HandleFunc("/user/profile", s.handlers.User.UpdateUserProfile).Methods("PUT")
		protected.HandleFunc("/user/preferences", s.handlers.User.GetUserPreferences).Methods("GET")
		protected.HandleFunc("/user/preferences", s.handlers.User.UpdateUserPreferences).Methods("PUT")
		protected.HandleFunc("/user/sessions", s.handlers.User.GetUserSessions).Methods("GET")
		protected.HandleFunc("/user/sessions/{sessionId}", s.handlers.User.DeleteUserSession).Methods("DELETE")
	}

	// Note routes
	if s.handlers.Notes != nil {
		protected.HandleFunc("/notes", s.handlers.Notes.ListNotes).Methods("GET")
		protected.HandleFunc("/notes", s.handlers.Notes.CreateNote).Methods("POST")
		protected.HandleFunc("/notes/{id}", s.handlers.Notes.GetNote).Methods("GET")
		protected.HandleFunc("/notes/{id}", s.handlers.Notes.UpdateNote).Methods("PUT")
		protected.HandleFunc("/notes/{id}", s.handlers.Notes.DeleteNote).Methods("DELETE")
		protected.HandleFunc("/notes/sync", s.handlers.Notes.SyncNotes).Methods("GET")
		protected.HandleFunc("/notes/batch", s.handlers.Notes.BatchCreateNotes).Methods("POST")
		protected.HandleFunc("/notes/batch", s.handlers.Notes.BatchUpdateNotes).Methods("PUT")
		protected.HandleFunc("/notes/stats", s.handlers.Notes.GetNoteStats).Methods("GET")
		protected.HandleFunc("/notes/tags/{tag}", s.handlers.Notes.GetNotesByTag).Methods("GET")
	}

	// Search routes
	protected.HandleFunc("/search/notes", s.handlers.Notes.SearchNotes).Methods("GET")

	// Tag routes
	// protected.HandleFunc("/tags", s.handlers.Tags.GetTags).Methods("GET")
	// protected.HandleFunc("/tags", s.handlers.Tags.CreateTag).Methods("POST")
	// protected.HandleFunc("/tags/suggestions", s.handlers.Tags.GetSuggestions).Methods("GET")

	// Markdown routes
	if s.handlers.Markdown != nil {
		protected.HandleFunc("/markdown/preview", s.handlers.Markdown.PreviewMarkdown).Methods("POST")
		protected.HandleFunc("/markdown/help", s.handlers.Markdown.GetMarkdownHelp).Methods("GET")
		protected.HandleFunc("/markdown/validate", s.handlers.Markdown.ValidateMarkdown).Methods("POST")
		protected.HandleFunc("/markdown/metadata", s.handlers.Markdown.ExtractMetadata).Methods("POST")
		protected.HandleFunc("/markdown/tags", s.handlers.Markdown.ExtractTags).Methods("POST")
	}

	// Template routes
	if s.handlers.Templates != nil {
		protected.HandleFunc("/templates", s.handlers.Templates.GetTemplates).Methods("GET")
		protected.HandleFunc("/templates", s.handlers.Templates.CreateTemplate).Methods("POST")
		protected.HandleFunc("/templates/built-in", s.handlers.Templates.GetBuiltInTemplates).Methods("GET")
		protected.HandleFunc("/templates/{id}", s.handlers.Templates.GetTemplate).Methods("GET")
		protected.HandleFunc("/templates/{id}", s.handlers.Templates.UpdateTemplate).Methods("PUT")
		protected.HandleFunc("/templates/{id}", s.handlers.Templates.DeleteTemplate).Methods("DELETE")
		protected.HandleFunc("/templates/{id}/apply", s.handlers.Templates.ApplyTemplate).Methods("POST")
		protected.HandleFunc("/templates/search", s.handlers.Templates.SearchTemplates).Methods("GET")
		protected.HandleFunc("/templates/popular", s.handlers.Templates.GetPopularTemplates).Methods("GET")
		protected.HandleFunc("/templates/stats", s.handlers.Templates.GetTemplateStats).Methods("GET")
	}

	// Export/Import routes
	if s.handlers.ExportImport != nil {
		protected.HandleFunc("/export", s.handlers.ExportImport.ExportData).Methods("GET")
		protected.HandleFunc("/import", s.handlers.ExportImport.ImportData).Methods("POST")
		protected.HandleFunc("/export/formats", s.handlers.ExportImport.GetExportFormats).Methods("GET")
		protected.HandleFunc("/import/info", s.handlers.ExportImport.GetImportInfo).Methods("GET")
		protected.HandleFunc("/export/history", s.handlers.ExportImport.GetExportHistory).Methods("GET")
		protected.HandleFunc("/import/validate", s.handlers.ExportImport.ValidateImportFile).Methods("POST")
	}

	// Search routes are now handled by the notes handler

	// Security and monitoring routes
	if s.handlers.Security != nil {
		protected.HandleFunc("/security/rate-limit", s.handlers.Security.GetRateLimitInfo).Methods("GET")
		protected.HandleFunc("/security/session-info", s.handlers.Security.GetSessionInfo).Methods("GET")
		protected.HandleFunc("/security/metrics", s.handlers.Security.GetSecurityMetrics).Methods("GET")
	}

	// Static routes for serving assets (if needed)
	// s.router.PathPrefix("/static/").Handler(http.StripPrefix("/static/", http.FileServer(http.Dir("./static/"))))

	// Catch-all route for 404
	s.router.PathPrefix("/").HandlerFunc(s.notFoundHandler)

	log.Printf("✅ Routes configured - Public: /api/v1/health, /api/v1/auth/*")
	log.Printf("🔒 Protected routes: /api/v1/* (requires authentication + session)")
}

// Start starts the HTTP server
func (s *Server) Start() error {
	s.httpServ = &http.Server{
		Addr:         s.config.Server.Address(),
		Handler:      s.router,
		ReadTimeout:  time.Duration(s.config.Server.ReadTimeout) * time.Second,
		WriteTimeout: time.Duration(s.config.Server.WriteTimeout) * time.Second,
		IdleTimeout:  time.Duration(s.config.Server.IdleTimeout) * time.Second,
	}

	return s.httpServ.ListenAndServe()
}

// Shutdown gracefully shuts down the server
func (s *Server) Shutdown(ctx context.Context) error {
	if s.httpServ != nil {
		return s.httpServ.Shutdown(ctx)
	}
	return nil
}

// notFoundHandler handles 404 errors
func (s *Server) notFoundHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(http.StatusNotFound)
	w.Write([]byte(`{"error":"Not found"}`))
}

// GetRouter returns the router (useful for testing)
func (s *Server) GetRouter() *mux.Router {
	return s.router
}

// ResetRateLimiters resets all rate limiters (for testing)
func (s *Server) ResetRateLimiters() {
	// Reset rate limiting middleware
	if s.rateLimitMW != nil {
		s.rateLimitMW.ResetGlobalRateLimiter()
		s.rateLimitMW.ResetUserRateLimiters()
	}

	// Reset security middleware rate limiter
	if s.securityMW != nil {
		s.securityMW.Reset()
	}

	// Clear any remaining global rate limiters
	middleware.ClearUserRateLimiters()
}