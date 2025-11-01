# Silence Notes API Documentation

## Overview

The Silence Notes API provides RESTful endpoints for managing notes, tags, and user authentication. This document describes the available endpoints, request/response formats, and usage examples.

## Base URL

```
Development: http://localhost:8080/api/v1
Production: https://api.silence-notes.com/v1
```

## Authentication

The API uses JWT (JSON Web Tokens) for authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## Response Format

All API responses follow a consistent format:

### Success Response
```json
{
  "success": true,
  "data": {
    // Response data specific to the endpoint
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message describing what went wrong"
}
```

## HTTP Status Codes

- `200 OK` - Request successful
- `201 Created` - Resource created successfully
- `400 Bad Request` - Invalid request data
- `401 Unauthorized` - Authentication required
- `403 Forbidden` - Access denied
- `404 Not Found` - Resource not found
- `409 Conflict` - Resource conflict (e.g., duplicate)
- `422 Unprocessable Entity` - Validation errors
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error

## Endpoints

### Health Check

#### GET /health

Check the health status of the API.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T12:00:00Z",
  "version": "1.0.0",
  "uptime": "2h30m45s",
  "checks": {
    "server": {
      "status": "ok",
      "message": "Server is running"
    },
    "database": {
      "status": "ok",
      "message": "Database connection healthy"
    }
  }
}
```

### Authentication

#### POST /auth/google

Authenticate with Google OAuth.

**Request Body:**
```json
{
  "code": "google-auth-code",
  "redirect_uri": "http://localhost:8080/api/v1/auth/google/callback"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "User Name",
      "avatar_url": "https://lh3.googleusercontent.com/...",
      "created_at": "2024-01-01T12:00:00Z"
    },
    "tokens": {
      "access_token": "jwt-access-token",
      "refresh_token": "jwt-refresh-token",
      "expires_in": 3600
    }
  }
}
```

#### POST /auth/refresh

Refresh an expired access token.

**Request Body:**
```json
{
  "refresh_token": "jwt-refresh-token"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "access_token": "new-jwt-access-token",
    "expires_in": 3600
  }
}
```

#### DELETE /auth/logout

Logout user and invalidate tokens.

**Headers:**
```
Authorization: Bearer <access-token>
```

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

### Notes

#### GET /notes

Get all notes for the authenticated user.

**Headers:**
```
Authorization: Bearer <access-token>
```

**Query Parameters:**
- `limit` (int, optional): Maximum number of notes to return (default: 20, max: 100)
- `offset` (int, optional): Number of notes to skip (default: 0)
- `order_by` (string, optional): Field to sort by (created_at, updated_at, title)
- `order_dir` (string, optional): Sort direction (asc, desc)
- `tags` (string, optional): Filter by tags (comma-separated)

**Response:**
```json
{
  "success": true,
  "data": {
    "notes": [
      {
        "id": "uuid",
        "user_id": "uuid",
        "title": "Note Title",
        "content": "Note content with #hashtag",
        "created_at": "2024-01-01T12:00:00Z",
        "updated_at": "2024-01-01T12:30:00Z",
        "version": 2,
        "tags": ["#hashtag"]
      }
    ],
    "total": 1,
    "page": 1,
    "limit": 20,
    "has_more": false
  }
}
```

#### POST /notes

Create a new note.

**Headers:**
```
Authorization: Bearer <access-token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "title": "Note Title (optional)",
  "content": "Note content with #hashtag"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "user_id": "uuid",
    "title": "Note Title",
    "content": "Note content with #hashtag",
    "created_at": "2024-01-01T12:00:00Z",
    "updated_at": "2024-01-01T12:00:00Z",
    "version": 1,
    "tags": ["#hashtag"]
  }
}
```

#### GET /notes/{id}

Get a specific note.

**Headers:**
```
Authorization: Bearer <access-token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "user_id": "uuid",
    "title": "Note Title",
    "content": "Note content with #hashtag",
    "created_at": "2024-01-01T12:00:00Z",
    "updated_at": "2024-01-01T12:30:00Z",
    "version": 2,
    "tags": ["#hashtag"]
  }
}
```

#### PUT /notes/{id}

Update a note.

**Headers:**
```
Authorization: Bearer <access-token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "title": "Updated Note Title",
  "content": "Updated content with #new-hashtag",
  "version": 2
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "user_id": "uuid",
    "title": "Updated Note Title",
    "content": "Updated content with #new-hashtag",
    "created_at": "2024-01-01T12:00:00Z",
    "updated_at": "2024-01-01T13:00:00Z",
    "version": 3,
    "tags": ["#new-hashtag"]
  }
}
```

#### DELETE /notes/{id}

Delete a note.

**Headers:**
```
Authorization: Bearer <access-token>
```

**Response:**
```json
{
  "success": true,
  "message": "Note deleted successfully"
}
```

### Tags

#### GET /tags

Get all tags for the authenticated user.

**Headers:**
```
Authorization: Bearer <access-token>
```

**Query Parameters:**
- `limit` (int, optional): Maximum number of tags to return (default: 50)
- `offset` (int, optional): Number of tags to skip (default: 0)

**Response:**
```json
{
  "success": true,
  "data": {
    "tags": [
      {
        "id": "uuid",
        "name": "#hashtag",
        "created_at": "2024-01-01T12:00:00Z",
        "note_count": 5
      }
    ],
    "total": 1,
    "page": 1,
    "limit": 50,
    "has_more": false
  }
}
```

#### POST /tags

Create a new tag.

**Headers:**
```
Authorization: Bearer <access-token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "#new-tag"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "#new-tag",
    "created_at": "2024-01-01T12:00:00Z"
  }
}
```

#### GET /tags/suggestions

Get tag suggestions based on partial input.

**Headers:**
```
Authorization: Bearer <access-token>
```

**Query Parameters:**
- `q` (string, required): Partial tag name for suggestions
- `limit` (int, optional): Maximum suggestions to return (default: 10)

**Response:**
```json
{
  "success": true,
  "data": {
    "suggestions": ["#work", "#personal", "#projects"]
  }
}
```

### Search

#### GET /search/notes

Search notes by content and tags.

**Headers:**
```
Authorization: Bearer <access-token>
```

**Query Parameters:**
- `q` (string, optional): Search query for content
- `tags` (string, optional): Filter by tags (comma-separated)
- `limit` (int, optional): Maximum results to return (default: 20)
- `offset` (int, optional): Number of results to skip (default: 0)

**Response:**
```json
{
  "success": true,
  "data": {
    "notes": [
      {
        "id": "uuid",
        "title": "Matching Note",
        "content": "Content matching #search-term",
        "created_at": "2024-01-01T12:00:00Z",
        "updated_at": "2024-01-01T12:30:00Z",
        "version": 1,
        "tags": ["#search-term"]
      }
    ],
    "total": 1,
    "page": 1,
    "limit": 20,
    "has_more": false
  }
}
```

#### GET /search/tags

Search tags by name.

**Headers:**
```
Authorization: Bearer <access-token>
```

**Query Parameters:**
- `q` (string, required): Search query for tag names
- `limit` (int, optional): Maximum results to return (default: 20)

**Response:**
```json
{
  "success": true,
  "data": {
    "tags": [
      {
        "id": "uuid",
        "name": "#search-term",
        "created_at": "2024-01-01T12:00:00Z",
        "note_count": 3
      }
    ],
    "total": 1
  }
}
```

### User Profile

#### GET /user/profile

Get user profile information.

**Headers:**
```
Authorization: Bearer <access-token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "User Name",
    "avatar_url": "https://lh3.googleusercontent.com/...",
    "created_at": "2024-01-01T12:00:00Z",
    "preferences": {
      "theme": "light",
      "auto_sync": true,
      "sync_interval": 30
    }
  }
}
```

#### PUT /user/profile

Update user profile.

**Headers:**
```
Authorization: Bearer <access-token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "Updated Name",
  "preferences": {
    "theme": "dark",
    "auto_sync": false,
    "sync_interval": 60
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "Updated Name",
    "avatar_url": "https://lh3.googleusercontent.com/...",
    "created_at": "2024-01-01T12:00:00Z",
    "preferences": {
      "theme": "dark",
      "auto_sync": false,
      "sync_interval": 60
    }
  }
}
```

## Error Handling

### Validation Errors (422)
```json
{
  "success": false,
  "error": "Validation failed",
  "details": {
    "content": ["Content is required"],
    "title": ["Title too long (max 500 characters)"]
  }
}
```

### Authentication Errors (401)
```json
{
  "success": false,
  "error": "Invalid or expired token"
}
```

### Authorization Errors (403)
```json
{
  "success": false,
  "error": "Access denied: You don't have permission to access this resource"
}
```

### Not Found Errors (404)
```json
{
  "success": false,
  "error": "Note not found"
}
```

### Rate Limiting (429)
```json
{
  "success": false,
  "error": "Rate limit exceeded. Please try again later.",
  "retry_after": 60
}
```

## Rate Limiting

API requests are rate-limited to prevent abuse:

- **Authenticated users**: 1000 requests per hour
- **Unauthenticated requests**: 100 requests per hour

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1640995200
```

