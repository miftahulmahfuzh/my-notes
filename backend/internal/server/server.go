package server

import (
	"context"
	"net/http"
	"time"

	"github.com/gpd/my-notes/internal/config"
	"github.com/gpd/my-notes/internal/handlers"
	"github.com/gpd/my-notes/internal/middleware"
	"github.com/gorilla/mux"
)

// Server represents the HTTP server
type Server struct {
	config   *config.Config
	router   *mux.Router
	httpServ *http.Server
	handlers *handlers.Handlers
}

// NewServer creates a new server instance
func NewServer(cfg *config.Config, h *handlers.Handlers) *Server {
	s := &Server{
		config:   cfg,
		router:   mux.NewRouter(),
		handlers: h,
	}

	s.setupMiddleware()
	s.setupRoutes()

	return s
}

// setupMiddleware configures the middleware stack
func (s *Server) setupMiddleware() {
	// Apply middleware in order
	s.router.Use(middleware.Recovery)
	s.router.Use(middleware.RequestID)
	s.router.Use(middleware.Logging)
	s.router.Use(middleware.ContentType)
	s.router.Use(middleware.SecurityHeaders)

	// CORS middleware
	corsMiddleware := middleware.CORS(
		s.config.CORS.AllowedOrigins,
		s.config.CORS.AllowedMethods,
		s.config.CORS.AllowedHeaders,
		s.config.CORS.MaxAge,
	)
	s.router.Use(corsMiddleware)

	// Timeout middleware (disabled for tests to prevent interference)
	if !s.config.IsTest() {
		timeoutDuration := time.Duration(s.config.Server.ReadTimeout) * time.Second
		s.router.Use(middleware.Timeout(timeoutDuration))
	}

	// Rate limiting (100 requests per minute for development, stricter in production)
	if s.config.IsProduction() {
		rateLimitMiddleware := middleware.RateLimit(100, time.Minute)
		s.router.Use(rateLimitMiddleware)
	}
}

// setupRoutes configures the API routes
func (s *Server) setupRoutes() {
	api := s.router.PathPrefix("/api/v1").Subrouter()

	// Health check endpoint (no authentication required)
	api.HandleFunc("/health", s.handlers.Health.HealthCheck).Methods("GET")

	// API routes (will be implemented in subsequent phases)
	// Authentication routes
	// api.HandleFunc("/auth/google", s.handlers.Auth.GoogleAuth).Methods("POST")
	// api.HandleFunc("/auth/refresh", s.handlers.Auth.RefreshToken).Methods("POST")
	// api.HandleFunc("/auth/logout", s.handlers.Auth.Logout).Methods("DELETE")

	// Protected routes (authentication middleware will be added in Phase 2)
	// protected := api.PathPrefix("/").Subrouter()
	// protected.Use(s.handlers.Auth.AuthenticationMiddleware)

	// Note routes
	// protected.HandleFunc("/notes", s.handlers.Notes.GetNotes).Methods("GET")
	// protected.HandleFunc("/notes", s.handlers.Notes.CreateNote).Methods("POST")
	// protected.HandleFunc("/notes/{id}", s.handlers.Notes.GetNote).Methods("GET")
	// protected.HandleFunc("/notes/{id}", s.handlers.Notes.UpdateNote).Methods("PUT")
	// protected.HandleFunc("/notes/{id}", s.handlers.Notes.DeleteNote).Methods("DELETE")

	// Tag routes
	// protected.HandleFunc("/tags", s.handlers.Tags.GetTags).Methods("GET")
	// protected.HandleFunc("/tags", s.handlers.Tags.CreateTag).Methods("POST")
	// protected.HandleFunc("/tags/suggestions", s.handlers.Tags.GetSuggestions).Methods("GET")

	// Search routes
	// protected.HandleFunc("/search/notes", s.handlers.Search.SearchNotes).Methods("GET")
	// protected.HandleFunc("/search/tags", s.handlers.Search.SearchTags).Methods("GET")

	// User routes
	// protected.HandleFunc("/user/profile", s.handlers.User.GetProfile).Methods("GET")
	// protected.HandleFunc("/user/profile", s.handlers.User.UpdateProfile).Methods("PUT")

	// Static routes for serving assets (if needed)
	// s.router.PathPrefix("/static/").Handler(http.StripPrefix("/static/", http.FileServer(http.Dir("./static/"))))

	// Catch-all route for 404
	s.router.PathPrefix("/").HandlerFunc(s.notFoundHandler)
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