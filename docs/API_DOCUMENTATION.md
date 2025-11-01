# Silence Notes API Documentation

## Overview

The Silence Notes API provides RESTful endpoints for managing notes, users, tags, and synchronization with comprehensive security features, batch operations, and real-time sync capabilities.

**Base URL**:
- Development: `http://localhost:8080/api/v1`
- Production: `https://api.silence-notes.com/api/v1`

**Authentication**: Bearer Token (JWT) with Google OAuth 2.0 + PKCE
**Content-Type**: `application/json`
**API Version**: v1

## Health Check

### GET /health

Check the health status of the API.

**Response**:
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

## Authentication

### Google OAuth 2.0 + PKCE Flow

1. **Initiate OAuth Flow**
   ```
   POST /api/v1/auth/google
   ```

   **Request Body**:
   ```json
   {
     "redirect_uri": "http://localhost:8080/api/v1/auth/exchange"
   }
   ```

   **Response**:
   ```json
   {
     "success": true,
     "data": {
       "authorization_url": "https://accounts.google.com/oauth/authorize?...",
       "state": "cryptographically_secure_state",
       "code_verifier": "random_string_for_pkce"
     }
   }
   ```

2. **Exchange Code for Tokens**
   ```
   POST /api/v1/auth/exchange
   ```

   **Request Body**:
   ```json
   {
     "code": "authorization_code_from_google",
     "state": "state_from_step_1",
     "code_verifier": "code_verifier_from_step_1"
   }
   ```

   **Response**:
   ```json
   {
     "success": true,
     "data": {
       "access_token": "jwt_access_token",
       "refresh_token": "jwt_refresh_token",
       "expires_in": 86400,
       "user": {
         "id": "user_uuid",
         "google_id": "google_user_id",
         "email": "user@example.com",
         "name": "User Name",
         "avatar_url": "https://...",
         "created_at": "2023-01-01T00:00:00Z",
         "updated_at": "2023-01-01T00:00:00Z"
       }
     }
   }
   ```

3. **Refresh Access Token**
   ```
   POST /api/v1/auth/refresh
   ```

   **Request Body**:
   ```json
   {
     "refresh_token": "jwt_refresh_token"
   }
   ```

   **Response**:
   ```json
   {
     "success": true,
     "data": {
       "access_token": "new_jwt_access_token",
       "expires_in": 86400
     }
   }
   ```

4. **Validate Token**
   ```
   GET /api/v1/auth/validate
   ```

   **Request Headers**:
   ```
   Authorization: Bearer <access_token>
   ```

   **Response**:
   ```json
   {
     "success": true,
     "data": {
       "valid": true,
       "user_id": "user_uuid",
       "session_id": "session_uuid",
       "expires_at": "2023-01-02T00:00:00Z"
     }
   }
   ```

5. **Logout**
   ```
   DELETE /api/v1/auth/logout
   ```

   **Request Headers**:
   ```
   Authorization: Bearer <access_token>
   ```

   **Response**:
   ```json
   {
     "success": true,
     "message": "Logged out successfully"
   }
   ```

## Notes API

### Get All Notes

```
GET /api/v1/notes
```

**Query Parameters**:
- `limit` (integer, default: 20, max: 100) - Number of notes per page
- `offset` (integer, default: 0) - Number of notes to skip
- `order_by` (string, default: "updated_at") - Sort field (created_at, updated_at, title)
- `order_dir` (string, default: "desc") - Sort direction ("asc" or "desc")
- `tags` (string, comma-separated) - Filter by hashtags

**Request Headers**:
```
Authorization: Bearer <access_token>
```

**Response**:
```json
{
  "success": true,
  "data": {
    "notes": [
      {
        "id": "note_uuid",
        "user_id": "user_uuid",
        "title": "Note Title",
        "content": "Note content with #hashtags",
        "created_at": "2023-01-01T10:00:00Z",
        "updated_at": "2023-01-01T10:00:00Z",
        "version": 1,
        "tags": ["#work", "#personal"]
      }
    ],
    "total": 1,
    "page": 1,
    "limit": 20,
    "has_more": false
  }
}
```

### Create Note

```
POST /api/v1/notes
```

**Request Headers**:
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body**:
```json
{
  "title": "New Note Title",
  "content": "Note content with #work and #personal tags"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "new_note_uuid",
    "user_id": "user_uuid",
    "title": "New Note Title",
    "content": "Note content with #work and #personal tags",
    "created_at": "2023-01-01T10:00:00Z",
    "updated_at": "2023-01-01T10:00:00Z",
    "version": 1,
    "tags": ["#work", "#personal"]
  }
}
```

### Get Note

```
GET /api/v1/notes/{id}
```

