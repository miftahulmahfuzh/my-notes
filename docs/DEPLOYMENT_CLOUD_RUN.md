# GCP Deployment Guide - Cloud Run + Cloud SQL

Complete guide to deploy Silence Notes backend to Google Cloud Platform using Cloud Run and Cloud SQL.

## Prerequisites

- Google Cloud account with billing enabled
- [gcloud CLI](https://cloud.google.com/sdk/docs/install) installed
- Docker installed (for local testing)

## Cost Estimate

| Service | Tier | Monthly Cost |
|---------|------|--------------|
| Cloud Run | Pay-per-use | $0-3 (free tier covers 2M requests) |
| Cloud SQL | db-f1-micro | ~$8-10 |
| **Total** | | **~$8-13/month** |

---

## Part 1: Initial Setup

### 1.1 Install and Initialize gcloud CLI

```bash
# Install gcloud CLI (if not already installed)
# macOS
brew install google-cloud-sdk

# Linux
curl https://sdk.cloud.google.com | bash

# Initialize and login
gcloud init

# Login to your Google account
gcloud auth login
```

### 1.2 Set Your Project and Region

```bash
# Set your project (replace with your project ID)
export PROJECT_ID="your-project-id"
gcloud config set project $PROJECT_ID

# Set your region (choose one close to your users)
export REGION="us-central1"
gcloud config set run/region $REGION
gcloud config set compute/region $REGION
```

### 1.3 Enable Required APIs

```bash
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com
```

---

## Part 2: Create Cloud SQL Database

### 2.1 Create PostgreSQL Instance

```bash
# Create a Cloud SQL instance (this takes 5-10 minutes)
gcloud sql instances create my-notes-db \
  --tier=db-f1-micro \
  --database-version=POSTGRES_15 \
  --region=$REGION \
  --storage-auto-increase \
  --storage-size=10GB \
  --cpu=1 \
  --memory=384MiB \
  --database-flags=cloudsql.iam_authentication=off
```

**Expected output:**
```
Creating Cloud SQL instance...done.
Created [https://console.cloud.google.com/sql/instances/...].
```

### 2.2 Set Root Password

```bash
# Set a strong password (store this securely!)
gcloud sql users set-password postgres \
  --instance=my-notes-db \
  --password="YOUR_STRONG_PASSWORD_HERE"
```

### 2.3 Create the Application Database

```bash
# Create the database
gcloud sql databases create notes_prod --instance=my-notes-db

# Verify database was created
gcloud sql databases list --instance=my-notes-db
```

### 2.4 Get Database Connection Info

```bash
# Get the instance connection name (needed for Cloud Run)
gcloud sql instances describe my-notes-db --format="value(connectionName)"

# Save this to a variable
export CLOUDSQL_CONNECTION_NAME=$(gcloud sql instances describe my-notes-db --format="value(connectionName)")
echo "Connection name: $CLOUDSQL_CONNECTION_NAME"
```

---

## Part 3: Configure IAM Authentication

### 3.1 Get Your Project Number

```bash
export PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")
echo "Project number: $PROJECT_NUMBER"
```

### 3.2 Create Cloud SQL Client Service Account (Optional)

For better security, you can use Cloud SQL's Cloud SQL Connector which handles authentication automatically.

```bash
# The Cloud SQL Auth Proxy connector will be used instead
# No additional service account needed
```

---

## Part 4: Build and Deploy to Cloud Run

### 4.1 Navigate to Backend Directory

```bash
cd /path/to/my-notes/backend
```

### 4.2 Test Docker Build Locally (Optional)

```bash
# Build the Docker image
docker build -t my-notes-api:test .

# Test locally (requires local PostgreSQL)
docker run -p 8080:8080 \
  -e DB_HOST=localhost \
  -e DB_PASSWORD=test \
  -e DB_NAME=notes_dev \
  -e JWT_SECRET=test-secret-key-for-development-only \
  my-notes-api:test
```

### 4.3 Deploy to Cloud Run

```bash
# Deploy directly from source (Cloud Build will build and push)
gcloud run deploy my-notes-api \
  --source=. \
  --platform=managed \
  --region=$REGION \
  --allow-unauthenticated \
  --set-cloudsql-instances=$CLOUDSQL_CONNECTION_NAME \
  --set-env-vars="DB_HOST=cloudsql,$CLOUDSQL_CONNECTION_NAME" \
  --set-env-vars="DB_PORT=5432" \
  --set-env-vars="DB_NAME=notes_prod" \
  --set-env-vars="DB_USER=postgres" \
  --set-env-vars="DB_PASSWORD=YOUR_STRONG_PASSWORD_HERE" \
  --set-env-vars="JWT_SECRET=GENERATE_A_STRONG_RANDOM_SECRET_HERE" \
  --set-env-vars="APP_ENV=production" \
  --set-env-vars="APP_DEBUG=false" \
  --set-env-vars="SERVER_PORT=8080"
```

**Expected output:**
```
Building and deploying...
Service [my-notes-api] revision [my-notes-api-xxx] has been deployed and is serving 100 percent of traffic.
Service URL: https://my-notes-api-xxxxx-xx.a.run.app
```

---

## Part 5: Configure Environment Variables

### 5.1 Generate a Secure JWT Secret

```bash
# Generate a 32+ character random string
openssl rand -base64 42
```

### 5.2 Update Environment Variables (if needed)

```bash
# Update the service with new env vars
gcloud run services update my-notes-api \
  --update-env-vars="JWT_SECRET=YOUR_GENERATED_SECRET"
```

---

## Part 6: Verify Deployment

### 6.1 Get Service URL

```bash
# Get the service URL
export SERVICE_URL=$(gcloud run services describe my-notes-api --format="value(status.url)")
echo "Service URL: $SERVICE_URL"
```

### 6.2 Test Health Endpoint

```bash
# Test the health check
curl $SERVICE_URL/api/v1/health

# Expected response: {"status":"ok"}
```

### 6.3 View Logs

```bash
# View recent logs
gcloud run services logs tail my-notes-api --follow

# Or view in console
gcloud logging tail "resource.type=cloud_run_revision AND resource.labels.service_name=my-notes-api"
```

---

## Part 7: Set Up Custom Domain (Optional)

### 7.1 Verify Domain Ownership

```bash
# Map a custom domain (e.g., api.yourdomain.com)
gcloud run domain-mappings create \
  --service=my-notes-api \
  --domain=api.yourdomain.com
```

### 7.2 Update DNS

Follow the instructions in the output to add DNS records.

---

## Part 8: Update Chrome Extension

### 8.1 Update Extension Configuration

In `extension/src/auth.ts` or your environment config:

```typescript
const API_BASE_URL = 'https://your-service-url.a.run.app';
// Or with custom domain:
const API_BASE_URL = 'https://api.yourdomain.com';
```

### 8.2 Rebuild Extension

```bash
cd extension
npm run build
```

---

## Part 9: Monitoring and Maintenance

### 9.1 View Cloud Run Metrics

```bash
# View service details
gcloud run services describe my-notes-api

# Check revisions
gcloud run revisions list --service=my-notes-api
```

### 9.2 Set Up Alerting (Optional)

Navigate to Cloud Monitoring in the GCP Console to set up alerts for:
- Error rate > 1%
- Latency > 1s
- Cloud SQL CPU > 80%

### 9.3 Database Backups

Cloud SQL automatically backs up daily. To restore:

```bash
# List backups
gcloud sql backups list --instance=my-notes-db

# Restore from backup
gcloud sql backups restore BACKUP_ID --instance=my-notes-db --restore-instance=my-notes-db-restore
```

---

## Part 10: CI/CD (Optional)

### 10.1 Create cloudbuild.yaml

Create `backend/cloudbuild.yaml`:

```yaml
steps:
  # Build the container image
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'us-central1-docker.pkg.dev/$PROJECT_ID/my-notes-repo/api:$COMMIT_SHA', '.']

  # Push to Artifact Registry
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'us-central1-docker.pkg.dev/$PROJECT_ID/my-notes-repo/api:$COMMIT_SHA']

  # Deploy to Cloud Run
  - name: 'gcr.io/cloud-builders/gcloud'
    args:
      - 'run'
      - 'deploy'
      - 'my-notes-api'
      - '--image=us-central1-docker.pkg.dev/$PROJECT_ID/my-notes-repo/api:$COMMIT_SHA'
      - '--platform=managed'
      - '--region=us-central1'
      - '--allow-unauthenticated'
```

### 10.2 Enable Auto-Deploy on Git Push

```bash
# Create a trigger
gcloud builds triggers create github \
  --name=my-notes-deploy \
  --repo-url=https://github.com/YOUR_USERNAME/my-notes \
  --branch-pattern=main \
  --build-config=backend/cloudbuild.yaml
```

---

## Troubleshooting

### Issue: Database Connection Failed

**Solution:**
```bash
# Verify Cloud SQL instance is running
gcloud sql instances describe my-notes-db

# Check the connection name
gcloud run services describe my-notes-api --format="value(spec.template.spec.containers[0].env)")
```

### Issue: 502 Bad Gateway

**Solution:** Check that your app is listening on the PORT env var (not hardcoded 8080).

### Issue: High Latency

**Solution:**
- Use Cloud SQL Auth Proxy or Unix socket connection
- Enable connection pooling (PgBouncer)

---

## Security Checklist

- [ ] Change default PostgreSQL password
- [ ] Use strong JWT secret (32+ chars)
- [ ] Enable Cloud SQL automatic backups
- [ ] Set up Cloud Armor for DDoS protection
- [ ] Use HTTPS only (enabled by default on Cloud Run)
- [ ] Restrict API access if needed (remove `--allow-unauthenticated`)
- [ ] Rotate secrets regularly
- [ ] Enable audit logging

---

## Cost Optimization Tips

1. **Use Cloud Run free tier** - 2M requests/month free
2. **Set min instances to 0** - scales to zero when not in use
3. **Use db-f1-micro** - smallest Cloud SQL tier
4. **Monitor usage** - set budget alerts

```bash
# Set min instances to 0 (cold starts on)
gcloud run services update my-notes-api --min-instances=0

# Set max instances to limit cost
gcloud run services update my-notes-api --max-instances=10
```

---

## Cleanup (if needed)

```bash
# Delete Cloud Run service
gcloud run services delete my-notes-api

# Delete Cloud SQL instance (WARNING: this deletes all data!)
gcloud sql instances delete my-notes-db

# Delete images from Artifact Registry
gcloud artifacts images delete us-central1-docker.pkg.dev/$PROJECT_ID/my-notes-repo/api:* --delete-all-versions
```

---

## Next Steps

1. Set up monitoring and alerting
2. Configure custom domain
3. Set up CI/CD pipeline
4. Add integration tests
5. Document API endpoints for consumers
