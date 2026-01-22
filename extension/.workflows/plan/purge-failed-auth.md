# Purge Failed OAuth Auth Method - Implementation Plan

## Overview

Remove the non-working Google OAuth authentication system (`services/auth.ts`) and keep only the working Chrome Identity API method (`auth.ts`).

## Current State Analysis

### Working Method (KEEP)
- **File**: `extension/src/auth.ts`
- **Method**: Chrome Identity API (`chrome.identity.getAuthToken()`)
- **Endpoint**: `POST /api/v1/auth/chrome`
- **Storage**: Individual keys (`access_token`, `refresh_token`, `token_expiry`, `session_id`, `user_info`)
- **Used by**: `popup/index.tsx`, `api.ts`, `SimpleUserProfile.tsx`, `NoteEditor.tsx`, `TemplateSelector.tsx`

### Failed Method (DELETE)
- **File**: `extension/src/services/auth.ts`
- **Method**: Standard Google OAuth 2.0 with `launchWebAuthFlow()`
- **Endpoints**: `POST /api/v1/auth/google`, `POST /api/v1/auth/exchange`
- **Storage**: Unified object (`silence_notes_tokens`)
- **Used by**: `AuthButton.tsx`, `UserProfile.tsx` (both unused in production)

### Backend Status
| Route | Handler | Status |
|-------|---------|--------|
| `POST /api/v1/auth/chrome` | ChromeAuth.ExchangeChromeToken | Working (deprecated in comments) |
| `POST /api/v1/auth/google` | Auth.GoogleAuth | Not used by extension |
| `POST /api/v1/auth/exchange` | Auth.GoogleCallback | Not used by extension |

## Implementation Plan

### Phase 1: Delete Failed Frontend Files

#### 1.1 Delete Failed Auth Service
**File**: `extension/src/services/auth.ts`
```bash
rm extension/src/services/auth.ts
```

#### 1.2 Delete Unused Components
**Files**:
- `extension/src/components/AuthButton.tsx`
- `extension/src/components/UserProfile.tsx`

```bash
rm extension/src/components/AuthButton.tsx
rm extension/src/components/UserProfile.tsx
```

#### 1.3 Delete Unused Type Definitions
**File**: `extension/src/types/auth.ts`

**Note**: Verify first that no other files import from this file:
```bash
grep -r "from.*types/auth" extension/src/
```

If no results (expected), delete:
```bash
rm extension/src/types/auth.ts
```

#### 1.4 Clean Up services Directory
If `extension/src/services/` becomes empty after deleting `auth.ts`, consider removing the directory:
```bash
# Check if directory is empty
ls -la extension/src/services/
# If empty, remove it
rmdir extension/src/services/
```

### Phase 2: Backend Cleanup (Optional)

**Note**: The backend OAuth endpoints (`/api/v1/auth/google`, `/api/v1/auth/exchange`) may be useful for future web/mobile apps. Consider keeping them but documenting that they are not used by the Chrome extension.

#### Option A: Keep Endpoints (Recommended)
- Keep `GoogleAuth` and `GoogleCallback` handlers for future use
- Update comments to clarify they are not used by Chrome extension
- Remove deprecation notices from `/api/v1/auth/chrome` (it IS the working method)

#### Option B: Remove Unused Code
If you're certain these will never be used:

1. **Update `backend/internal/server/server.go`**
   - Remove lines 236-237 (google and exchange routes)

2. **Update `backend/internal/handlers/auth.go`**
   - Remove `GoogleAuth()` method (lines 60-110)
   - Remove `GoogleCallback()` method (lines 112-249)
   - Keep `RefreshToken`, `Logout`, `ValidateToken` (used by working flow)

3. **Update `backend/internal/handlers/handlers.go`**
   - Remove related imports if any

### Phase 3: Update Documentation

#### 3.1 Update Deprecation Notices
**File**: `backend/internal/server/server.go`
**Lines 242-244**

Change from:
```go
// DEPRECATED: Chrome Identity API endpoint - use Google OAuth (/api/v1/auth/google) instead
// This endpoint is for backward compatibility and will be removed in version 2.0
```

To:
```go
// Chrome Identity API endpoint for Chrome Extension authentication
// This is the primary auth method for the Silence Notes Chrome Extension
```

#### 3.2 Update CLAUDE.md
Add section about authentication:
```markdown
## Authentication

The Silence Notes Chrome Extension uses Chrome Identity API for authentication:
- **Frontend**: `extension/src/auth.ts` - Chrome Identity API implementation
- **Backend**: `POST /api/v1/auth/chrome` - Token exchange endpoint
- **Method**: `chrome.identity.getAuthToken()` for direct token access

### Unused OAuth Routes
The following backend routes exist but are NOT used by the Chrome extension:
- `POST /api/v1/auth/google` - Standard OAuth flow (for future web/mobile apps)
- `POST /api/v1/auth/exchange` - OAuth callback handler
```

### Phase 4: Verification

#### 4.1 Build Frontend
```bash
./frontend_build.sh
```

**Expected**: Build succeeds with no import errors

#### 4.2 Search for Remaining References
```bash
# Check for services/auth imports
grep -r "services/auth" extension/src/

# Check for AuthService usage
grep -r "AuthService" extension/src/

# Check for types/auth imports
grep -r "types/auth" extension/src/
```

**Expected**: No results (only results should be in `src_backup/` or tests)

#### 4.3 Test Extension
1. Load extension in Chrome
2. Login with Google
3. Create/edit/delete notes
4. Verify logout works
5. Refresh and verify persistence

## Files Summary

### DELETE
| File | Reason |
|------|--------|
| `extension/src/services/auth.ts` | Failed OAuth service |
| `extension/src/components/AuthButton.tsx` | Unused component using failed service |
| `extension/src/components/UserProfile.tsx` | Unused component using failed service |
| `extension/src/types/auth.ts` | Types only used by failed system |

### MODIFY (Optional - Backend Cleanup)
| File | Change |
|------|--------|
| `backend/internal/server/server.go` | Remove google/exchange routes (Option B) |
| `backend/internal/handlers/auth.go` | Remove GoogleAuth/GoogleCallback methods (Option B) |
| `backend/internal/server/server.go` | Update deprecation notice (Option A) |

### KEEP (Working System)
| File | Purpose |
|------|---------|
| `extension/src/auth.ts` | Chrome Identity API service (WORKING) |
| `extension/src/popup/index.tsx` | Main popup using working auth |
| `extension/src/components/SimpleUserProfile.tsx` | Profile component using working auth |
| `extension/src/api.ts` | API service using working auth |
| `extension/src/components/NoteEditor.tsx` | Using working auth |
| `extension/src/components/TemplateSelector.tsx` | Using working auth |
| `backend/internal/handlers/chrome_auth.go` | Chrome Identity API handler |
| `POST /api/v1/auth/chrome` | Working auth endpoint |

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking imports in components | Low | High | Phase 4.2 grep verification |
| Deleting files still in use | Low | High | Verify with grep before deleting |
| Future need for OAuth endpoints | Medium | Low | Option A keeps them |

## Success Criteria
- [ ] Frontend builds without errors
- [ ] No imports of `services/auth` in production code
- [ ] No imports of `types/auth` in production code
- [ ] Login flow works end-to-end
- [ ] Logout flow works end-to-end
- [ ] Notes can be created/edited/deleted
- [ ] Authentication persists across extension reload
