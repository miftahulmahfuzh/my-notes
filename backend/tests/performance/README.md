# Load Testing Guide

## Overview

This guide explains how to run the load tests for the Silence Notes backend, focusing on **essential performance testing for user-facing functionality**. The load testing framework is ruthlessly focused on tests that provide meaningful insights into actual user experience.

## Load Test Configuration

The load testing system is located in `backend/tests/performance/load_test.go` and includes only **critical test scenarios** that validate real user workflows:

### Essential Test Scenarios

#### 1. **Tag System Load Test** (`TestTagSystemLoadTest`)
**Why This Exists**: Validates the core Phase 4 hashtag system functionality that users will interact with daily. This test ensures the tag system can handle realistic usage patterns with multiple concurrent users performing various tag-related operations.

**Expectations**:
- **Average Response Time**: < 300ms (users expect fast tag operations)
- **P95 Response Time**: < 500ms (95% of users should get quick responses)
- **Requests per Second**: > 50 req/s (handles moderate user load)
- **Success Rate**: > 95%

**Configuration**: 25 concurrent users, 60 requests each, 60-second duration with 10-second ramp-up

**Endpoints Tested**: Tag listing, suggestions, popular tags, tag-based note filtering, search with tags, trending tags

**Keep Reason**: This is **critical** - tests the actual hashtag functionality that is the centerpiece of Phase 4.

---

#### 2. **Complex Filtering Load Test** (`TestComplexFilteringLoadTest`)
**Why This Exists**: Users will frequently combine multiple tags with search terms and Boolean logic (AND/OR operators). Complex database queries can become performance bottlenecks, especially with large note collections. This test ensures advanced filtering remains responsive under load.