**Request Headers**:
```
Authorization: Bearer <access_token>
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "note_uuid",
    "user_id": "user_uuid",
    "title": "Note Title",
    "content": "Note content with #hashtags",
    "created_at": "2023-01-01T10:00:00Z",
    "updated_at": "2023-01-01T10:00:00Z",
    "version": 1,
    "tags": ["#work", "#personal"]
  }
}
```

### Update Note

```
PUT /api/v1/notes/{id}
```

**Request Headers**:
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body**:
```json
{
  "title": "Updated Note Title",
  "content": "Updated note content with #urgent tag",
  "version": 1
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "note_uuid",
    "user_id": "user_uuid",
    "title": "Updated Note Title",
    "content": "Updated note content with #urgent tag",
    "created_at": "2023-01-01T10:00:00Z",
    "updated_at": "2023-01-01T10:05:00Z",
    "version": 2,
    "tags": ["#urgent"]
  }
}
```

### Delete Note

```
DELETE /api/v1/notes/{id}
```

**Request Headers**:
```
Authorization: Bearer <access_token>
```

**Response**:
```json
{
  "success": true,
  "message": "Note deleted successfully"
}
```

### Sync Notes

```
GET /api/v1/notes/sync
```

**Query Parameters**:
- `since` (string, ISO 8601) - Get notes updated since timestamp
- `limit` (integer, default: 100, max: 500) - Maximum notes to sync
- `include_deleted` (boolean, default: false) - Include deleted notes

**Request Headers**:
```
Authorization: Bearer <access_token>
```

**Response**:
```json
{
  "success": true,
  "data": {
    "sync_token": "unique_sync_session_token",
    "notes": [
      {
        "id": "note_uuid",
        "user_id": "user_uuid",
        "title": "Note Title",
        "content": "Note content with #hashtags",
        "created_at": "2023-01-01T10:00:00Z",
        "updated_at": "2023-01-01T10:00:00Z",
        "version": 1,
        "tags": ["#work", "#personal"],
        "deleted": false
      }
    ],
    "conflicts": [],
    "last_sync_at": "2023-01-01T10:00:00Z"
  }
}
```

### Get Notes by Tag

```
GET /api/v1/notes/tags/{tag}
```

