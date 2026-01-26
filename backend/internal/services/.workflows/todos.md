# Todos: Backend Services

**Package Path**: `internal/services/`

**Package Code**: SV

**Last Updated**: 2025-11-02T20:30:00Z

**Total Active Tasks**: 0

## Quick Stats
- P0 Critical: 0
- P1 High: 0
- P2 Medium: 0
- P3 Low: 0
- P4 Backlog: 0
- Blocked: 0
- Completed Today: 1
- Completed This Week: 1
- Completed This Month: 1

---

## Active Tasks

### [P0] Critical
- *No critical tasks identified*

### [P1] High
- *No high tasks identified*

### [P2] Medium
- *No medium tasks identified*

### [P3] Low
- *No low tasks identified*

### [P4] Backlog
- *No backlog tasks identified*

### 🚫 Blocked
- *No blocked tasks identified*

---

## Completed Tasks

### Recently Completed
- *No recently completed tasks*

### This Week
- *No additional completed tasks this week*

### This Month
- *No additional completed tasks this month*

---

## Notes

### Current System Status
*No system status updates*

---

## Task Lifecycle Guidelines

### Completion Criteria
- **Database Operation Tasks**: Must include integration tests with real database connections
- **Service Layer Tasks**: Must test both success and error scenarios
- **API Changes**: Must maintain backward compatibility with existing clients
- **Data Model Changes**: Must include proper migration handling and data validation

### Testing Standards
- **Integration Tests**: Must test with real PostgreSQL database connections
- **Service Tests**: Must bypass HTTP layers to test business logic directly
- **Database Tests**: Must cover array handling, JSON operations, and constraint violations
- **Error Scenarios**: Must test database failures, invalid data, and edge cases

### Code Quality Standards
- **Database Operations**: Must use proper parameter binding and type conversion
- **Array Handling**: Must use pq.Array() for PostgreSQL array operations
- **Error Handling**: Must provide clear error messages with context for debugging
- **Service Methods**: Must be testable independently without HTTP dependencies