## Pagination

List endpoints support pagination using `limit` and `offset` parameters:

- `limit`: Maximum items per page (default varies by endpoint)
- `offset`: Number of items to skip

Pagination response includes:
- `total`: Total number of items
- `page`: Current page number
- `limit`: Items per page
- `has_more`: Whether more items are available

## Optimistic Locking

Notes use optimistic locking to prevent concurrent updates. Include the current `version` when updating a note:

```json
{
  "content": "Updated content",
  "version": 2
}
```

If the version doesn't match, you'll receive a 409 Conflict error.

## Hashtag Processing

- Hashtags are automatically extracted from note content
- Tags must start with `#` and contain only alphanumeric characters, underscores, and hyphens
- Tags are converted to lowercase and stored uniquely
- Duplicate hashtags in a note are automatically deduplicated

## CORS

The API supports Cross-Origin Resource Sharing (CORS) for Chrome extension access:

**Allowed Origins:**
- `chrome-extension://*`
- `http://localhost:*` (development)

**Allowed Methods:**
- GET, POST, PUT, DELETE, OPTIONS

**Allowed Headers:**
- Content-Type, Authorization, X-Request-ID

## WebSocket Events (Future)

Real-time updates will be supported via WebSocket in future versions:

- `note.created` - New note created
- `note.updated` - Note updated
- `note.deleted` - Note deleted
- `tag.created` - New tag created
- `sync.started` - Sync process started
- `sync.completed` - Sync process completed

