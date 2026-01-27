package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gpd/my-notes/internal/config"
	"github.com/gpd/my-notes/internal/database"
	"github.com/gpd/my-notes/internal/handlers"
	"github.com/gpd/my-notes/internal/server"
)

func main() {
	log.Println("🚀 Starting Silence Notes Backend API...")

	// Load configuration
	cfg, err := config.LoadConfig("")
	if err != nil {
		log.Fatalf("❌ Failed to load config: %v", err)
	}

	// Validate configuration
	if err := cfg.Validate(); err != nil {
		log.Fatalf("❌ Invalid config: %v", err)
	}

	log.Printf("✅ Configuration loaded successfully")
	log.Printf("🌐 Server will start on %s:%s", cfg.Server.Host, cfg.Server.Port)
	log.Printf("🗄️  Database: %s:%d/%s", cfg.Database.Host, cfg.Database.Port, cfg.Database.Name)
	log.Printf("🔧 Environment: %s", cfg.App.Environment)

	// Initialize database
	log.Println("📊 Initializing database connection...")
	db, err := database.NewConnection(cfg.Database)
	if err != nil {
		log.Fatalf("❌ Failed to connect to database: %v", err)
	}
	defer db.Close()

	// Test database connection
	if err := db.Ping(); err != nil {
		log.Fatalf("❌ Failed to ping database: %v", err)
	}
	log.Println("✅ Database connection established")

	// Run database migrations (all environments)
	log.Println("🔄 Running database migrations...")
	migrator := database.NewMigrator(db, "migrations")
	if err := migrator.Up(); err != nil {
		log.Fatalf("❌ Failed to run migrations: %v", err)
	}
	log.Println("✅ Database migrations completed")

	// Initialize handlers
	log.Println("🎯 Initializing handlers...")
	handlers := handlers.NewHandlers()

	// Create server
	log.Println("🖥️  Creating HTTP server...")
	srv := server.NewServer(cfg, handlers, db)

	// Start server in a goroutine
	go func() {
		log.Printf("🚀 Server starting on %s", cfg.Server.Address())
		if err := srv.Start(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("❌ Server failed to start: %v", err)
		}
	}()

	// Wait for interrupt signal to gracefully shutdown the server
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("🛑 Shutting down server...")

	// Create a deadline for shutdown
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Attempt graceful shutdown
	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("❌ Server forced to shutdown: %v", err)
	} else {
		log.Println("✅ Server shutdown completed")
	}

	log.Println("👋 Silence Notes Backend API stopped")
}