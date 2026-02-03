# Chrome Web Store Deployment Guide

**Deploy Silence Notes Extension to Chrome Web Store**

This guide provides the exact information to fill in the Chrome Web Store Developer Dashboard forms based on the current implementation.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Current Permissions](#current-permissions)
3. [Chrome Web Store Form Responses](#chrome-web-store-form-responses)
4. [Building for Production](#building-for-production)
5. [Creating the ZIP Package](#creating-the-zip-package)
6. [Troubleshooting](#troubleshooting)

---

## Quick Start

```bash
# 1. Build extension
cd extension
npm run build

# 2. Create ZIP (from dist/ folder)
cd dist
zip -r silence-notes.zip *.js *.json *.html *.css *.png

# 3. Upload to Chrome Web Store
# Go to: https://chrome.google.com/webstore/devconsole
```

---

## Current Permissions

### Manifest Permissions

Based on `extension/src/manifest.json`:

```json
{
  "permissions": [
    "storage",    // chrome.storage.local/sync for tokens and settings
    "identity",   // chrome.identity.getAuthToken for Google OAuth
    "background"  // Service worker for lifecycle events
  ],
  "host_permissions": [
    "https://my-notes-api-7bnrhx3mka-uc.a.run.app/*",
    "https://accounts.google.com/*",
    "https://www.googleapis.com/*",
    "https://oauth2.googleapis.com/*",
    "https://*.googleapis.com/*"
  ],
  "oauth2": {
    "scopes": ["openid", "email", "profile"]
  }
}
```

### Code Evidence

| Permission | Used In | Evidence |
|------------|---------|----------|
| `storage` | `auth.ts:502,508,516,522` | chrome.storage.local.set/get |
| `storage` | `Options.tsx:12,24` | chrome.storage.sync.set/get |
| `identity` | `auth.ts:244` | chrome.identity.getAuthToken |
| `background` | `manifest.json:30` | service_worker: "background.js" |

---

## Chrome Web Store Form Responses

### Store Listing Tab

**Name:**
```
Silence Notes
```

**Short description (max 132 characters):**
```
A brutalist note-taking Chrome extension with hashtag filtering and cloud sync. Simple, fast, private.
```

**Long description:**
```
## 📝 Silence Notes

A minimalist note-taking Chrome extension with a brutalist design philosophy. Create, organize, and sync notes instantly with powerful hashtag filtering.

---

## ✨ Features

### Core Functionality
- **Instant Notes**: Create notes in seconds with the popup interface
- **Hashtag Filtering**: Organize notes with #tags and filter instantly
- **Markdown Support**: Format notes with bold, italic, lists, and more
- **Cloud Sync**: Access your notes across devices with secure cloud storage
- **Full-Text Search**: Find any note instantly with powerful search

### Design Philosophy
- **Brutalist UI**: High contrast, bold typography, zero clutter
- **Privacy First**: Your notes are encrypted and stored securely
- **Lightning Fast**: No bloat, no loading screens, instant response

### Authentication
- **Google Sign-In**: Secure OAuth 2.0 authentication
- **Your Data**: Notes are stored in your personal cloud space
- **Cross-Device**: Access from any Chrome browser

---

## 🎯 Use Cases

- **Quick Capture**: Save ideas, links, and thoughts instantly
- **Task Management**: Use hashtags like #todo, #work, #personal
- **Research Notes**: Organize research with #topic tags
- **Journaling**: Daily notes with automatic timestamps
- **Code Snippets**: Save code with #javascript, #python tags

---

## 🔒 Privacy & Security

- **Secure Storage**: All notes stored encrypted in the cloud
- **Google Authentication**: Enterprise-grade OAuth 2.0 security
- **No Tracking**: We don't track your browsing or note content
- **Open Source**: Transparency in our code

---

## 🚀 Getting Started

1. Click "Add to Chrome" to install
2. Click the extension icon in your toolbar
3. Sign in with your Google account
4. Start taking notes!

---

## 💡 Tips & Tricks

- Use **#hashtags** anywhere in your notes for automatic organization
- Press **Ctrl+K** (or Cmd+K) for quick note search
- Click the **edit icon** on any note to modify it
- Use the **options page** to customize your experience

---

## 📦 Tech Stack

- **Frontend**: React + TypeScript (Manifest V3)
- **Backend**: Go REST API on Google Cloud Run
- **Database**: PostgreSQL with Redis caching
- **Auth**: Google OAuth 2.0

---

## 🆓 Pricing

Silence Notes is completely free. No subscriptions, no ads, no limits.

---

**Version:** 1.0.0
**Last Updated:** January 2026
```

**Category:**
```
Productivity > Tools
```

---

### Privacy Practices Tab

#### Single Purpose Description

```
Silence Notes is a note-taking Chrome extension that allows users to create, edit, organize, and sync notes with hashtag filtering. Users can sign in with their Google account to securely store notes in the cloud and access them across devices.
```

---

#### Permission Justifications

**Copy and paste these for each permission:**

---

##### **background**

```
Required for the service worker that handles extension lifecycle events (install, update, startup), message passing between components, and background API calls for authentication and data sync.
```

---

##### **host_permissions**

```
Host permissions are used exclusively for:

1. my-notes-api-*.run.app – Backend API for storing and syncing user notes
2. *.googleapis.com – Google Fonts for the extension UI

No data is sent to any third-party services other than our backend API for note storage and Google Fonts for styling.
```

---

##### **identity**

```
Uses Chrome Identity API (chrome.identity.getAuthToken) for Google OAuth 2.0 authentication with scopes: openid, email, and profile. This allows users to sign in with their Google account securely. The extension requests the user's email, user ID, and optional profile picture (avatar) for account creation and display.
```

---

##### **storage**

```
Uses chrome.storage.local and chrome.storage.sync to store:

1. User authentication tokens (access/refresh tokens) - Required for API access
2. User profile information (id, email, avatar_url) - For account display
3. Extension settings and preferences (autoSync, syncInterval, theme) - User customization

All data is stored locally on the user's device. Authentication tokens are only transmitted to our backend API for secure note storage.
```

---

##### **remote code use** (if shown)

```
The extension does NOT fetch or execute remote code. All code is bundled within the extension package. The only external network requests are HTTPS API calls to our backend server for data storage and retrieval, Google Fonts for styling, and Google's OAuth endpoints for authentication.
```

---

#### Data Handling

**Do you collect or use user data?**

```
Yes, but only for essential functionality:
- User profile (id, email, avatar_url) from Google OAuth for account identification and display
- Note content (titles, body, tags) stored in our secure backend database
- Authentication tokens for API access (stored locally)
```

**Do you share user data with third parties?**

```
No. User data is only shared with:
- Google OAuth services (for authentication only)
- Our secure backend API (for note storage)
```

---

### Contact Email

Add your contact email in the **Store listing** tab → **Contact** section.

---

## Building for Production

### Environment Configuration

**File: `extension/.env.production`**
```bash
# API Configuration - Production
VITE_API_BASE_URL=https://my-notes-api-7bnrhx3mka-uc.a.run.app/api/v1
```

### Build Command

```bash
cd extension
npm run build
```

This creates the production build in `extension/dist/`.

---

## Creating the ZIP Package

```bash
cd extension/dist

# Remove old ZIP
rm -f silence-notes.zip

# Create new ZIP (include only necessary files)
zip -r silence-notes.zip *.js *.json *.html *.css *.png

# Verify contents
unzip -l silence-notes.zip
```

**Expected files:**
```
background.js
content.js
icon16.png
icon48.png
icon128.png
manifest.json
options.html
options.css
options.js
popup.html
popup.css
popup.js
react.js
vendors.js
*.js (other bundled files)
```

**ZIP location:** `extension/dist/silence-notes.zip`

---

## Troubleshooting

### Problem: Rejected - Unused Permissions

**Error:**
```
Violation: Requesting but not using the following permission(s):
activeTab, alarms, notifications
```

**Solution:**

Only request permissions that are ACTUALLY used in your code.

**Current implementation permissions** (all actively used):
- ✅ `storage` - Used in `auth.ts` and `Options.tsx`
- ✅ `identity` - Used in `auth.ts` for Google OAuth
- ✅ `background` - Used for service worker

**DO NOT add** permissions for "future features" - this will cause rejection.

---

### Problem: Upload Failed - localhost URLs

**Error:**
```
The manifest defines an invalid url: http://localhost:*/*
```

**Solution:**
1. Open `extension/src/manifest.json`
2. Find `host_permissions` section
3. Ensure no `localhost` entries exist
4. Rebuild: `npm run build`

---

### Problem: Missing Icons

**Error:**
```
Package validation failed: Missing icon
```

**Solution:**
The build script automatically copies icons. If missing, verify `assets/icon*.png` files exist.

---

### Problem: Rejected - Policy Violation

**Common reasons:**
- **Confusing description** - Users don't understand what it does
- **Unused permissions** - Requesting permissions not used in code
- **Missing functionality** - Extension doesn't work as described
- **Privacy concerns** - Not transparent about data usage

**Solution:**
1. Read the rejection message carefully
2. Fix the specific issue
3. Add clarifications to store listing
4. Resubmit

---

## Quick Reference

### Essential Commands

```bash
# Build extension
cd extension && npm run build

# Create ZIP
cd dist && zip -r silence-notes.zip *.js *.json *.html *.css *.png
```

### Important Links

| What | Link |
|------|------|
| Developer Dashboard | https://chrome.google.com/webstore/devconsole |
| Developer Policies | https://chrome.google.com/webstore/program/policies |

---

## Checklist

Before submitting, ensure you've:

- [ ] Built the extension (`npm run build`)
- [ ] Created ZIP package
- [ ] Uploaded ZIP to Chrome Web Store
- [ ] Filled store listing (name, descriptions, category)
- [ ] Filled privacy practices (all permissions justified above)
- [ ] Added contact email
- [ ] Verified contact email
- [ ] Submitted for review

---

**Good luck with your submission!** 🚀
