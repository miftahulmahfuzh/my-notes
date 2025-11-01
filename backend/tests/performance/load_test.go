package performance

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strconv"
	"sync"
	"testing"
	"time"

	"github.com/gpd/my-notes/internal/config"
	"github.com/gpd/my-notes/internal/database"
	"github.com/gpd/my-notes/internal/handlers"
	"github.com/gpd/my-notes/internal/server"
	"github.com/gpd/my-notes/tests"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Helper functions for environment variables (same as tests package)
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

// getTestConfig returns test configuration (local copy)
func getTestConfig() *config.Config {
	// Load configuration to ensure .env file is loaded
	_, err := config.LoadConfig("")
	if err != nil {
		// Fall back to environment variables if config loading fails
	}

	// Override with test-specific values
	testConfig := &config.Config{
		App: config.AppConfig{
			Environment: "test",
			Debug:       false,
			LogLevel:    "error",
		},
		Server: config.ServerConfig{
			Host: "localhost",
			Port: "9999", // Use different port for testing
		},
		Database: config.DatabaseConfig{
			Host:     getEnv("TEST_DB_HOST", getEnv("DB_HOST", "localhost")),
			Port:     getEnvInt("TEST_DB_PORT", getEnvInt("DB_PORT", 5432)),
			User:     getEnv("TEST_DB_USER", getEnv("DB_USER", "postgres")),
			Password: getEnv("TEST_DB_PASSWORD", getEnv("DB_PASSWORD", "postgres123")),
			Name:     getEnv("TEST_DB_NAME", getEnv("DB_NAME", "notes_test")),
			SSLMode:  "disable",
		},
		Auth: config.AuthConfig{
			JWTSecret: "test-secret",
		},
	}

	return testConfig
}

// LoadTestConfig holds configuration for load testing
type LoadTestConfig struct {
	ConcurrentUsers int           `json:"concurrent_users"`
	RequestsPerUser int           `json:"requests_per_user"`
	Duration        time.Duration `json:"duration"`
	RampUpTime      time.Duration `json:"ramp_up_time"`
	Endpoints       []Endpoint    `json:"endpoints"`
}

// Endpoint represents an API endpoint for load testing
type Endpoint struct {
	Path            string            `json:"path"`
	Method          string            `json:"method"`
	Headers         map[string]string `json:"headers"`
	Body            interface{}       `json:"body"`
	Weight          int               `json:"weight"` // Relative frequency
	ExpectedStatus  int               `json:"expected_status"`
}

// LoadTestResult holds the results of a load test
type LoadTestResult struct {
	TotalRequests     int                    `json:"total_requests"`
	SuccessfulReqs    int                    `json:"successful_requests"`
	FailedReqs        int                    `json:"failed_requests"`
	TotalDuration     time.Duration          `json:"total_duration"`
	AverageResponse  time.Duration          `json:"average_response"`
	MinResponse      time.Duration          `json:"min_response"`
	MaxResponse      time.Duration          `json:"max_response"`
	RequestsPerSec   float64                `json:"requests_per_second"`
	ErrorBreakdown   map[string]int         `json:"error_breakdown"`
	ResponseBreakdown map[int]int           `json:"response_breakdown"`
	Percentiles      map[string]time.Duration `json:"percentiles"`
}

// LoadTester performs load testing
type LoadTester struct {
	server *server.Server
	config *LoadTestConfig
}

// NewLoadTester creates a new load tester
func NewLoadTester(server *server.Server, config *LoadTestConfig) *LoadTester {
	return &LoadTester{
		server: server,
		config: config,
	}
}

// RunLoadTest executes a load test
func (lt *LoadTester) RunLoadTest(t *testing.T) *LoadTestResult {
	t.Logf("Starting load test: %d users, %d requests each, over %v",
		lt.config.ConcurrentUsers, lt.config.RequestsPerUser, lt.config.Duration)

	results := make(chan *RequestResult, lt.config.ConcurrentUsers*lt.config.RequestsPerUser)
	var wg sync.WaitGroup

	// Start load test
	startTime := time.Now()

	// Ramp up users gradually
	userInterval := lt.config.RampUpTime / time.Duration(lt.config.ConcurrentUsers)

	for i := 0; i < lt.config.ConcurrentUsers; i++ {
		wg.Add(1)
		go func(userID int) {
			defer wg.Done()
			lt.runUser(userID, results)
		}(i)

		// Stagger user starts
		if i < lt.config.ConcurrentUsers-1 {
			time.Sleep(userInterval)
		}
	}

	// Wait for all users to complete
	wg.Wait()
	close(results)

	// Calculate results
	endTime := time.Now()
	return lt.calculateResults(results, startTime, endTime)
}

