# GCP Deployment Guide - Complete Tutorial

**Deploy Silence Notes Backend to Google Cloud Platform (Cloud Run + Cloud SQL)**

This guide walks you through deploying the Silence Notes backend to Google Cloud Platform. No prior GCP experience is required.

---

## Table of Contents

1. [What You're Deploying](#what-youre-deploying)
2. [Prerequisites](#prerequisites)
3. [Understanding Google Cloud Platform](#understanding-google-cloud-platform)
4. [Step-by-Step Deployment](#step-by-step-deployment)
5. [Updating Your Extension](#updating-your-extension)
6. [Testing the Deployment](#testing-the-deployment)
7. [Managing Your Deployment](#managing-your-deployment)
8. [Troubleshooting](#troubleshooting)
9. [Cost Management](#cost-management)
10. [Security Best Practices](#security-best-practices)

---

## What You're Deploying

You will deploy:

| Component | What It Does | Technology |
|-----------|--------------|------------|
| **Backend API** | REST API for notes, auth, search | Go on Cloud Run |
| **Database** | Stores notes, users, tags | PostgreSQL on Cloud SQL |

**Architecture:**
```
Chrome Extension --> Cloud Run (Backend) --> Cloud SQL (Database)
                       ↓
                    Artifact Registry
                       (Docker images)
```

---

## Prerequisites

Before you start, make sure you have:

### Required Accounts
- [x] **Google Account** (gmail.com or any Google account)
- [x] **Credit Card** (required for GCP, but you get free credits)

### Required Software
- [x] **gcloud CLI** - Google's command-line tool
- [x] **Git** - For cloning the repository
- [x] **Code Editor** - VS Code, Sublime, etc.

### Time Commitment
- **First deployment**: ~30 minutes (mostly waiting for Cloud SQL to create)
- **Future updates**: ~5 minutes

---

## Understanding Google Cloud Platform

### What is GCP?

Google Cloud Platform (GCP) is Google's cloud computing services. Think of it as:
- **Computers you can rent** (Cloud Run, Compute Engine)
- **Databases you can rent** (Cloud SQL, Firestore)
- **Storage you can rent** (Cloud Storage)

### Key Concepts

| Term | Simple Explanation |
|------|-------------------|
| **Project** | Like a folder containing all your GCP resources |
| **Region** | Where your servers are located (e.g., us-central1 = Iowa, USA) |
| **Service** | A specific GCP product (Cloud Run, Cloud SQL, etc.) |
| **Instance** | One running copy of something (like one database) |

### Services You'll Use

1. **Cloud Run** - Runs your backend code without managing servers
2. **Cloud SQL** - Managed PostgreSQL database
3. **Cloud Build** - Builds your Docker container
4. **Artifact Registry** - Stores your Docker images

---

## Step-by-Step Deployment

### Step 1: Create a Google Cloud Project

#### 1.1 Go to Google Cloud Console

Open your browser and go to: https://console.cloud.google.com/

#### 1.2 Create a New Project

1. Click the project dropdown at the top (next to "Google Cloud Platform")
2. Click **"NEW PROJECT"**
3. Fill in:
   - **Project name**: `Silence Notes` (or any name you like)
   - **Organization**: Leave blank (or select your organization)
4. Click **"CREATE"**

**Note:** Project creation takes ~30 seconds. Wait for the notification banner.

#### 1.3 Note Your Project ID

Once created, you'll see a Project ID (like `silence-notes-123456`).

**Copy this somewhere safe** - you'll need it later!

---

### Step 2: Enable Billing

#### 2.1 Go to Billing

1. In the left sidebar, click **"Billing"**
2. If prompted, click **"Link a billing account"**
3. Click **"Create account"**

#### 2.2 Add Payment Details

Fill in your credit card information. Google requires this for verification.

**Good News:**
- New accounts get **$300 in free credits** (12 months)
- Our deployment costs **~$8-13/month** after credits
- You won't be charged immediately

#### 2.3 Verify Billing is Enabled

You should see a green checkmark next to "Billing" in the sidebar.

---

### Step 3: Install and Setup gcloud CLI

The `gcloud` command-line tool lets you control GCP from your terminal.

#### 3.1 Install gcloud CLI

**On macOS:**
```bash
brew install google-cloud-sdk
brew install --cask google-cloud-sdk
# Or download from: https://cloud.google.com/sdk/docs/install
```

**On Linux:**
```bash
curl https://sdk.cloud.google.com | bash
exec -l $SHELL
gcloud init
```

**On Windows:**
Download the installer from: https://cloud.google.com/sdk/docs/install

#### 3.2 Verify Installation

```bash
gcloud version
```

You should see version information.

#### 3.3 Login to Google Cloud

```bash
gcloud auth login
```

This opens a browser window. Sign in with your Google account and allow access.

#### 3.4 Set Your Default Project

```bash
# Replace YOUR_PROJECT_ID with your actual project ID
gcloud config set project YOUR_PROJECT_ID

# Verify
gcloud config list project
```

---

### Step 4: Prepare Deployment Script

#### 4.1 Copy the Template

The repository has a template file. Copy it and customize:

```bash
# Navigate to your project directory
cd /path/to/my-notes

# Copy the template
cp deploy_gcp.sh.template deploy_gcp.sh

# Make it executable
chmod +x deploy_gcp.sh
```

#### 4.2 Edit the Deployment Script

Open `deploy_gcp.sh` in your editor and fill in the required values:

```bash
# Edit with your code editor
code deploy_gcp.sh
# or
nano deploy_gcp.sh
# or
vim deploy_gcp.sh
```

**Fill in these values:**

| Variable | What to Enter | Example |
|----------|---------------|---------|
| `PROJECT_ID` | Your GCP Project ID from Step 1.3 | `silence-notes-123456` |
| `REGION` | Closest region to your users | `us-central1` |
| `DB_PASSWORD` | Strong password for database | Generate with: `openssl rand -base64 24` |
| `JWT_SECRET` | Secret for JWT tokens (optional) | Generate with: `openssl rand -base64 42` |

**Example configuration:**
```bash
PROJECT_ID="silence-notes-123456"
REGION="us-central1"
DB_PASSWORD="xK9$mP2@nL5#qR8&wT4!zY7%"
JWT_SECRET=""  # Leave empty to auto-generate
```

**Available Regions:**
| Region | Location |
|--------|----------|
| `us-central1` | Iowa, USA |
| `us-east1` | South Carolina, USA |
| `us-west1` | Oregon, USA |
| `europe-west1` | Belgium |
| `asia-southeast1` | Singapore |

Choose a region **closest to your users** for best performance.

#### 4.3 Save and Close

Save the file and exit your editor.

---

### Step 5: Run the Deployment

#### 5.1 Execute the Deployment Script

```bash
./deploy_gcp.sh
```

#### 5.2 What Happens During Deployment

The script will:

| Step | Action | Time Required |
|------|--------|---------------|
| 1 | Validates your configuration | 10 seconds |
| 2 | Checks prerequisites (gcloud, auth) | 10 seconds |
| 3 | Enables required APIs | 30 seconds |
| 4 | Creates Cloud SQL database | **5-10 minutes** |
| 5 | Sets database password | 10 seconds |
| 6 | Creates the database | 5 seconds |
| 7 | Runs database migrations | 30 seconds |
| 8 | Builds Docker image | 2-3 minutes |
| 9 | Pushes to Artifact Registry | 1 minute |
| 10 | Deploys to Cloud Run | 1-2 minutes |
| 11 | Runs health check | 5 seconds |

**Total time:** ~15-20 minutes (mostly waiting for database creation)

#### 5.3 Expected Output

You'll see progress messages like:

```
═══════════════════════════════════════════════════════════════
  Silence Notes - GCP Deployment
═══════════════════════════════════════════════════════════════

▶ Validating configuration...
✓ Configuration validated

▶ Checking prerequisites...
✓ gcloud CLI found
✓ Authenticated to gcloud

▶ Setting up Google Cloud project...
✓ Project set to: silence-notes-123456
✓ APIs enabled

▶ Setting up Cloud SQL database...
▶ Creating new Cloud SQL instance (this takes 5-10 minutes)...
✓ Cloud SQL instance created
✓ Password set
✓ Database created

═══════════════════════════════════════════════════════════════
  Building and Deploying
═══════════════════════════════════════════════════════════════

▶ Creating production environment file...
✓ Environment file created

▶ Running database migrations on Cloud SQL...
▶ Connecting to database at xxx.xxx.xxx.xxx...
✓ Database schema created successfully
✓ Migrations completed

▶ Setting up Artifact Registry...
✓ Artifact Registry ready

▶ Building Docker image (this takes 2-3 minutes)...
✓ Docker image built and pushed

▶ Deploying to Cloud Run...
✓ Deployed to Cloud Run

═══════════════════════════════════════════════════════════════
  Verifying Deployment
═══════════════════════════════════════════════════════════════

▶ Testing health endpoint...
✓ Health check passed!

═══════════════════════════════════════════════════════════════
  Deployment Complete!
═══════════════════════════════════════════════════════════════

✓ Backend deployed successfully!

Service Details:
  URL:          https://my-notes-api-xxxxx-xx.a.run.app
  Region:       us-central1
  Database:     silence-notes-123456:us-central1:my-notes-db

⚠ IMPORTANT: Save these credentials securely!
  Database Password: your-password-here
  JWT Secret:         your-jwt-secret-here
```

#### 5.4 Save Your Credentials

**Copy and save these securely:**
- Service URL
- Database password
- JWT secret

You'll need them if you ever need to redeploy or troubleshoot.

---

### Step 6: Verify the Deployment

#### 6.1 Test the Health Endpoint

```bash
# Replace with your actual service URL
curl https://my-notes-api-xxxxx-xx.a.run.app/api/v1/health
```

**Expected response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-27T12:00:00Z",
  "version": "1.0.0",
  "uptime": "5.234s"
}
```

#### 6.2 View Live Logs

```bash
# Replace with your service name
gcloud run services logs tail my-notes-api --follow
```

Press `Ctrl+C` to stop watching logs.

#### 6.3 Check the Service in Console

1. Go to: https://console.cloud.google.com/run
2. Click on your service (`my-notes-api`)
3. You'll see:
   - Service URL
   - Revisions
   - Metrics
   - Logs

---

## Updating Your Extension

Now that your backend is deployed, update your Chrome extension to use it.

### Files to Update

You need to update **2 files** in your extension:

#### File 1: `extension/src/utils/config.ts`

**Find this line:**
```typescript
API_BASE_URL: 'http://localhost:8080/api/v1',
```

**Replace with your deployed URL:**
```typescript
API_BASE_URL: 'https://my-notes-api-xxxxx-xx.a.run.app/api/v1',
```

**Full context:**
```typescript
export const CONFIG = {
  // API Configuration - Production URL on Cloud Run
  API_BASE_URL: 'https://my-notes-api-xxxxx-xx.a.run.app/api/v1',

  // Google OAuth Configuration
  GOOGLE_OAUTH: {
    // ... rest of config
  }
};
```

#### File 2: `extension/src/api.ts`

**Find this section:**
```typescript
const defaultConfig: ApiConfig = {
  baseUrl: 'http://localhost:8080',
  timeout: 10000,
  retryAttempts: 3,
  retryDelay: 1000
};
```

**Replace with:**
```typescript
const defaultConfig: ApiConfig = {
  baseUrl: 'https://my-notes-api-xxxxx-xx.a.run.app',
  timeout: 10000,
  retryAttempts: 3,
  retryDelay: 1000
};
```

### Rebuild the Extension

After updating the files:

```bash
# From the project root
./frontend_build.sh
```

### Load the Updated Extension

1. Open Chrome and go to `chrome://extensions/`
2. Find "Silence Notes" in the list
3. Click the **refresh icon** (circular arrow) on the extension card

**OR** if loading for the first time:
1. Click **"Load unpacked"**
2. Select the `extension/dist` folder

---

## Testing the Deployment

### Test 1: Health Check (Already Done)

You verified this in Step 6.1.

### Test 2: Authentication Flow

1. Click the Silence Notes extension icon
2. Click **"Sign in with Google"**
3. Authorize the extension
4. You should be redirected back and see your profile

**If this fails:**
- Check the Cloud Run logs
- Verify your Google OAuth credentials in GCP Console

### Test 3: Create a Note

1. Click the **"New Note"** button
2. Type some content
3. Click **"Save"**
4. The note should appear in your list

### Test 4: Check Database

Verify the note was saved to the database:

1. Go to: https://console.cloud.google.com/sql
2. Click on your database instance
3. Click **"Databases"** tab
4. Click **"Web preview"** (eye icon)
5. Run: `SELECT * FROM notes LIMIT 5;`

---

## Managing Your Deployment

### Running Database Migrations

The deployment script automatically runs migrations during initial deployment. However, if you need to run migrations manually:

#### Using gcloud sql connect

```bash
# Connect to your database
gcloud sql connect my-notes-db --user=postgres --region=us-central1

# You'll be in a psql session. Run migration SQL:
# (See backend/migrations/ directory for SQL files)
```

#### After Schema Changes

If you modify the database schema (add new migrations):

```bash
# Re-run the deployment script
./deploy_gcp.sh

# The script will automatically apply pending migrations
```

**Important:** The deployment script tracks applied migrations in the `schema_migrations` table. Only new migrations will be applied.

### Viewing Logs

**Real-time logs:**
```bash
gcloud run services logs tail my-notes-api --follow
```

**Recent logs:**
```bash
gcloud run services logs tail my-notes-api --limit=50
```

**In Console:**
1. Go to: https://console.cloud.google.com/run
2. Click your service
3. Click **"Logs"** tab

### Updating Your Code

When you make changes to the backend:

1. Make your code changes
2. Run the deployment script again:
   ```bash
   ./deploy_gcp.sh
   ```

The script will:
- Rebuild the Docker image
- Push the new image
- Deploy to Cloud Run
- Create a new revision
- Gradually shift traffic to the new version

### Rolling Back

If something goes wrong:

```bash
# List revisions
gcloud run revisions list --service=my-notes-api

# Rollback to a specific revision
gcloud run services update-traffic my-notes-api \
  --to-revisions=REVISION_NAME=100
```

### Scaling

Cloud Run automatically scales, but you can set limits:

```bash
# Set minimum instances (keeps service warm)
gcloud run services update my-notes-api --min-instances=1

# Set maximum instances (limit cost)
gcloud run services update my-notes-api --max-instances=10

# Set memory per instance
gcloud run services update my-notes-api --memory=512Mi
```

---

## Troubleshooting

### Problem: "gcloud: command not found"

**Solution:** gcloud CLI is not installed or not in PATH.

1. Verify installation: `which gcloud`
2. Reinstall: https://cloud.google.com/sdk/docs/install
3. Restart your terminal

### Problem: "Permission denied"

**Solution:** Make the script executable.

```bash
chmod +x deploy_gcp.sh
```

### Problem: "API not enabled"

**Solution:** Enable the required APIs manually.

```bash
gcloud services enable \
    run.googleapis.com \
    sqladmin.googleapis.com \
    artifactregistry.googleapis.com \
    cloudbuild.googleapis.com
```

### Problem: "Database connection failed"

**Possible causes:**

1. **Wrong password** - Check your `DB_PASSWORD` in the script
2. **Database still creating** - Wait a few more minutes
3. **Wrong connection name** - Verify in GCP Console

**Solution:**

```bash
# Check database status
gcloud sql instances describe my-notes-db

# Reset password
gcloud sql users set-password postgres \
  --instance=my-notes-db \
  --password="YOUR_PASSWORD"
```

### Problem: "Container failed to start"

**Check logs:**
```bash
gcloud run services logs tail my-notes-api --limit=100
```

**Common causes:**
1. Missing environment variables
2. Database not reachable
3. Port not set correctly (must be 8080)

### Problem: "Health check failing"

**Debug:**

```bash
# Check if service is running
gcloud run services describe my-notes-api

# Get service URL
SERVICE_URL=$(gcloud run services describe my-notes-api --format="value(status.url)")

# Test manually
curl $SERVICE_URL/api/v1/health
```

### Problem: "relation \"users\" does not exist"

**Solution:** Database migrations haven't been run.

```bash
# Option 1: Re-run deployment script (recommended)
./deploy_gcp.sh

# Option 2: Run migrations manually
gcloud sql connect my-notes-db --user=postgres --region=us-central1

# In the psql session, run:
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    google_id VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- (repeat for other tables - see backend/migrations/)
```

### Problem: "High latency"

**Solutions:**

1. **Enable min instances** (prevents cold starts):
   ```bash
   gcloud run services update my-notes-api --min-instances=1
   ```

2. **Choose a closer region** (redeploy)

3. **Use connection pooling** (advanced)

---

## Cost Management

### Understanding Your Costs

| Service | Tier | Monthly Cost |
|---------|------|--------------|
| Cloud Run | Free tier covers 2M requests | $0-3 |
| Cloud SQL | db-f1-micro | ~$8-10 |
| Storage | Artifact Registry (~50MB) | ~$0.10 |
| **Total** | | **~$8-13/month** |

### Setting Up Budget Alerts

1. Go to: https://console.cloud.google.com/billing
2. Click your billing account
3. Click **"Budgets & alerts"**
4. Click **"Create Budget"**
5. Set:
   - **Budget amount**: $20 (or your preference)
   - **Alert threshold**: 50%, 80%, 100%
6. Click **"Create"**

You'll get email alerts when approaching your budget.

### Cost Optimization Tips

**To reduce costs:**

1. **Set min instances to 0** (scales to zero when unused):
   ```bash
   gcloud run services update my-notes-api --min-instances=0
   ```

2. **Limit max instances** (prevent runaway costs):
   ```bash
   gcloud run services update my-notes-api --max-instances=10
   ```

3. **Use smaller database tier** (if low traffic):
   ```bash
   # Not recommended unless usage is very low
   # db-f1-micro is already the smallest
   ```

### Monitoring Costs

**Check current spending:**
```bash
gcloud billing accounts describe
```

**View cost breakdown:**
1. Go to: https://console.cloud.google.com/billing
2. Click **"Reports"**
3. View by service, region, or time

---

## Security Best Practices

### 1. Don't Commit Secrets

The `.gitignore` file already excludes:
- `deploy_gcp.sh` (your actual script)
- `backend/.env.production` (production env vars)

**Always use the template files (`*.template`) for Git.**

### 2. Use Strong Passwords

Generate strong passwords:
```bash
# Database password
openssl rand -base64 24

# JWT secret
openssl rand -base64 42
```

### 3. Enable HTTPS Only

Cloud Run automatically:
- Issues SSL certificates
- Redirects HTTP to HTTPS
- Handles certificate renewal

**Never** use HTTP endpoints.

### 4. Restrict API Access (Optional)

By default, your API is public. To restrict:

```bash
# Remove public access
gcloud run services update my-notes-api \
  --no-allow-unauthenticated

# Add specific users/service accounts
gcloud run services add-iam-policy-binding my-notes-api \
  --member=user:example@gmail.com \
  --role=roles/run.invoker
```

### 5. Regular Security Updates

- Keep dependencies updated
- Monitor security bulletins
- Review GCP Security recommendations

### 6. Backup Your Database

Cloud SQL automatically backs up daily. To restore:

```bash
# List backups
gcloud sql backups list --instance=my-notes-db

# Restore from backup
gcloud sql backups restore BACKUP_ID \
  --instance=my-notes-db \
  --restore-instance=my-notes-db-restore
```

---

## Quick Reference

### Essential Commands

```bash
# Deploy
./deploy_gcp.sh

# View logs
gcloud run services logs tail my-notes-api --follow

# Get service URL
gcloud run services describe my-notes-api --format="value(status.url)"

# Check database
gcloud sql instances describe my-notes-db

# List revisions
gcloud run revisions list --service=my-notes-api

# Set scaling
gcloud run services update my-notes-api --min-instances=0 --max-instances=10
```

### Important Links

| What | Link |
|------|------|
| Cloud Console | https://console.cloud.google.com |
| Cloud Run | https://console.cloud.google.com/run |
| Cloud SQL | https://console.cloud.google.com/sql |
| Artifact Registry | https://console.cloud.google.com/artifacts |
| Billing | https://console.cloud.google.com/billing |

### File Locations

| File | Purpose |
|------|---------|
| `deploy_gcp.sh.template` | Deployment script template |
| `backend/.env.production.template` | Environment variables template |
| `extension/src/utils/config.ts` | Extension API config |
| `extension/src/api.ts` | Extension API service |
| `backend/Dockerfile` | Backend container definition |

---

## Getting Help

### Documentation

- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Cloud SQL Documentation](https://cloud.google.com/sql/docs)
- [gcloud CLI Reference](https://cloud.google.com/sdk/gcloud)

### Community

- [Stack Overflow - Google Cloud](https://stackoverflow.com/questions/tagged/google-cloud-platform)
- [Google Cloud Community](https://cloud.google.com/community)

### Support

- [GCP Support](https://cloud.google.com/support)
- [Contact Us](https://cloud.google.com/contact)

---

## Checklist

Before deploying, ensure you've:

- [ ] Created a GCP project
- [ ] Enabled billing
- [ ] Installed gcloud CLI
- [ ] Logged in with `gcloud auth login`
- [ ] Copied and customized `deploy_gcp.sh`
- [ ] Set strong passwords
- [ ] Run the deployment script (includes migrations)
- [ ] Verified database migrations completed
- [ ] Tested the health endpoint
- [ ] Updated extension configuration files
- [ ] Rebuilt the extension
- [ ] Loaded the extension in Chrome
- [ ] Tested authentication
- [ ] Created a test note
- [ ] Set up budget alerts

---

**Congratulations!** You've successfully deployed Silence Notes to Google Cloud Platform. 🎉