## SDK Examples

### JavaScript/TypeScript
```typescript
// Initialize API client
const api = new SilenceNotesAPI('http://localhost:8080/api/v1');

// Set authentication token
api.setToken('your-jwt-token');

// Get notes
const notes = await api.notes.list({ limit: 10 });

// Create note
const note = await api.notes.create({
  title: 'My Note',
  content: 'Note content with #hashtag'
});

// Update note
const updated = await api.notes.update(note.id, {
  content: 'Updated content',
  version: note.version
});
```

### Go
```go
// Initialize client
client := silencenotes.NewClient("http://localhost:8080/api/v1")

// Set authentication token
client.SetToken("your-jwt-token")

// Get notes
notes, err := client.Notes.List(&silencenotes.ListNotesOptions{
    Limit: 10,
})

// Create note
note, err := client.Notes.Create(&silencenotes.CreateNoteRequest{
    Title:   "My Note",
    Content: "Note content with #hashtag",
})
```

## Testing

Use the provided test endpoints for development:

```bash
# Health check
curl http://localhost:8080/api/v1/health

# Create test note (with valid token)
curl -X POST http://localhost:8080/api/v1/notes \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"content": "Test note with #hashtag"}'
```

## Support

For API support:
- **Documentation**: [API Documentation](https://docs.silence-notes.com/api)
- **Issues**: [GitHub Issues](https://github.com/your-username/my-notes/issues)
- **Email**: api-support@silence-notes.com