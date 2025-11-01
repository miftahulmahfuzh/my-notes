package performance

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/gpd/my-notes/internal/config"
	"github.com/gpd/my-notes/internal/database"
	"github.com/gpd/my-notes/internal/handlers"
	"github.com/gpd/my-notes/internal/server"
	"github.com/stretchr/testify/require"
)

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

// GetDefaultLoadTestConfig returns a default load test configuration
func GetDefaultLoadTestConfig() *LoadTestConfig {
	return &LoadTestConfig{
		ConcurrentUsers: 10,
		RequestsPerUser: 100,
		Duration:        30 * time.Second,
		RampUpTime:      5 * time.Second,
		Endpoints: []Endpoint{
			{
				Path:            "/api/v1/health",
				Method:          "GET",
				Weight:          70, // 70% of requests
				ExpectedStatus:  http.StatusOK,
			},
			{
				Path:            "/api/v1/auth/validate",
				Method:          "GET",
				Headers:         map[string]string{"Authorization": "Bearer mock-token"},
				Weight:          20, // 20% of requests
				ExpectedStatus:  http.StatusUnauthorized, // Expected to fail
			},
			{
				Path:            "/api/v1/user/profile",
				Method:          "GET",
				Headers:         map[string]string{"Authorization": "Bearer mock-token"},
				Weight:          10, // 10% of requests
				ExpectedStatus:  http.StatusUnauthorized, // Expected to fail
			},
		},
	}
}

// GetAuthLoadTestConfig returns a load test config focused on authentication
func GetAuthLoadTestConfig() *LoadTestConfig {
	return &LoadTestConfig{
		ConcurrentUsers: 50,
		RequestsPerUser: 20,
		Duration:        60 * time.Second,
		RampUpTime:      10 * time.Second,
		Endpoints: []Endpoint{
			{
				Path:            "/api/v1/auth/google",
				Method:          "POST",
				Weight:          40,
				ExpectedStatus:  http.StatusBadRequest, // No valid auth data
			},
			{
				Path:            "/api/v1/auth/refresh",
				Method:          "POST",
				Weight:          30,
				ExpectedStatus:  http.StatusUnauthorized,
			},
			{
				Path:            "/api/v1/user/profile",
				Method:          "GET",
				Weight:          30,
				ExpectedStatus:  http.StatusUnauthorized,
			},
		},
	}
}

// GetSecurityLoadTestConfig returns a load test config focused on security endpoints
func GetSecurityLoadTestConfig() *LoadTestConfig {
	return &LoadTestConfig{
		ConcurrentUsers: 20,
		RequestsPerUser: 50,
		Duration:        45 * time.Second,
		RampUpTime:      5 * time.Second,
		Endpoints: []Endpoint{
			{
				Path:            "/api/v1/security/rate-limit",
				Method:          "GET",
				Weight:          33,
				ExpectedStatus:  http.StatusUnauthorized,
			},
			{
				Path:            "/api/v1/security/session-info",
				Method:          "GET",
				Weight:          33,
				ExpectedStatus:  http.StatusUnauthorized,
			},
			{
				Path:            "/api/v1/security/metrics",
				Method:          "GET",
				Weight:          34,
				ExpectedStatus:  http.StatusUnauthorized,
			},
		},
	}
}

// BenchmarkHealthCheck benchmarks the health check endpoint
func BenchmarkHealthCheck(b *testing.B) {
	// Setup test server
	testConfig := &config.Config{
		App: config.AppConfig{Environment: "test"},
		Server: config.ServerConfig{Port: "0"},
		Database: config.DatabaseConfig{
			Host: "localhost", Port: 5432, Name: "notes_test",
			User: "postgres", Password: "password", SSLMode: "disable",
		},
		Auth: config.AuthConfig{JWTSecret: "test-secret"},
	}

	db, err := database.NewConnection(testConfig.Database)
	require.NoError(b, err)
	defer db.Close()

	handlers := handlers.NewHandlers()
	server := server.NewServer(testConfig, handlers, db)

	loadTester := NewLoadTester(server, &LoadTestConfig{
		ConcurrentUsers: 1,
		RequestsPerUser: b.N,
		Duration:        0, // Run until benchmark completes
		RampUpTime:      0,
		Endpoints: []Endpoint{{
			Path:           "/api/v1/health",
			Method:         "GET",
			Weight:         1,
			ExpectedStatus: http.StatusOK,
		}},
	})

	b.ResetTimer()
	result := loadTester.RunLoadTest(&testing.T{})
	b.StopTimer()

	b.ReportMetric(float64(result.AverageResponse.Nanoseconds())/1000, "ns/op")
	b.ReportMetric(result.RequestsPerSec, "req/s")
}

// BenchmarkRateLimiting benchmarks rate limiting performance
func BenchmarkRateLimiting(b *testing.B) {
	// Similar setup to BenchmarkHealthCheck but focusing on rate limiting
	testConfig := &config.Config{
		App: config.AppConfig{Environment: "test"},
		Server: config.ServerConfig{Port: "0"},
		Database: config.DatabaseConfig{
			Host: "localhost", Port: 5432, Name: "notes_test",
			User: "postgres", Password: "password", SSLMode: "disable",
		},
		Auth: config.AuthConfig{JWTSecret: "test-secret"},
	}

	db, err := database.NewConnection(testConfig.Database)
	require.NoError(b, err)
	defer db.Close()

	handlers := handlers.NewHandlers()
	server := server.NewServer(testConfig, handlers, db)

	loadTester := NewLoadTester(server, &LoadTestConfig{
		ConcurrentUsers: 10,
		RequestsPerUser: b.N / 10,
		Duration:        0,
		RampUpTime:      0,
		Endpoints: []Endpoint{{
			Path:           "/api/v1/health",
			Method:         "GET",
			Weight:         1,
			ExpectedStatus: http.StatusOK,
		}},
	})

	b.ResetTimer()
	result := loadTester.RunLoadTest(&testing.T{})
	b.StopTimer()

	b.ReportMetric(float64(result.AverageResponse.Nanoseconds())/1000, "ns/op")
	b.ReportMetric(result.RequestsPerSec, "req/s")
}