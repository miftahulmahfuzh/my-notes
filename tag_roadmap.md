# Tag System Roadmap

## Database Tables

### `tags`
```sql
id         UUID PRIMARY KEY
name       VARCHAR(100) UNIQUE NOT NULL  -- Must start with #, only [a-zA-Z0-9_-]
created_at TIMESTAMP WITH TIME ZONE
```

### `note_tags`
```sql
note_id    UUID REFERENCES notes(id) ON DELETE CASCADE
tag_id     UUID REFERENCES tags(id) ON DELETE CASCADE
created_at TIMESTAMP WITH TIME ZONE
PRIMARY KEY (note_id, tag_id)
```

---

## Backend Endpoints & Implementation Plan

### Currently Active
| Endpoint | Status |
|----------|--------|
| GET /api/v1/search/notes?tags=work | ✅ Used |

### Currently Commented Out (Need Implementation)
| Endpoint | Purpose |
|----------|---------|
| GET /api/v1/tags | List all tags |
| POST /api/v1/tags | Create tag manually |
| GET /api/v1/tags/suggestions | Autocomplete suggestions |
| GET /api/v1/tags/{id} | Get specific tag |
| PUT /api/v1/tags/{id} | Rename tag |
| DELETE /api/v1/tags/{id} | Delete tag |
| GET /api/v1/tags/popular | Most used tags |
| GET /api/v1/tags/unused | Orphaned tags |
| GET /api/v1/tags/user | User's tags |
| GET /api/v1/tags/{id}/analytics | Tag usage stats |
| GET /api/v1/tags/search | Search tags |
| POST /api/v1/tags/cleanup | Bulk delete unused |
| POST /api/v1/tags/merge | Combine duplicate tags |
| GET /api/v1/tags/{id}/related | Tags used together |

---

## Feature Ideas (One Endpoint = One Feature)

### 1. Tag Cloud Sidebar
**Uses:** `GET /api/v1/tags`, `GET /api/v1/tags/popular`

Display all tags in sidebar with font size based on usage count. Click to filter.

---

### 2. Tag Autocomplete
**Uses:** `GET /api/v1/tags/suggestions`, `GET /api/v1/tags/search`

As user types `#wo`, suggest existing tags `#work`, `#workout`. Prevent duplicates.

---

### 3. Tag Rename
**Uses:** `PUT /api/v1/tags/{id}`

Rename `#wrk` → `#work`. Updates all notes automatically via FK.

---

### 4. Tag Delete
**Uses:** `DELETE /api/v1/tags/{id}`

Remove tag from system. CASCADE removes from all notes.

---

### 5. Unused Tags Cleanup
**Uses:** `GET /api/v1/tags/unused`, `POST /api/v1/tags/cleanup`

Show "orphaned tags" (created but no notes). One-click purge.

---

### 6. Tag Detail Page
**Uses:** `GET /api/v1/tags/{id}`, `GET /api/v1/tags/{id}/analytics`

Show tag stats: created date, note count, usage over time, related tags.

---

### 7. Tag Merge (De-duplication)
**Uses:** `POST /api/v1/tags/merge`

User has `#Work`, `#work`, `#WORK`. Merge all into single `#work`.

---

### 8. Related Tags Discovery
**Uses:** `GET /api/v1/tags/{id}/related`

Viewing `#frontend`, show co-occurring tags: `#react`, `#css`, `#typescript`.

---

### 9. User-specific Tags
**Uses:** `GET /api/v1/tags/user`

In multi-user future, each user sees their own tags.

---

### 10. Manual Tag Creation
**Uses:** `POST /api/v1/tags`

Create tag without attaching to note (for pre-defined tag sets).

---

## Verdict: Purge or Keep?

| Endpoint | Verdict | Reason |
|----------|---------|--------|
| GET /api/v1/tags | Keep | Tag cloud needs full list |
| POST /api/v1/tags | **PURGE** | Tags created from content automatically |
| GET /api/v1/tags/suggestions | Keep | Autocomplete UX |
| GET /api/v1/tags/{id} | Keep | Tag detail page |
| PUT /api/v1/tags/{id} | Keep | Rename is essential |
| DELETE /api/v1/tags/{id} | Keep | Cleanup is essential |
| GET /api/v1/tags/popular | **PURGE** | Redundant with GET /tags (sort by usage) |
| GET /api/v1/tags/unused | Keep | Identify orphans before cleanup |
| GET /api/v1/tags/user | Keep | Multi-user future |
| GET /api/v1/tags/{id}/analytics | Keep | Tag insights |
| GET /api/v1/tags/search | **PURGE** | Redundant with suggestions endpoint |
| POST /api/v1/tags/cleanup | Keep | Bulk delete unused tags |
| POST /api/v1/tags/merge | Keep | Fix typos/duplicates |
| GET /api/v1/tags/{id}/related | Keep | Discovery feature |

### Recommended Purges
- `POST /api/v1/tags` - Auto-extraction covers this
- `GET /api/v1/tags/popular` - Use `GET /tags?sort=usage_count` instead
- `GET /api/v1/tags/search` - Use suggestions endpoint instead

---

## Next Steps

1. Uncomment routes in `backend/internal/server/server.go:286-288`
2. Remove purged endpoints from handlers
3. Implement features one by one in separate sessions