**Path Parameters**:
- `tag` (string) - Hashtag name (without #)

**Query Parameters**:
- `limit` (integer, default: 20) - Maximum notes to return
- `offset` (integer, default: 0) - Number of notes to skip

**Request Headers**:
```
Authorization: Bearer <access_token>
```

**Response**:
```json
{
  "success": true,
  "data": {
    "tag": "#work",
    "notes": [
      {
        "id": "note_uuid",
        "user_id": "user_uuid",
        "title": "Work Note",
        "content": "Work content #work",
        "created_at": "2023-01-01T10:00:00Z",
        "updated_at": "2023-01-01T10:00:00Z",
        "version": 1,
        "tags": ["#work"]
      }
    ],
    "total": 1,
    "limit": 20,
    "offset": 0
  }
}
```

### Get Note Statistics

```
GET /api/v1/notes/stats
```

**Request Headers**:
```
Authorization: Bearer <access_token>
```

**Response**:
```json
{
  "success": true,
  "data": {
    "total_notes": 150,
    "total_tags": 25,
    "last_created": "2023-01-01T10:00:00Z",
    "last_updated": "2023-01-01T09:30:00Z",
    "notes_this_week": 12,
    "notes_this_month": 45,
    "most_used_tags": [
      {"name": "#work", "count": 35},
      {"name": "#personal", "count": 28}
    ]
  }
}
```

## Batch Operations

### Batch Create Notes

```
POST /api/v1/notes/batch
```

**Request Headers**:
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body**:
```json
{
  "notes": [
    {
      "title": "Note 1",
      "content": "Content 1 #work"
    },
    {
      "title": "Note 2",
      "content": "Content 2 #personal"
    }
  ]
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "created": 2,
    "failed": 0,
    "notes": [
      {
        "id": "note_1_uuid",
        "title": "Note 1",
        "content": "Content 1 #work",
        "version": 1,
        "created_at": "2023-01-01T10:00:00Z",
        "tags": ["#work"]
      },
      {
        "id": "note_2_uuid",
        "title": "Note 2",
        "content": "Content 2 #personal",
        "version": 1,
        "created_at": "2023-01-01T10:01:00Z",
        "tags": ["#personal"]
      }
    ],
    "errors": []
  }
}
```

### Batch Update Notes

```
PUT /api/v1/notes/batch
```

**Request Body**:
```json
{
  "updates": [
    {
      "id": "note_1_uuid",
      "version": 1,
      "title": "Updated Note 1"
    },
    {
      "id": "note_2_uuid",
      "version": 1,
      "content": "Updated content 2"
    }
  ]
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "updated": 2,
    "failed": 0,
    "conflicts": 0,
    "notes": [
      {
        "id": "note_1_uuid",
        "title": "Updated Note 1",
        "version": 2,
        "updated_at": "2023-01-01T10:05:00Z"
      },
      {
        "id": "note_2_uuid",
        "content": "Updated content 2",
        "version": 2,
        "updated_at": "2023-01-01T10:05:00Z"
      }
    ],
    "errors": []
  }
}
```

## User Management API

### Get User Profile

```
GET /api/v1/user/profile
```

**Request Headers**:
```
Authorization: Bearer <access_token>
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "user_uuid",
    "google_id": "google_user_id",
    "email": "user@example.com",
    "name": "User Name",
    "avatar_url": "https://...",
    "created_at": "2023-01-01T00:00:00Z",
    "updated_at": "2023-01-01T00:00:00Z"
  }
}
```

### Update User Profile

```
PUT /api/v1/user/profile
```

**Request Headers**:
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body**:
```json
{
  "name": "Updated Name"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "user_uuid",
    "google_id": "google_user_id",
    "email": "user@example.com",
    "name": "Updated Name",
    "avatar_url": "https://...",
    "created_at": "2023-01-01T00:00:00Z",
    "updated_at": "2023-01-01T01:00:00Z"
  }
}
```

### Get User Preferences

```
GET /api/v1/user/preferences
```

**Request Headers**:
```
Authorization: Bearer <access_token>
```

**Response**:
```json
{
  "success": true,
  "data": {
    "theme": "light",
    "language": "en",
    "timezone": "UTC",
    "email_notifications": true,
    "auto_save": true,
    "default_note_view": "list"
  }
}
```

### Update User Preferences

```
PUT /api/v1/user/preferences
```

**Request Body**:
```json
{
  "theme": "dark",
  "auto_save": false,
  "default_note_view": "grid"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "theme": "dark",
    "language": "en",
    "timezone": "UTC",
    "email_notifications": true,
    "auto_save": false,
    "default_note_view": "grid"
  }
}
```

### Get User Sessions

```
GET /api/v1/user/sessions
```

**Request Headers**:
```
Authorization: Bearer <access_token>
```

**Response**:
```json
{
  "success": true,
  "data": {
    "sessions": [
      {
        "id": "session_uuid",
        "ip_address": "192.168.1.100",
        "user_agent": "Mozilla/5.0...",
        "created_at": "2023-01-01T10:00:00Z",
        "last_seen": "2023-01-01T10:30:00Z",
        "is_current": true
      }
    ],
    "total": 1,
    "active_sessions": 1
  }
}
```

### Delete User Session

```
DELETE /api/v1/user/sessions/{sessionId}
```

**Request Headers**:
```
Authorization: Bearer <access_token>
```

**Response**:
```json
{
  "success": true,
  "message": "Session deleted successfully"
}
```

### Get User Statistics

```
GET /api/v1/user/stats
```

**Request Headers**:
```
Authorization: Bearer <access_token>
```

**Response**:
```json
{
  "success": true,
  "data": {
    "total_notes": 150,
    "total_tags": 25,
    "active_sessions": 2,
    "account_age_days": 365,
    "notes_this_week": 12,
    "notes_this_month": 45,
    "last_login": "2023-01-01T09:00:00Z"
  }
}
```

## Tags API

### Get All Tags

```
GET /api/v1/tags
```

**Query Parameters**:
- `limit` (integer, default: 50) - Maximum number of tags
- `offset` (integer, default: 0) - Number of tags to skip

**Request Headers**:
```
Authorization: Bearer <access_token>
```

**Response**:
```json
{
  "success": true,
  "data": {
    "tags": [
      {
        "id": "tag_uuid",
        "name": "#work",
        "created_at": "2023-01-01T00:00:00Z",
        "note_count": 25
      },
      {
        "id": "tag_uuid",
        "name": "#personal",
        "created_at": "2023-01-01T00:00:00Z",
        "note_count": 18
      }
    ],
    "total": 2,
    "limit": 50,
    "offset": 0,
    "has_more": false
  }
}
```

### Get Tag Suggestions

```
GET /api/v1/tags/suggestions
```

**Query Parameters**:
- `q` (string) - Partial tag name for autocomplete
- `limit` (integer, default: 10) - Maximum suggestions

**Request Headers**:
```
Authorization: Bearer <access_token>
```

**Response**:
```json
{
  "success": true,
  "data": {
    "suggestions": [
      {
        "name": "#work",
        "count": 25
      },
      {
        "name": "#workproject",
        "count": 5
      }
    ]
  }
}
```

### Create Tag

```
POST /api/v1/tags
```

**Request Headers**:
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body**:
```json
{
  "name": "#newtag"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "tag_uuid",
    "name": "#newtag",
    "created_at": "2023-01-01T00:00:00Z"
  }
}
```

### Delete Tag

```
DELETE /api/v1/tags/{id}
```

**Request Headers**:
```
Authorization: Bearer <access_token>
```

**Response**:
```json
{
  "success": true,
  "message": "Tag deleted successfully"
}
```

## Security API

### Get Rate Limit Information

```
GET /api/v1/security/rate-limit
```

**Request Headers**:
```
Authorization: Bearer <access_token>
```

**Response**:
```json
{
  "success": true,
  "data": {
    "limit": 60,
    "remaining": 45,
    "reset_time": "2023-01-01T11:00:00Z",
    "reset_timestamp": 1672574400,
    "retry_after": 30
  }
}
```

### Get Session Information

```
GET /api/v1/security/session-info
```

**Request Headers**:
```
Authorization: Bearer <access_token>
```

**Response**:
```json
{
  "success": true,
  "data": {
    "session_id": "session_uuid",
    "user_id": "user_uuid",
    "ip_address": "192.168.1.100",
    "user_agent": "Mozilla/5.0...",
    "created_at": "2023-01-01T10:00:00Z",
    "last_seen": "2023-01-01T10:30:00Z",
    "is_valid": true,
    "expires_at": "2023-01-08T10:00:00Z"
  }
}
```

### Get Security Metrics

```
GET /api/v1/security/metrics
```

**Request Headers**:
```
Authorization: Bearer <access_token>
```

**Response**:
```json
{
  "success": true,
  "data": {
    "failed_login_attempts": 5,
    "blocked_ips": 2,
    "active_sessions": 3,
    "suspicious_activities": 0,
    "last_security_scan": "2023-01-01T09:00:00Z",
    "security_score": "excellent"
  }
}
```

## Search API

### Search Notes

```
GET /api/v1/search/notes
```

**Query Parameters**:
- `q` (string, optional) - Search query for content
- `tags` (string, comma-separated) - Filter by hashtags
- `limit` (integer, default: 20) - Maximum results to return
- `offset` (integer, default: 0) - Number of results to skip

**Request Headers**:
```
Authorization: Bearer <access_token>
```

**Response**:
```json
{
  "success": true,
  "data": {
    "notes": [
      {
        "id": "note_uuid",
        "user_id": "user_uuid",
        "title": "Matching Note",
        "content": "Content matching #search-term",
        "created_at": "2023-01-01T12:00:00Z",
        "updated_at": "2023-01-01T12:30:00Z",
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

### Search Tags

```
GET /api/v1/search/tags
```

**Query Parameters**:
- `q` (string, required) - Tag search query
- `limit` (integer, default: 20) - Maximum results to return

**Request Headers**:
```
Authorization: Bearer <access_token>
```

**Response**:
```json
{
  "success": true,
  "data": {
    "tags": [
      {
        "id": "tag_uuid",
        "name": "#search-term",
        "created_at": "2023-01-01T12:00:00Z",
        "note_count": 3
      }
    ],
    "total": 1
  }
}
```

## Error Responses

All endpoints return responses in a consistent format:

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

### HTTP Status Codes

- `200 OK` - Request successful
- `201 Created` - Resource created successfully
- `400 Bad Request` - Invalid request data
- `401 Unauthorized` - Authentication required
- `403 Forbidden` - Access denied
- `404 Not Found` - Resource not found
- `409 Conflict` - Resource conflict (e.g., version mismatch)
- `422 Unprocessable Entity` - Validation errors
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error

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

- **Authenticated users**: 60 requests per minute per user
- **Unauthenticated requests**: 100 requests per hour

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1640995200
```

## Pagination

List endpoints support pagination using `limit` and `offset` parameters:

- `limit`: Maximum items per page (default varies by endpoint)
- `offset`: Number of items to skip

Pagination response includes:
- `total`: Total number of items
- `limit`: Items per page
- `offset`: Current offset
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

**Allowed Origins**:
- `chrome-extension://*`
- `http://localhost:*` (development)

**Allowed Methods**:
- GET, POST, PUT, DELETE, OPTIONS

**Allowed Headers**:
- Content-Type, Authorization, X-Request-ID

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

## Changelog

### Version 1.0.0 (Current)
- Initial API release
- Core note management features
- Authentication with Google OAuth + PKCE
- Search and filtering
- Batch operations (create/update up to 50 notes)
- User profile and preferences management
- Session management
- Security monitoring endpoints
- Comprehensive error handling
- Rate limiting and CORS support

---

For support and questions:
- **Documentation**: [API Documentation](https://docs.silence-notes.com/api)
- **Issues**: [GitHub Issues](https://github.com/your-username/my-notes/issues)
- **Email**: api-support@silence-notes.com