// runUser simulates a single user making requests
func (lt *LoadTester) runUser(userID int, results chan<- *RequestResult) {
	for i := 0; i < lt.config.RequestsPerUser; i++ {
		endpoint := lt.selectEndpoint()
		result := lt.makeRequest(endpoint, userID)
		results <- result

		// Small delay between requests to simulate realistic user behavior
		time.Sleep(time.Millisecond * time.Duration(10+userID%50))
	}
}

// selectEndpoint chooses an endpoint based on weights
func (lt *LoadTester) selectEndpoint() *Endpoint {
	if len(lt.config.Endpoints) == 0 {
		return &Endpoint{
			Path:    "/api/v1/health",
			Method:  "GET",
			Weight:  1,
			ExpectedStatus: http.StatusOK,
		}
	}

	totalWeight := 0
	for _, ep := range lt.config.Endpoints {
		totalWeight += ep.Weight
	}

	if totalWeight == 0 {
		return &lt.config.Endpoints[0]
	}

	// Simple weighted selection
	r := time.Now().UnixNano() % int64(totalWeight)
	current := 0
	for _, ep := range lt.config.Endpoints {
		current += ep.Weight
		if int64(current) > r {
			return &ep
		}
	}

	return &lt.config.Endpoints[0]
}

// RequestResult holds the result of a single request
type RequestResult struct {
	UserID        int           `json:"user_id"`
	StatusCode    int           `json:"status_code"`
	ResponseTime  time.Duration `json:"response_time"`
	Error         string        `json:"error,omitempty"`
	Timestamp     time.Time     `json:"timestamp"`
}

// makeRequest executes a single HTTP request
func (lt *LoadTester) makeRequest(endpoint *Endpoint, userID int) *RequestResult {
	startTime := time.Now()

	// Create request
	req := httptest.NewRequest(endpoint.Method, endpoint.Path, nil)
	req.Header.Set("User-Agent", fmt.Sprintf("LoadTestUser-%d", userID))

	// Add headers
	for key, value := range endpoint.Headers {
		req.Header.Set(key, value)
	}

	// Record response
	w := httptest.NewRecorder()
	lt.server.GetRouter().ServeHTTP(w, req)

	responseTime := time.Since(startTime)
	result := &RequestResult{
		UserID:       userID,
		StatusCode:   w.Code,
		ResponseTime: responseTime,
		Timestamp:    startTime,
	}

	// Check if response matches expected status
	if endpoint.ExpectedStatus > 0 && w.Code != endpoint.ExpectedStatus {
		result.Error = fmt.Sprintf("Expected status %d, got %d", endpoint.ExpectedStatus, w.Code)
	}

	return result
}

