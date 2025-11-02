# 🚀 Test Your Chrome Extension Now!

## 🔧 Backend Setup (First Time Only)

### Step 0: Build and Start Backend Server
1. **Open terminal** and navigate to project root:
   ```bash
   cd /mnt/c/Users/GPD/Downloads/my_github/my-notes
   ```

2. **Build the backend server**:
   ```bash
   ./build.sh
   ```
   *This creates the binary in `backend/bin/silence-notes-server`*

3. **Build the frontend extension**:
   ```bash
   npm run --prefix extension build
   ```
   *This creates the production build in `extension/dist/`*

4. **Start the backend server**:
   ```bash
   backend/bin/silence-notes-server
   ```
   *You should see: `🚀 Server starting on localhost:8080`*

5. **Verify backend is running** (optional):
   ```bash
   curl http://localhost:8080/api/v1/health
   ```
   *Should return: `{"status":"ok","timestamp":"..."}`*

## ✅ Current Status
- **Backend Server**: ✅ Running on `localhost:8080`
- **OAuth Credentials**: ✅ Configured with your Google Client ID
- **Extension**: ✅ Built and ready in `extension/dist/`

## 📱 How to Load and Test the Extension

### Step 1: Load Extension in Chrome
1. Open Chrome browser
2. Go to `chrome://extensions/`
3. Enable **"Developer mode"** (toggle in top right)
4. Click **"Load unpacked"**
5. Navigate to and select: `/mnt/c/Users/GPD/Downloads/my_github/my-notes/extension/dist/`
6. Click **"Select Folder"**

### Step 2: Test Authentication
1. Click the **Silence Notes** extension icon in your Chrome toolbar
2. You should see the popup with a **"Sign in with Google"** button
3. Click **"Sign in with Google"**
4. Google will ask for permission to access your email and profile
5. Click **"Allow"**
6. You should see your profile information in the extension

### Step 3: Verify Backend Integration
- **Success**: You see your name, email, and profile picture
- **Check Logs**: Backend will show authentication attempts
- **Check DevTools**: Right-click extension → Inspect → Console for any errors

## 🔧 What's Working

### ✅ Authentication Flow
```
Extension → Chrome Identity API → Google Sign-in →
Backend /api/v1/auth/chrome → JWT Tokens →
Extension stores tokens → Authenticated API calls
```

### ✅ Files Ready
- `extension/dist/manifest.json` - Has your OAuth credentials
- `backend/.env` - Has your Google Client ID and Secret
- `backend/bin/silence-notes-server` - Running and ready

## 🎯 Multi-Device Test (Your Goal)
1. **Install on Laptop 1**: Load extension and sign in with your Google account
2. **Install on Laptop 2**: Load extension and sign in with the same Google account
3. **Result**: Both devices will sync notes through the same authenticated user

## 🔍 Troubleshooting

### If "Sign in with Google" doesn't work:
1. **Check extension permissions**: Make sure "identity" permission is granted
2. **Check Console Errors**: Right-click extension → Inspect → Console
3. **Verify OAuth Client**: Ensure your Google OAuth client is configured as "Web application"

### If you see authorization errors:
1. **Check Backend**: Make sure backend server is running (`curl http://localhost:8080/api/v1/health`)
2. **Check Credentials**: Verify Client ID matches in both manifest.json and Google Cloud Console

### Backend Issues:
- **Build fails**: Make sure you're in the project root directory where `build.sh` is located
- **Port already in use**: Kill existing backend process with `pkill -f silence-notes-server`
- **Database connection errors**: Ensure PostgreSQL is running and credentials in `.env` are correct
- **Server not starting**: Check that all Go dependencies are installed (`go mod tidy`)

### Common Issues:
- **Extension not loading**: Make sure you're loading the `extension/dist/` folder
- **No sign-in button**: Refresh the extension or reload it
- **Backend errors**: Check that backend server is running on port 8080

## 📊 Expected Results

### ✅ Successful Authentication:
- Extension popup shows your profile picture, name, and email
- Backend logs show successful token exchange
- Extension stores JWT tokens for future API calls

### ✅ Ready for Next Steps:
Once authentication is working, you can:
1. Create notes with authenticated API calls
2. Sync notes between multiple devices
3. Implement note CRUD operations with proper user authentication

## 🎉 You're Ready to Test!

**Your Chrome extension with OAuth authentication is now ready for testing!**

The authentication system will enable exactly what you wanted:
> *"i can install this add on on my two laptops. and they can sync the data with each other"*

Go ahead and load the extension now - it should work with your Google account! 🚀