package routes

import (
	"github.com/gorilla/mux"
	"github.com/gpd/my-notes/internal/handlers"
	"github.com/gpd/my-notes/internal/middleware"
)

// TagRoutes sets up the tag-related routes
func TagRoutes(router *mux.Router, tagHandler *handlers.TagsHandler, authMiddleware *middleware.AuthMiddleware) {
	// Create a subrouter for tag routes with authentication
	tagRouter := router.PathPrefix("/api/tags").Subrouter()

	// Apply authentication middleware to all tag routes
	tagRouter.Use(authMiddleware.Auth)

	// Tag CRUD Operations
	tagRouter.HandleFunc("", tagHandler.ListTags).Methods("GET")
	tagRouter.HandleFunc("", tagHandler.CreateTag).Methods("POST")
	tagRouter.HandleFunc("/{id}", tagHandler.GetTag).Methods("GET")
	tagRouter.HandleFunc("/{id}", tagHandler.UpdateTag).Methods("PUT")
	tagRouter.HandleFunc("/{id}", tagHandler.DeleteTag).Methods("DELETE")

	// Tag Discovery and Analytics
	tagRouter.HandleFunc("/suggestions", tagHandler.GetTagSuggestions).Methods("GET")
	tagRouter.HandleFunc("/popular", tagHandler.GetPopularTags).Methods("GET")
	tagRouter.HandleFunc("/unused", tagHandler.GetUnusedTags).Methods("GET")
	tagRouter.HandleFunc("/user", tagHandler.GetUserTags).Methods("GET")
	tagRouter.HandleFunc("/search", tagHandler.SearchTags).Methods("GET")

	// Tag Analytics
	tagRouter.HandleFunc("/{id}/analytics", tagHandler.GetTagAnalytics).Methods("GET")
	tagRouter.HandleFunc("/{id}/related", tagHandler.GetRelatedTags).Methods("GET")

	// Tag Management Operations
	tagRouter.HandleFunc("/cleanup", tagHandler.CleanupUnusedTags).Methods("POST")
	tagRouter.HandleFunc("/merge", tagHandler.MergeTags).Methods("POST")
}