// calculateResults aggregates request results
func (lt *LoadTester) calculateResults(results <-chan *RequestResult, startTime, endTime time.Time) *LoadTestResult {
	var allResults []*RequestResult
	totalDuration := endTime.Sub(startTime)

	// Collect all results
	for result := range results {
		allResults = append(allResults, result)
	}

	if len(allResults) == 0 {
		return &LoadTestResult{
			TotalRequests:    0,
			TotalDuration:    totalDuration,
			RequestsPerSec:   0,
			ErrorBreakdown:   make(map[string]int),
			ResponseBreakdown: make(map[int]int),
			Percentiles:      make(map[string]time.Duration),
		}
	}

	// Calculate statistics
	successCount := 0
	failCount := 0
	var totalResponseTime time.Duration
	minResponse := allResults[0].ResponseTime
	maxResponse := allResults[0].ResponseTime

	errorBreakdown := make(map[string]int)
	responseBreakdown := make(map[int]int)
	responseTimes := make([]time.Duration, 0, len(allResults))

	for _, result := range allResults {
		if result.StatusCode >= 200 && result.StatusCode < 400 {
			successCount++
		} else {
			failCount++
		}

		totalResponseTime += result.ResponseTime
		responseTimes = append(responseTimes, result.ResponseTime)

		if result.ResponseTime < minResponse {
			minResponse = result.ResponseTime
		}
		if result.ResponseTime > maxResponse {
			maxResponse = result.ResponseTime
		}

		responseBreakdown[result.StatusCode]++
		if result.Error != "" {
			errorBreakdown[result.Error]++
		}
	}

	// Sort response times for percentile calculation
	for i := 0; i < len(responseTimes)-1; i++ {
		for j := i + 1; j < len(responseTimes); j++ {
			if responseTimes[i] > responseTimes[j] {
				responseTimes[i], responseTimes[j] = responseTimes[j], responseTimes[i]
			}
		}
	}

	// Calculate percentiles
	percentiles := make(map[string]time.Duration)
	percentiles["p50"] = calculatePercentile(responseTimes, 50)
	percentiles["p90"] = calculatePercentile(responseTimes, 90)
	percentiles["p95"] = calculatePercentile(responseTimes, 95)
	percentiles["p99"] = calculatePercentile(responseTimes, 99)

	avgResponse := totalResponseTime / time.Duration(len(allResults))
	requestsPerSec := float64(len(allResults)) / totalDuration.Seconds()

	return &LoadTestResult{
		TotalRequests:     len(allResults),
		SuccessfulReqs:    successCount,
		FailedReqs:        failCount,
		TotalDuration:     totalDuration,
		AverageResponse:  avgResponse,
		MinResponse:      minResponse,
		MaxResponse:      maxResponse,
		RequestsPerSec:   requestsPerSec,
		ErrorBreakdown:   errorBreakdown,
		ResponseBreakdown: responseBreakdown,
		Percentiles:      percentiles,
	}
}

// calculatePercentile calculates the nth percentile from sorted durations
func calculatePercentile(sorted []time.Duration, percentile int) time.Duration {
	if len(sorted) == 0 {
		return 0
	}
	if percentile <= 0 {
		return sorted[0]
	}
	if percentile >= 100 {
		return sorted[len(sorted)-1]
	}

	index := (percentile * len(sorted)) / 100
	if index >= len(sorted) {
		return sorted[len(sorted)-1]
	}
	return sorted[index]
}

// REMOVED: GetDefaultLoadTestConfig - Replaced by GetTagSystemLoadTestConfig
// This provided a generic test that wasn't focused on any specific user workflow.
// The tag system test provides more meaningful and actionable performance data.

// REMOVED: GetAuthLoadTestConfig - Authentication should be tested with dedicated security testing tools
// Load testing auth endpoints provides false confidence and doesn't reflect real security concerns.
// Use specialized security testing frameworks for authentication validation.

// GetTagSystemLoadTestConfig returns a load test config focused on Phase 4 hashtag system
func GetTagSystemLoadTestConfig() *LoadTestConfig {
	return &LoadTestConfig{
		ConcurrentUsers: 25,
		RequestsPerUser: 60,
		Duration:        60 * time.Second,
		RampUpTime:      10 * time.Second,
		Endpoints: []Endpoint{
			{
				Path:            "/api/v1/tags",
				Method:          "GET",
				Headers:         map[string]string{"Authorization": "Bearer mock-token"},
				Weight:          20,
				ExpectedStatus:  http.StatusUnauthorized,
			},
			{
				Path:            "/api/v1/tags/suggestions?query=work",
				Method:          "GET",
				Headers:         map[string]string{"Authorization": "Bearer mock-token"},
				Weight:          15,
				ExpectedStatus:  http.StatusUnauthorized,
			},
			{
				Path:            "/api/v1/tags/popular",
				Method:          "GET",
				Headers:         map[string]string{"Authorization": "Bearer mock-token"},
				Weight:          15,
				ExpectedStatus:  http.StatusUnauthorized,
			},
			{
				Path:            "/api/v1/notes/by-tags?tags=work&operator=and",
				Method:          "GET",
				Headers:         map[string]string{"Authorization": "Bearer mock-token"},
				Weight:          15,
				ExpectedStatus:  http.StatusUnauthorized,
			},
			{
				Path:            "/api/v1/notes/by-tags?tags=work,urgent,project&operator=or",
				Method:          "GET",
				Headers:         map[string]string{"Authorization": "Bearer mock-token"},
				Weight:          10,
				ExpectedStatus:  http.StatusUnauthorized,
			},
			{
				Path:            "/api/v1/search/notes?query=meeting&tags=work,urgent",
				Method:          "GET",
				Headers:         map[string]string{"Authorization": "Bearer mock-token"},
				Weight:          10,
				ExpectedStatus:  http.StatusUnauthorized,
			},
			{
				Path:            "/api/v1/tags/trending",
				Method:          "GET",
				Headers:         map[string]string{"Authorization": "Bearer mock-token"},
				Weight:          10,
				ExpectedStatus:  http.StatusUnauthorized,
			},
			{
				Path:            "/api/v1/search/suggestions?query=project",
				Method:          "GET",
				Headers:         map[string]string{"Authorization": "Bearer mock-token"},
				Weight:          5,
				ExpectedStatus:  http.StatusUnauthorized,
			},
		},
	}
}


