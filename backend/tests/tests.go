package tests

import (
	"os"
	"strconv"
)

// This file makes the tests directory a valid Go package
// All test utilities and shared functionality are in setup_test.go

// This file is necessary for this command
// go clean -testcache && USE_POSTGRE_DURING_TEST=true go -C backend test ./tests/integration/... -v

// USE_POSTGRE_DURING_TEST controls whether PostgreSQL-dependent tests should run
// Set to false by default to skip PostgreSQL-dependent tests unless explicitly enabled
var USE_POSTGRE_DURING_TEST = getEnvBool("USE_POSTGRE_DURING_TEST", false)

// Helper functions for environment variables
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvBool(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		if boolValue, err := strconv.ParseBool(value); err == nil {
			return boolValue
		}
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}
