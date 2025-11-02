package main

import (
	"database/sql"
	"fmt"
	"log"
	"time"

	_ "github.com/lib/pq"
	"github.com/gpd/my-notes/internal/services"
)

func main() {
	// Database connection
	connStr := "host=localhost port=5432 user=test_user password=test_password dbname=my_notes_test sslmode=disable"
	db, err := sql.Open("postgres", connStr)
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}
	defer db.Close()

	// Test connection
	if err := db.Ping(); err != nil {
		log.Fatal("Failed to ping database:", err)
	}

	fmt.Println("✅ Connected to database")

	// Initialize template service
	templateService := services.NewTemplateService(db)
	fmt.Println("✅ Template service initialized")

	// Test 1: Get built-in templates
	fmt.Println("\n=== Testing GetBuiltInTemplates ===")
	templates, err := templateService.GetBuiltInTemplates()
	if err != nil {
		log.Fatal("Failed to get built-in templates:", err)
	}

	fmt.Printf("✅ Found %d built-in templates:\n", len(templates))
	for _, template := range templates {
		fmt.Printf("  - %s (%s): %s\n", template.Name, template.ID, template.Category)
		fmt.Printf("    Content preview: %.100s...\n", template.Content)
	}

	// Test 2: Test template variables and structure
	fmt.Println("\n=== Testing Template Structure ===")
	for _, template := range templates {
		fmt.Printf("\nTemplate: %s\n", template.Name)
		fmt.Printf("  ID: %s\n", template.ID)
		fmt.Printf("  Category: %s\n", template.Category)
		fmt.Printf("  Is Built-in: %t\n", template.IsBuiltIn)
		fmt.Printf("  Variables: %v\n", template.Variables)
		fmt.Printf("  Usage Count: %d\n", template.UsageCount)
		fmt.Printf("  Is Public: %t\n", template.IsPublic)
		fmt.Printf("  Icon: %s\n", template.Icon)
		fmt.Printf("  Tags: %v\n", template.Tags)
		fmt.Printf("  Created: %s\n", template.CreatedAt.Format(time.RFC3339))
	}

	// Test 3: Test applying a template
	fmt.Println("\n=== Testing ApplyTemplate ===")
	if len(templates) > 0 {
		template := templates[0]
		fmt.Printf("Testing template: %s\n", template.Name)

		// Prepare variables based on template variables
		variables := make(map[string]string)
		for _, variable := range template.Variables {
			switch variable {
			case "date":
				variables[variable] = time.Now().Format("2006-01-02")
			case "time":
				variables[variable] = time.Now().Format("15:04")
			case "datetime":
				variables[variable] = time.Now().Format(time.RFC3339)
			case "today":
				variables[variable] = time.Now().Format("January 2, 2006")
			case "mood":
				variables[variable] = "Happy"
			case "highlights":
				variables[variable] = "Completed project milestone"
			case "gratitude":
				variables[variable] = "Grateful for team support"
			case "lessons":
				variables[variable] = "Learned about new technology"
			case "attendees":
				variables[variable] = "John Doe, Jane Smith"
			case "agenda":
				variables[variable] = "1. Project review\n2. Planning session"
			case "action_items":
				variables[variable] = "- Follow up with client\n- Prepare report"
			case "next_steps":
				variables[variable] = "Schedule next meeting for next week"
			default:
				variables[variable] = fmt.Sprintf("Sample %s", variable)
			}
		}

		// Create apply request
		applyReq := &services.ApplyTemplateRequest{
			TemplateID: template.ID,
			UserID:     template.UserID, // Use nil for built-in
			Variables:  variables,
		}

		// Apply template
		result, err := templateService.ApplyTemplate(applyReq)
		if err != nil {
			log.Printf("Failed to apply template %s: %v", template.Name, err)
		} else {
			fmt.Printf("✅ Template applied successfully!\n")
			fmt.Printf("Generated content:\n%s\n", result.Content)
		}
	}

	fmt.Println("\n=== All Tests Completed Successfully! ===")
}