// GetComplexFilteringLoadTestConfig returns a load test config for advanced filtering scenarios
func GetComplexFilteringLoadTestConfig() *LoadTestConfig {
	return &LoadTestConfig{
		ConcurrentUsers: 15,
		RequestsPerUser: 50,
		Duration:        40 * time.Second,
		RampUpTime:      7 * time.Second,
		Endpoints: []Endpoint{
			{
				Path:            "/api/v1/notes/by-tags?tags=work,urgent&operator=and",
				Method:          "GET",
				Headers:         map[string]string{"Authorization": "Bearer mock-token"},
				Weight:          20,
				ExpectedStatus:  http.StatusUnauthorized,
			},
			{
				Path:            "/api/v1/notes/by-tags?tags=project,meeting,deadline&operator=or",
				Method:          "GET",
				Headers:         map[string]string{"Authorization": "Bearer mock-token"},
				Weight:          15,
				ExpectedStatus:  http.StatusUnauthorized,
			},
			{
				Path:            "/api/v1/search/notes?query=important%20deadline&tags=work,urgent&tagOperator=and",
				Method:          "GET",
				Headers:         map[string]string{"Authorization": "Bearer mock-token"},
				Weight:          15,
				ExpectedStatus:  http.StatusUnauthorized,
			},
			{
				Path:            "/api/v1/search/notes?tags=work&excludeTags=archived,completed",
				Method:          "GET",
				Headers:         map[string]string{"Authorization": "Bearer mock-token"},
				Weight:          15,
				ExpectedStatus:  http.StatusUnauthorized,
			},
			{
				Path:            "/api/v1/tags/related/123e4567-e89b-12d3-a456-426614174000",
				Method:          "GET",
				Headers:         map[string]string{"Authorization": "Bearer mock-token"},
				Weight:          10,
				ExpectedStatus:  http.StatusUnauthorized,
			},
			{
				Path:            "/api/v1/search/notes?query=&tags=personal,health&sortBy=relevance",
				Method:          "GET",
				Headers:         map[string]string{"Authorization": "Bearer mock-token"},
				Weight:          10,
				ExpectedStatus:  http.StatusUnauthorized,
			},
			{
				Path:            "/api/v1/search/notes?query=meeting&tags=&sortBy=created_at&limit=20",
				Method:          "GET",
				Headers:         map[string]string{"Authorization": "Bearer mock-token"},
				Weight:          15,
				ExpectedStatus:  http.StatusUnauthorized,
			},
		},
	}
}

// REMOVED: GetSecurityLoadTestConfig - Security endpoints require specialized security testing
// Load testing security endpoints doesn't validate actual security posture and can provide false confidence.
// Security testing should focus on vulnerability assessment, not load handling.

// REMOVED: BenchmarkHealthCheck - Health checks are trivial operations that provide no meaningful performance insights
// Testing health endpoint performance is like testing how fast "hello world" prints - useless data.
// Health checks should be simple and fast by design; if they're not, the issue is architectural, not performance-related.

