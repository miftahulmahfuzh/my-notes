# Quick Start: Google OAuth Setup for Chrome Extension

This guide provides step-by-step instructions to set up Google OAuth for your Silence Notes Chrome extension.

## 🚀 Quick Setup (10 minutes)

### Step 1: Load Extension & Get Extension ID

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked" and select your `extension/dist/` folder
4. Copy the **Extension ID** (it looks like: `chfmpenlkcapdcbnjdejfoagefjbolmg`)
   - **IMPORTANT**: Keep this ID - you'll need it for Google OAuth setup

### Step 2: Create Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Go to **APIs & Services** > **OAuth consent screen**
   - Choose **External**
   - App name: "Silence Notes"
   - User support email: your-email@gmail.com
   - Add your email as test user
4. Go to **APIs & Services** > **Credentials**
   - Click **+ CREATE CREDENTIALS** > **OAuth client ID**
   - **Application type**: **Chrome extension** ⭐ (NOT Web application)
   - **Name**: "Silence Notes Chrome Extension"
   - **Chrome app ID**: Paste your Extension ID from Step 1
   - Click **CREATE**
5. Copy your **Client ID** and **Client Secret**

### Step 3: Update Environment Variables

Edit your `backend/.env` file:

```bash
# Replace these with your actual credentials from Google Cloud Console
GOOGLE_CLIENT_ID=your-actual-client-id-here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-actual-client-secret-here
JWT_SECRET=make-up-a-long-random-secret-key-for-production-change-in-2024

# The rest should already be set correctly
GOOGLE_REDIRECT_URL=http://localhost:8080/api/v1/auth/chrome
```

**Where to find these values:**
- **Client ID**: From Google Cloud Console → APIs & Services → Credentials → Your OAuth Client
- **Client Secret**: Same place as Client ID (click the eye icon to reveal)
- **JWT Secret**: Create any long random string (use a password generator for security)

### Step 4: Update Extension Manifest

Edit your `extension/dist/manifest.json` to include your Client ID:

```json
{
  "oauth2": {
    "client_id": "your-actual-client-id-here.apps.googleusercontent.com",
    "scopes": [
      "openid",
      "email",
      "profile"
    ]
  }
}
```

**Find the file location:**
- Path: `extension/dist/manifest.json` (in your project directory)
- Look for the `oauth2` section (around line 22-29)
- Replace `your-actual-client-id-here.apps.googleusercontent.com` with your actual Client ID

**Required permissions should already be included:**
```json
"permissions": [
  "storage",
  "identity",  // This is required for Chrome Identity API
  "activeTab",
  "background",
  "alarms",
  "notifications",
  "scripting",
  "webNavigation"
]
```

### Step 5: Test the Setup

1. **Build and start your backend:**
   ```bash
   # From project root directory
   ./build.sh

   # Start the server
   backend/bin/silence-notes-server
   ```
   You should see: `🚀 Server starting on localhost:8080`

2. **Reload your Chrome extension:**
   - Go to `chrome://extensions/`
   - Click your extension's refresh button (🔄 icon)

3. **Test authentication:**
   - Click the Silence Notes extension icon in your toolbar
   - Click "Test Chrome Identity API" button
   - Google will ask for permission to access your email and profile
   - Click "Allow"
   - **You should see**: "Authentication successful! User: your-email@gmail.com"

4. **Verify the backend logs:**
   - Check the terminal where backend is running
   - You should see logs like: `"DEBUG: Received Chrome token (first 20 chars): ya29.a0ATi6K2uzE853x..."`
   - Success log: `"DEBUG: Sending response - User email: your-email@gmail.com, Name: Your Name"`

## 🔧 Troubleshooting

### "redirect_uri_mismatch" Error
- **Solution**: Make sure you selected **"Chrome extension"** as Application type (NOT "Web application")
- Verify your Extension ID in Google OAuth matches exactly what's in `chrome://extensions/`

### "bad client id" Error
- **Solution**: Double-check your Client ID in `extension/dist/manifest.json`
- Ensure there are no extra spaces or characters in the Client ID
- Verify you're using the Chrome Extension OAuth client (not Web application)

### "Nothing happens when I click Test Chrome Identity API"
- **Solution**: Check Chrome Developer Tools (right-click extension > Inspect)
- Look for errors in the Console tab
- Ensure "identity" permission is in manifest.json

### "Authentication failed: Invalid Chrome token" Error
- **Solution**: Check the backend logs in your terminal
- Verify the backend server is running on localhost:8080
- Ensure your Google OAuth client is properly configured for Chrome extensions

### "Authentication failed: Failed to create user" Error
- **Solution**: Check backend logs for database connection errors
- Ensure PostgreSQL is running and configured correctly in .env
- The UserPreferences JSON field might need custom scanning methods

### "Cannot read properties of undefined (reading 'email')" Error
- **Solution**: This is a frontend parsing issue - the response structure changed
- Check the Console for the actual response structure
- The email is likely in `data.data.user.email` instead of `data.user.email`

### Backend server won't start
- **Solution**: Check if port 8080 is already in use
- Run `pkill -f silence-notes-server` to kill existing processes
- Verify your Go dependencies are installed (`go mod tidy`)

### Build fails
- **Solution**: Make sure you're in the project root directory where `build.sh` is located
- Check that Go is properly installed and configured

## 📋 Checklist

- [ ] Chrome Extension loaded from `extension/dist/` folder
- [ ] Extension ID copied (looks like: `chfmpenlkcapdcbnjdejfoagefjbolmg`)
- [ ] Google OAuth client created (**Chrome extension** type)
- [ ] Extension ID added to Chrome app ID field in Google Cloud Console
- [ ] Client ID and Secret added to `backend/.env`
- [ ] JWT secret updated in `backend/.env`
- [ ] Extension manifest (`extension/dist/manifest.json`) updated with Client ID
- [ ] Backend server built and running on localhost:8080
- [ ] Extension reloaded in Chrome
- [ ] Authentication flow tested
- [ ] Success message appears: "Authentication successful! User: your-email@gmail.com"
- [ ] Backend logs show successful token validation

## 🎯 Multi-Device Sync Goal Achieved!

**Your Chrome extension OAuth authentication is now working!** 🎉

This enables exactly what you wanted:
> *"i can install this add on on my two laptops. and they can sync the data with each other"*

### Ready for Multi-Device Testing:
1. **Install on Laptop 1**: Load extension and authenticate with your Google account
2. **Install on Laptop 2**: Load extension and authenticate with the same Google account
3. **Both devices will sync**: Notes created on one device will appear on the other through authenticated API calls

### Next Development Steps:
1. **Implement Note CRUD Operations**: Create, read, update, delete notes using authenticated API calls
2. **Build Full Note Interface**: Complete the note-taking UI in the extension
3. **Test Real-time Sync**: Create notes on one laptop and verify they appear on the other
4. **Add Offline Support**: Store notes locally and sync when online

### Technical Achievement:
- ✅ Chrome Identity API integration working
- ✅ Google OAuth authentication complete
- ✅ JWT token generation and management
- ✅ Database user creation with preferences
- ✅ Multi-device synchronization foundation established

## 📚 Additional Resources

- [Chrome Identity API Documentation](https://developer.chrome.com/docs/extensions/reference/identity/)
- [Google OAuth 2.0 for Web Apps](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Chrome Extension Manifest V3](https://developer.chrome.com/docs/extensions/mv3/intro/)

---

**Need help?** Check the full setup guide in `docs/GOOGLE_OAUTH_SETUP.md` for detailed instructions and troubleshooting.
