package main

import (
	"database/sql"
	"flag"
	"fmt"
	"log"
	"os"

	"github.com/gpd/my-notes/internal/config"
	"github.com/gpd/my-notes/internal/database"
	_ "github.com/lib/pq"
)

func main() {
	var (
		action     = flag.String("action", "status", "Migration action: up, down, status, create")
		name       = flag.String("name", "", "Migration name (for create action)")
		configPath = flag.String("config", "", "Path to config file")
	)
	flag.Parse()

	// Load configuration
	cfg, err := config.LoadConfig(*configPath)
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// Connect to database
	db, err := sql.Open("postgres", cfg.Database.DSN())
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	// Test connection
	if err := db.Ping(); err != nil {
		log.Fatalf("Failed to ping database: %v", err)
	}

	// Create migrator
	migrator := database.NewMigrator(db, "migrations")

	// Execute action
	switch *action {
	case "up":
		if err := migrator.Up(); err != nil {
			log.Fatalf("Migration up failed: %v", err)
		}
	case "down":
		if err := migrator.Down(); err != nil {
			log.Fatalf("Migration down failed: %v", err)
		}
	case "status":
		if err := migrator.Status(); err != nil {
			log.Fatalf("Migration status failed: %v", err)
		}
	case "create":
		if *name == "" {
			fmt.Println("Migration name is required for create action")
			flag.Usage()
			os.Exit(1)
		}
		if err := migrator.CreateMigration(*name); err != nil {
			log.Fatalf("Migration creation failed: %v", err)
		}
	default:
		fmt.Printf("Unknown action: %s\n", *action)
		flag.Usage()
		os.Exit(1)
	}
}