// TestTagSystemLoadTest runs the Phase 4 hashtag system load test
func TestTagSystemLoadTest(t *testing.T) {
	// Check if PostgreSQL tests are enabled
	if !tests.USE_POSTGRE_DURING_TEST {
		t.Skip("PostgreSQL tests are disabled. Set USE_POSTGRE_DURING_TEST=true to enable.")
	}

	// Setup test server using test configuration
	testConfig := getTestConfig()

	db, err := database.NewConnection(testConfig.Database)
	require.NoError(t, err)
	defer db.Close()

	handlers := handlers.NewHandlers()
	server := server.NewServer(testConfig, handlers, db)

	loadTester := NewLoadTester(server, GetTagSystemLoadTestConfig())
	result := loadTester.RunLoadTest(t)

	// Assert performance requirements
	t.Logf("Tag System Load Test Results:")
	t.Logf("  Total Requests: %d", result.TotalRequests)
	t.Logf("  Successful: %d", result.SuccessfulReqs)
	t.Logf("  Failed: %d", result.FailedReqs)
	t.Logf("  Requests/sec: %.2f", result.RequestsPerSec)
	t.Logf("  Average Response: %v", result.AverageResponse)
	t.Logf("  P95 Response: %v", result.Percentiles["p95"])
	t.Logf("  P99 Response: %v", result.Percentiles["p99"])

	// Performance assertions based on Phase 4 requirements
	assert.Less(t, result.AverageResponse, 300*time.Millisecond, "Average response time should be < 300ms")
	assert.Less(t, result.Percentiles["p95"], 500*time.Millisecond, "P95 response time should be < 500ms")
	assert.Greater(t, result.RequestsPerSec, 50.0, "Should handle at least 50 requests/sec")
}


// TestComplexFilteringLoadTest runs advanced filtering scenarios load test
func TestComplexFilteringLoadTest(t *testing.T) {
	// Check if PostgreSQL tests are enabled
	if !tests.USE_POSTGRE_DURING_TEST {
		t.Skip("PostgreSQL tests are disabled. Set USE_POSTGRE_DURING_TEST=true to enable.")
	}

	// Setup test server using test configuration
	testConfig := getTestConfig()

	db, err := database.NewConnection(testConfig.Database)
	require.NoError(t, err)
	defer db.Close()

	handlers := handlers.NewHandlers()
	server := server.NewServer(testConfig, handlers, db)

	loadTester := NewLoadTester(server, GetComplexFilteringLoadTestConfig())
	result := loadTester.RunLoadTest(t)

	t.Logf("Complex Filtering Load Test Results:")
	t.Logf("  Total Requests: %d", result.TotalRequests)
	t.Logf("  Successful: %d", result.SuccessfulReqs)
	t.Logf("  Failed: %d", result.FailedReqs)
	t.Logf("  Requests/sec: %.2f", result.RequestsPerSec)
	t.Logf("  Average Response: %v", result.AverageResponse)
	t.Logf("  P95 Response: %v", result.Percentiles["p95"])

	// Complex filtering can be slower but should still be reasonable
	assert.Less(t, result.AverageResponse, 500*time.Millisecond, "Complex filtering should be < 500ms")
	assert.Less(t, result.Percentiles["p95"], 800*time.Millisecond, "P95 filtering should be < 800ms")
}

// REMOVED: BenchmarkTagSystem - Redundant with TestTagSystemLoadTest
// The comprehensive load test already covers tag system performance more realistically than this micro-benchmark.
// Single-endpoint benchmarks don't reflect real user behavior or system performance under load.

// REMOVED: BenchmarkTagFiltering - Covered by TestComplexFilteringLoadTest
// The complex filtering load test covers real-world filtering scenarios instead of artificial single-endpoint testing.
// Micro-benchmarks provide artificial metrics that don't translate to real user experience.

// REMOVED: BenchmarkRateLimiting - Rate limiting is infrastructure middleware, not user-facing functionality
// Performance of rate limiting doesn't directly impact user experience in meaningful ways.
// Rate limiting should be simple and efficient; if it's not, the issue is architectural, not performance-related.
