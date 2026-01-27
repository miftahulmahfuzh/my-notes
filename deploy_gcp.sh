#!/bin/bash
# Quick deployment script for Silence Notes backend to Cloud Run + Cloud SQL
# Usage: ./deploy_gcp.sh

set -e

echo "🚀 Silence Notes - Cloud Run + Cloud SQL Deployment Script"
echo "============================================================"

# Configuration
PROJECT_ID=${PROJECT_ID:-"your-project-id"}
REGION=${REGION:-"us-central1"}
DB_INSTANCE=${DB_INSTANCE:-"my-notes-db"}
DB_NAME=${DB_NAME:-"notes_prod"}
SERVICE_NAME=${SERVICE_NAME:-"my-notes-api"}

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Helper functions
print_step() {
    echo -e "\n${GREEN}▶ $1${NC}"
}

print_warning() {
    echo -e "\n${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "\n${RED}❌ $1${NC}"
}

# Pre-flight checks
print_step "Checking prerequisites..."

if ! command -v gcloud &> /dev/null; then
    print_error "gcloud CLI not found. Install from https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Set project
print_step "Setting project to: $PROJECT_ID"
gcloud config set project $PROJECT_ID

# Enable APIs
print_step "Enabling required APIs..."
gcloud services enable \
    run.googleapis.com \
    sqladmin.googleapis.com \
    artifactregistry.googleapis.com \
    cloudbuild.googleapis.com \
    --quiet

# Check if database exists
print_step "Checking for existing database..."
if gcloud sql instances describe $DB_INSTANCE --region=$REGION &> /dev/null; then
    print_warning "Database instance '$DB_INSTANCE' already exists. Skipping creation."
    CLOUDSQL_CONNECTION_NAME=$(gcloud sql instances describe $DB_INSTANCE --format="value(connectionName)")
else
    print_step "Creating Cloud SQL instance (this takes 5-10 minutes)..."
    gcloud sql instances create $DB_INSTANCE \
        --tier=db-f1-micro \
        --database-version=POSTGRES_15 \
        --region=$REGION \
        --storage-auto-increase \
        --storage-size=10GB \
        --cpu=1 \
        --memory=384MiB \
        --quiet

    # Get connection name
    CLOUDSQL_CONNECTION_NAME=$(gcloud sql instances describe $DB_INSTANCE --format="value(connectionName)")

    # Prompt for password
    print_warning "You need to set a database password."
    read -sp "Enter PostgreSQL password: " DB_PASSWORD
    echo

    # Set root password
    print_step "Setting database password..."
    gcloud sql users set-password postgres \
        --instance=$DB_INSTANCE \
        --password="$DB_PASSWORD" \
        --quiet

    # Create database
    print_step "Creating database '$DB_NAME'..."
    gcloud sql databases create $DB_NAME --instance=$DB_INSTANCE --quiet
fi

echo -e "${GREEN}✓ Database ready: $CLOUDSQL_CONNECTION_NAME${NC}"

# Prompt for JWT secret
print_warning "Generating JWT secret..."
if [ -z "$JWT_SECRET" ]; then
    JWT_SECRET=$(openssl rand -base64 42)
    echo "Generated JWT Secret: $JWT_SECRET"
    echo "Save this securely! You'll need it for future deployments."
fi

# Navigate to backend directory
BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/backend" && pwd)"
cd "$BACKEND_DIR"

# Deploy to Cloud Run
print_step "Deploying to Cloud Run..."
print_warning "Make sure you have these values ready:"
echo "  - DB_PASSWORD (if not set earlier)"
echo "  - JWT_SECRET (generated above)"
echo "  - GOOGLE_CLIENT_ID (from Google Cloud Console)"
echo "  - GOOGLE_CLIENT_SECRET (from Google Cloud Console)"
echo ""
read -p "Press Enter to continue after gathering credentials..."

gcloud run deploy $SERVICE_NAME \
    --source=. \
    --platform=managed \
    --region=$REGION \
    --allow-unauthenticated \
    --set-cloudsql-instances=$CLOUDSQL_CONNECTION_NAME \
    --set-env-vars="DB_HOST=cloudsql,$CLOUDSQL_CONNECTION_NAME" \
    --set-env-vars="DB_PORT=5432" \
    --set-env-vars="DB_NAME=$DB_NAME" \
    --set-env-vars="DB_USER=postgres" \
    --set-env-vars="DB_PASSWORD=$DB_PASSWORD" \
    --set-env-vars="JWT_SECRET=$JWT_SECRET" \
    --set-env-vars="APP_ENV=production" \
    --set-env-vars="APP_DEBUG=false" \
    --set-env-vars="SERVER_PORT=8080"

# Get service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region=$REGION --format="value(status.url)")

# Success message
echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✓ Deployment successful!${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
echo ""
echo "Service URL: $SERVICE_URL"
echo "Health check: curl $SERVICE_URL/api/v1/health"
echo ""
echo "Next steps:"
echo "  1. Test the deployment:"
echo "     curl $SERVICE_URL/api/v1/health"
echo ""
echo "  2. View logs:"
echo "     gcloud run services logs tail $SERVICE_NAME --follow"
echo ""
echo "  3. Update your extension with this API URL"
echo ""
echo -e "${YELLOW}⚠ Save these credentials securely:${NC}"
echo "  Connection Name: $CLOUDSQL_CONNECTION_NAME"
echo "  JWT Secret: $JWT_SECRET"
echo "  DB Password: [the password you set]"
echo ""
