package routes

import (
	"github.com/gorilla/mux"
	"github.com/gpd/my-notes/internal/handlers"
	"github.com/gpd/my-notes/internal/middleware"
)

// UserRoutes sets up the user-related routes
func UserRoutes(router *mux.Router, userHandler *handlers.UserHandler, authMiddleware *middleware.AuthMiddleware) {
	// Create a subrouter for user routes with authentication
	userRouter := router.PathPrefix("/api/v1/users").Subrouter()

	// Apply authentication middleware to all user routes
	userRouter.Use(authMiddleware.Auth)

	// User Profile Management
	userRouter.HandleFunc("/profile", userHandler.GetUserProfile).Methods("GET")
	userRouter.HandleFunc("/profile", userHandler.UpdateUserProfile).Methods("PUT")
	userRouter.HandleFunc("/preferences", userHandler.GetUserPreferences).Methods("GET")
	userRouter.HandleFunc("/preferences", userHandler.UpdateUserPreferences).Methods("PUT")
	userRouter.HandleFunc("/stats", userHandler.GetUserStats).Methods("GET")

	// Session Management
	userRouter.HandleFunc("/sessions", userHandler.GetUserSessions).Methods("GET")
	userRouter.HandleFunc("/sessions", userHandler.DeleteAllUserSessions).Methods("DELETE")
	userRouter.HandleFunc("/sessions/{sessionId}", userHandler.DeleteUserSession).Methods("DELETE")

	// Account Management
	userRouter.HandleFunc("/account", userHandler.DeleteUserAccount).Methods("DELETE")
}

// PublicUserRoutes sets up public user routes that don't require authentication
func PublicUserRoutes(router *mux.Router, userHandler *handlers.UserHandler) {
	// User search (may be used for sharing/collaboration features)
	router.HandleFunc("/api/v1/users/search", userHandler.SearchUsers).Methods("GET")
}