# Silence Notes User Guide

## Welcome to Silence Notes

Silence Notes is a powerful Chrome extension for note-taking that helps you capture thoughts, organize information with hashtags, and sync seamlessly across devices. This guide covers all features available in Phase 3 of development.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Creating Notes](#creating-notes)
3. [Managing Notes](#managing-notes)
4. [Hashtag Organization](#hashtag-organization)
5. [Search and Discovery](#search-and-discovery)
6. [Sync](#sync-and-backup)
7. [Keyboard Shortcuts](#keyboard-shortcuts)
8. [Offline Usage](#offline-usage)
9. [Troubleshooting](#troubleshooting)

## Getting Started

### Installation

1. **Install from Chrome Web Store**
   - Visit the Chrome Web Store
   - Search for "Silence Notes"
   - Click "Add to Chrome"

2. **Pin the Extension**
   - Click the puzzle piece icon in Chrome's toolbar
   - Find "Silence Notes" and click the pin icon
   - The Silence Notes icon will now appear in your toolbar

### First Time Setup

1. **Sign In**
   - Click the Silence Notes icon in your toolbar
   - Click "Sign in with Google"
   - Authorize the extension to access your Google account

2. **Choose Your Settings**
   - **Theme**: Light or Dark mode
   - **Auto-save**: Enable/disable automatic saving
   - **Sync**: Enable real-time synchronization
   - **Notifications**: Choose which notifications to receive

## Creating Notes

### Quick Note Creation

1. **From the Extension Popup**
   - Click the Silence Notes icon in your toolbar
   - Click the "New Note" button (or press `Ctrl+N`)
   - Start typing your note

2. **From Any Web Page**
   - Select text on any webpage
   - Right-click and select "Save to Silence Notes"
   - The selected text will be saved as a new note

### Note Editor Features

#### Rich Text Input
- **Title**: Optional, auto-generated from first line if not provided
- **Content**: Main note content with full hashtag support
- **Auto-save**: Notes save automatically every 2 seconds
- **Character/Word Count**: Real-time statistics at the bottom

#### Hashtag Detection
- Hashtags are automatically detected as you type
- Common patterns: `#work`, `#personal`, `#urgent`
- Detected hashtags appear below the editor
- Click on detected hashtags to filter by that tag

#### Saving Options
- **Manual Save**: Click "Save" button or press `Ctrl+S`
- **Force Save**: Press `Ctrl+Shift+S` to save immediately
- **Auto-save**: Enabled by default, saves every 2 seconds
- **Save Indicator**: Shows when notes are being saved

## Managing Notes

### Viewing Your Notes

1. **Notes List**
   - Main view showing all your notes
   - Sortable by date, title, or relevance
   - Pagination for large collections

2. **Note Cards**
   - Title, content preview, and metadata
   - Hashtags shown as clickable tags
   - Character count and creation date
   - Version number for tracking changes

### Editing Notes

1. **Open Editor**
   - Click on any note in the list
   - Or click the edit icon (pencil) that appears on hover

2. **Make Changes**
   - Edit title and content
   - Add or remove hashtags
   - Changes are auto-saved

3. **Version History**
   - Each edit creates a new version
   - Version number displayed in editor
   - Previous versions can be restored (feature coming soon)

### Deleting Notes

1. **Single Note Deletion**
   - Hover over the note
   - Click the delete icon (trash can)
   - Confirm deletion in the dialog

2. **Batch Deletion**
   - Select multiple notes using checkboxes
   - Click "Delete Selected"
   - Confirm bulk deletion

3. **Permanent Deletion**
   - Deleted notes are moved to trash
   - Trash is emptied after 30 days
   - Premium users can recover deleted notes

## Hashtag Organization

### Using Hashtags

1. **Creating Hashtags**
   - Type `#` followed by text anywhere in your note
   - Examples: `#work`, `#meeting`, `#todo`
   - Hashtags can contain letters, numbers, and underscores

2. **Best Practices**
   - Use descriptive names: `#project-alpha` instead of `#pa`
   - Be consistent: `#work` vs `#Work` (treated as different tags)
   - Use hierarchical tags: `#work/project`, `#personal/health`

### Tag Management

1. **View All Tags**
   - Click the "Tags" tab in the sidebar
   - See all your hashtags with usage counts
   - Tags are sorted by frequency of use

2. **Tag Filtering**
   - Click any hashtag to filter notes
   - Combine multiple tags for specific filtering
   - Clear filters by clicking "Clear All"

3. **Tag Suggestions**
   - As you type hashtags, suggestions appear
   - Based on your existing tags
   - Helps maintain consistency

### Advanced Tag Features

1. **Tag Analytics**
   - See usage statistics for each tag
   - Track trends over time
   - Identify your most used tags

2. **Tag Colors** (Premium feature)
   - Assign colors to important tags
   - Visual organization in the notes list
   - Customizable color schemes

## Search and Discovery

### Basic Search

1. **Search Bar**
   - Located at the top of the notes list
   - Searches through titles and content
   - Real-time results as you type

2. **Search Syntax**
   - **Text Search**: `meeting notes` - finds notes containing both words
   - **Exact Phrase**: `"project deadline"` - finds exact phrase matches
   - **Exclude Words**: `meeting -private` - finds notes with "meeting" but not "private"

### Advanced Search

1. **Hashtag Search**
   - Search by tag: `#work`
   - Multiple tags: `#work #urgent`
   - Exclude tags: `meeting -#personal`

2. **Date Search**
   - Created today: `created:today`
   - Modified this week: `modified:week`
   - Date range: `created:2023-01-01..2023-01-31`

3. **Field-Specific Search**
   - Title only: `title:meeting`
   - Content only: `content:deadline`

### Search Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `AND` | All terms must be present | `work AND urgent` |
| `OR` | Any term can be present | `meeting OR appointment` |
| `NOT` | Exclude term | `project NOT confidential` |
| `*` | Wildcard | `proj*` matches project, program, etc. |
| `""` | Exact phrase | `"quarterly report"` |
| `()` | Group terms | `(work OR personal) AND urgent` |

### Search Results

1. **Result Display**
   - Relevance-ordered results
   - Highlighted search terms
   - Context preview for each match

2. **Filter Results**
   - Filter by date, tags, or author
   - Sort by relevance, date, or title
   - Save search queries for reuse

## Sync and Backup

### Automatic Synchronization

1. **Real-time Sync**
   - Changes sync automatically when online
   - Works across all your devices
   - Conflict resolution for simultaneous edits

2. **Sync Status**
   - Green checkmark: Fully synced
   - Yellow arrow: Syncing in progress
   - Red X: Sync error (click to retry)

3. **Conflict Resolution**
   - **Auto-resolve**: Most recent version wins
   - **Manual resolve**: Choose which version to keep
   - **Merge**: Combine both versions (advanced)

### Offline Mode

1. **Offline Editing**
   - Create and edit notes without internet
   - Changes saved locally
   - Queue for sync when back online

2. **Sync Queue**
   - Shows pending changes
   - Manual sync option available
   - Clear queue if needed

3. **Storage Management**
   - Local storage quota monitoring
   - Automatic cleanup of old local data

## Keyboard Shortcuts

### Global Shortcuts

| Shortcut | Action | Availability |
|----------|--------|--------------|
| `Ctrl+N` | New Note | Extension popup |
| `Ctrl+/` | Show Help | Extension popup |
| `Ctrl+Shift+N` | Quick Capture | Any webpage |

### Editor Shortcuts

| Shortcut | Action | Description |
|----------|--------|-------------|
| `Ctrl+S` | Save Note | Manual save |
| `Ctrl+Shift+S` | Force Save | Immediate save |
| `Escape` | Cancel | Close without saving |
| `Ctrl+Z` | Undo | Undo last edit |
| `Ctrl+Y` | Redo | Redo last undo |
| `Ctrl+B` | Bold | Format text (future) |
| `Ctrl+I` | Italic | Format text (future) |

### Navigation Shortcuts

| Shortcut | Action | Description |
|----------|--------|-------------|
| `Tab` | Next Field | Navigate between fields |
| `Shift+Tab` | Previous Field | Navigate backwards |
| `Enter` | Activate | Select focused item |
| `↑↓` | Navigate | Up/down through list |
| `Home/End` | Jump | Beginning/end of list |

## Offline Usage

### Working Offline

1. **Offline Indicator**
   - Shows connection status in toolbar
   - Orange when offline, green when online
   - Click for connection details

2. **Offline Features**
   - Create new notes
   - Edit existing notes
   - Search local notes
   - Use all hashtags

3. **Limitations Offline**
   - No new tag creation (uses existing tags only)
   - Limited search functionality

### Sync When Back Online

1. **Automatic Sync**
   - Starts automatically when connection restored
   - Processes all queued changes
   - Resolves conflicts automatically when possible

2. **Manual Sync**
   - Click sync button to force sync
   - View sync progress and status
   - Cancel sync if needed

3. **Conflict Handling**
   - Automatic resolution for most conflicts
   - Manual options for complex conflicts

## Troubleshooting

### Common Issues

1. **Sync Problems**
   - **Issue**: Notes not syncing between devices
   - **Solution**:
     - Check internet connection
     - Sign out and sign back in
     - Clear sync queue and try again
     - Contact support if issue persists

2. **Storage Quota**
   - **Issue**: "Storage quota exceeded" error
   - **Solution**:
     - Delete old or unnecessary notes
     - Clear browser cache
     - Upgrade to premium for more storage

3. **Extension Not Loading**
   - **Issue**: Extension popup doesn't open
   - **Solution**:
     - Restart Chrome browser
     - Disable and re-enable extension
     - Clear browser cache and cookies
     - Check for extension updates

4. **Hashtag Issues**
   - **Issue**: Hashtags not being detected
   - **Solution**:
     - Ensure hashtag starts with `#`
     - Use only letters, numbers, and underscores
     - Avoid special characters and spaces
     - Check for conflicting formatting

### Performance Issues

1. **Slow Loading**
   - Reduce number of notes per page
   - Clear old search history
   - Disable auto-save temporarily

2. **Memory Usage**
   - Close unused tabs with Silence Notes
   - Regularly clear old notes
   - Restart browser periodically

### Getting Help

1. **Built-in Help**
   - Press `Ctrl+/` in the extension
   - Access comprehensive help documentation
   - View interactive tutorials

2. **Support Resources**
   - **Email**: support@silence-notes.com
   - **Help Center**: https://help.silence-notes.com
   - **Community Forum**: https://community.silence-notes.com
   - **Status Page**: https://status.silence-notes.com

3. **Feedback and Bug Reports**
   - Use the feedback button in extension
   - Include screenshots when possible
   - Describe steps to reproduce issues
   - Suggest feature improvements

### Advanced Troubleshooting

1. **Debug Mode**
   - Enable debug logging in settings
   - Check browser console for errors
   - Share debug logs for support

2. **Reset Options**
   - **Soft Reset**: Clear local cache and settings
   - **Hard Reset**: Complete data reset
   - **Sync Reset**: Clear sync queue and restart

3. **Data Recovery**
   - Contact support for recovery assistance

## Tips and Best Practices

### Organization Tips

1. **Consistent Hashtag System**
   - Create a personal hashtag taxonomy
   - Use consistent naming conventions
   - Review and clean up tags regularly

2. **Regular Maintenance**
   - Review and delete old notes monthly
   - Consolidate similar tags

3. **Productivity Workflows**
   - Use Quick Capture for fleeting thoughts
   - Process notes into actionable items
   - Use priority tags like `#urgent` and `#todo`

### Security Best Practices

1. **Data Protection**
   - Use strong Google password
   - Enable two-factor authentication
   - Regularly review app permissions

2. **Privacy Considerations**
   - Avoid storing sensitive personal information
   - Be mindful of sharing notes with tags
   - Regularly review and delete sensitive notes

### Performance Optimization

1. **Large Note Collections**
   - Use pagination for better performance
   - Regularly archive old notes
   - Use search filters effectively

2. **Mobile Usage**
   - Sync before going offline
   - Use mobile-optimized keyboard shortcuts
   - Monitor data usage

## What's Coming Next

### Phase 4 Features (In Development)

1. **Advanced Collaboration**
   - Real-time collaborative editing
   - Note sharing and permissions
   - Comments and discussions

2. **Enhanced Media Support**
   - Image attachments
   - Voice notes
   - File attachments and previews

3. **Advanced Search**
   - Full-text search with OCR
   - Voice search
   - Advanced filters and facets

4. **Integration Features**
   - Calendar integration
   - Task management
   - Third-party app connections

### Premium Features

1. **Advanced Sync Options**
   - Unlimited devices
   - Priority sync queue
   - Advanced conflict resolution

2. **Enhanced Security**
   - End-to-end encryption
   - Two-factor authentication
   - Advanced privacy controls

3. **Premium Support**
   - Priority customer support
   - Data recovery services
   - Custom setup assistance

---

Thank you for using Silence Notes! We're constantly working to improve your note-taking experience. If you have any questions, feedback, or suggestions, please don't hesitate to reach out to our support team.

**Last Updated**: January 1, 2023
**Version**: 1.0.0 (Phase 3 Complete)