**Expectations**:
- **Average Response Time**: < 500ms (complex queries take longer but must remain usable)
- **P95 Response Time**: < 800ms (even complex queries shouldn't frustrate users)
- **Success Rate**: > 95%

**Configuration**: 15 concurrent users, 50 requests each, 40-second duration with 7-second ramp-up

**Endpoints Tested**: Multi-tag filtering with AND/OR, search with tag combinations, exclude tags functionality, related tags, relevance sorting

**Keep Reason**: **Essential** - Complex filtering is a key differentiator and performance here directly impacts user satisfaction.

---

### Removed Test Scenarios (And Why)

#### ❌ **BenchmarkHealthCheck**
**Removed**: Health checks are trivial operations that provide no meaningful performance insights. Testing this is like testing how fast "hello world" prints - useless data.

#### ❌ **BenchmarkTagSystem**
**Removed**: Redundant with `TestTagSystemLoadTest`. The comprehensive load test already covers tag system performance more realistically than this micro-benchmark.

#### ❌ **BenchmarkTagFiltering**
**Removed**: Covered by `TestComplexFilteringLoadTest` which tests real-world filtering scenarios instead of artificial single-endpoint benchmarks.

#### ❌ **BenchmarkRateLimiting**
**Removed**: Rate limiting is infrastructure middleware, not user-facing functionality. Performance here doesn't impact user experience directly.

#### ❌ **Auth Load Test Config**
**Removed**: Authentication performance should be handled by dedicated security testing, not general load testing. Auth endpoints have different performance characteristics and security requirements.

#### ❌ **Security Load Test Config**
**Removed**: Security endpoints need specialized security testing tools, not load testing. These tests provide false confidence about security posture.

## Running Load Tests

### Prerequisites

1. **Database Setup**: Ensure PostgreSQL test database is running
2. **Dependencies**: Install Go dependencies
3. **Test Environment**: Set environment to "test"

### Commands

#### Run Essential Load Tests
```bash
# Clean test cache and run essential performance tests
go clean -testcache && go -C backend test ./tests/performance/... -v

# Run with specific test timeout
go -C backend test ./tests/performance/... -v -timeout 5m
```

#### Run Specific Test Scenarios
```bash
# Run only Phase 4 hashtag system performance test
go -C backend test ./tests/performance/... -v -run TestTagSystemLoadTest

# Run complex filtering performance test
go -C backend test ./tests/performance/... -v -run TestComplexFilteringLoadTest

# Run both essential tests
go -C backend test ./tests/performance/... -v -run "TestTagSystemLoadTest|TestComplexFilteringLoadTest"
```

**Note**: Benchmark tests have been removed as they provided redundant or meaningless performance data. The remaining load tests provide more realistic and actionable performance insights.

#### Run Load Tests with Coverage
```bash
# Run tests with coverage report
go -C backend test ./tests/performance/... -v -coverprofile=coverage.out
go tool cover -html=coverage.out -o coverage.html
```

### Performance Requirements

**Essential Requirements Only** - Based on real user experience needs:

#### Tag System Performance (`TestTagSystemLoadTest`)
- **Average Response Time**: < 300ms (users expect instant tag operations)
- **P95 Response Time**: < 500ms (95% of users get fast responses)
- **Requests per Second**: > 50 req/s (handles moderate concurrent usage)
- **Success Rate**: > 95%

#### Complex Filtering Performance (`TestComplexFilteringLoadTest`)
- **Average Response Time**: < 500ms (complex queries acceptable but must be responsive)
- **P95 Response Time**: < 800ms (even complex queries shouldn't frustrate users)
- **Success Rate**: > 95%

**Removed Requirements**: Tag Management metrics are covered by the two essential tests above. We don't need separate tracking for basic CRUD operations when they're already tested in realistic scenarios.

### Understanding Test Results

#### Load Test Output
```
=== Tag System Load Test Results ===
Total Requests: 1500
Successful: 1500
Failed: 0
Requests/sec: 75.32
Average Response: 145.2ms
P95 Response: 280.5ms
P99 Response: 420.1ms
```

#### Removed Benchmark Output
Benchmark tests have been removed because they provided:
- **Artificial metrics** from unrealistic single-endpoint testing
- **Micro-optimizations** that don't translate to real user experience
- **False confidence** about system performance under realistic load

The remaining load tests provide **actionable performance insights** that reflect actual user behavior.

### Essential Load Test Configurations

#### Tag System Configuration (`GetTagSystemLoadTestConfig`)
**Purpose**: Validates Phase 4 hashtag system under realistic user load

- **Concurrent Users**: 25 (moderate user base)
- **Requests per User**: 60 (typical user session)
- **Duration**: 60 seconds (sustained usage test)
- **Ramp-up Time**: 10 seconds (gradual load increase)
- **Focus**: Tag listing, suggestions, popular tags, tag-based note filtering, search with tags, trending tags

#### Complex Filtering Configuration (`GetComplexFilteringLoadTestConfig`)
**Purpose**: Tests advanced filtering scenarios that could become database bottlenecks

- **Concurrent Users**: 15 (complex queries are resource-intensive)
- **Requests per User**: 50 (fewer requests due to query complexity)
- **Duration**: 40 seconds (focused testing)
- **Ramp-up Time**: 7 seconds (quicker ramp for shorter test)
- **Focus**: Multi-tag filtering with AND/OR, search with tag combinations, exclude tags, related tags, relevance sorting

#### Removed Configurations
- **Default Config**: Replaced by focused tag system config
- **Auth Config**: Auth testing belongs in security tests, not load tests
- **Security Config**: Security endpoints need specialized testing tools
- **Tag Management Config**: Covered by the two essential configs above

### Custom Load Testing

#### Creating Custom Test Scenarios
```go
// Create custom configuration
customConfig := &LoadTestConfig{
    ConcurrentUsers: 20,
    RequestsPerUser: 100,
    Duration:        30 * time.Second,
    RampUpTime:      5 * time.Second,
    Endpoints: []Endpoint{
        {
            Path:           "/api/v1/custom/endpoint",
            Method:         "GET",
            Weight:         100,
            ExpectedStatus: http.StatusOK,
        },
    },
}

// Run custom test
loadTester := NewLoadTester(server, customConfig)
result := loadTester.RunLoadTest(t)
```

#### Adding New Endpoints
```go
// Add new endpoint to existing configuration
newEndpoint := Endpoint{
    Path:           "/api/v1/new/feature",
    Method:         "POST",
    Headers:        map[string]string{"Authorization": "Bearer token"},
    Body:           map[string]interface{}{"data": "test"},
    Weight:         25,
    ExpectedStatus: http.StatusCreated,
}
```

### Troubleshooting

#### Common Issues

1. **Database Connection Errors**
   ```bash
   # Check PostgreSQL status
   docker-compose ps

   # Restart database
   docker-compose restart postgres
   ```

2. **Test Timeout Issues**
   ```bash
   # Increase timeout
   go -C backend test ./tests/performance/... -v -timeout 10m
   ```

3. **Port Conflicts**
   ```bash
   # Check port usage
   netstat -tulpn | grep :5432

   # Kill conflicting processes
   sudo kill -9 <PID>
   ```

4. **Memory Issues**
   ```bash
   # Reduce concurrent users
   # Modify LoadTestConfig ConcurrentUsers field

   # Increase Go memory limit
   GOMEMLIMIT=1GiB go -C backend test ./tests/performance/... -v
   ```

#### Performance Debugging

1. **EnableVerbose Logging**
   ```bash
   go -C backend test ./tests/performance/... -v -run TestTagSystemLoadTest -test.v
   ```

2. **CPU Profiling**
   ```bash
   go -C backend test ./tests/performance/... -cpuprofile=cpu.prof -run TestTagSystemLoadTest
   go tool pprof cpu.prof
   ```

3. **Memory Profiling**
   ```bash
   go -C backend test ./tests/performance/... -memprofile=mem.prof -run TestTagSystemLoadTest
   go tool pprof mem.prof
   ```

### Continuous Integration

#### GitHub Actions Example (Essential Tests Only)
```yaml
name: Performance Tests
on: [push, pull_request]

jobs:
  load-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: password
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
    - uses: actions/checkout@v3
    - uses: actions/setup-go@v3
      with:
        go-version: '1.21'

    - name: Run essential load tests
      run: |
        go clean -testcache
        go -C backend test ./tests/performance/... -v -timeout 10m -run "TestTagSystemLoadTest|TestComplexFilteringLoadTest"

    - name: Validate performance requirements
      run: |
        # Add custom validation scripts if needed
        echo "Load tests completed - validate results meet performance requirements"
```

**Note**: Benchmark steps removed as they provided no meaningful CI value. The essential load tests provide actionable performance validation.

### Performance Monitoring

#### Key Metrics to Track
- **Response Time Trends**: Monitor average and percentile response times
- **Throughput**: Track requests per second over time
- **Error Rates**: Monitor failed requests and error types
- **Resource Usage**: CPU, memory, and database connection usage

#### Alerting Thresholds
- **Average Response Time**: > 500ms
- **P95 Response Time**: > 1s
- **Error Rate**: > 5%
- **Throughput**: < 30 req/s

This ruthlessly focused load testing framework ensures that the Phase 4 hashtag system meets essential performance requirements while eliminating unnecessary tests that provide no meaningful insights. The remaining tests validate real user workflows and provide actionable performance data.

**Total Test Count**: Reduced from 6+ test scenarios to **2 essential tests** that provide 100% of the meaningful performance insights.