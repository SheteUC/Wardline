#!/bin/bash

# Wardline Deployment Script
# Usage: ./scripts/deploy.sh [staging|production]

set -e

ENVIRONMENT=${1:-staging}
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="deploy_${ENVIRONMENT}_${TIMESTAMP}.log"

echo "======================================"
echo "Wardline Deployment Script"
echo "Environment: $ENVIRONMENT"
echo "Timestamp: $TIMESTAMP"
echo "======================================"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
    exit 1
}

warn() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

# Check environment
if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
    error "Invalid environment. Use 'staging' or 'production'"
fi

# Confirmation for production
if [[ "$ENVIRONMENT" == "production" ]]; then
    read -p "Are you sure you want to deploy to PRODUCTION? (yes/no): " confirm
    if [[ "$confirm" != "yes" ]]; then
        error "Production deployment cancelled"
    fi
fi

log "Step 1: Running pre-deployment checks..."

# Check if required tools are installed
command -v docker >/dev/null 2>&1 || error "Docker is not installed"
command -v aws >/dev/null 2>&1 || error "AWS CLI is not installed"
command -v pnpm >/dev/null 2>&1 || error "pnpm is not installed"

log "✓ All required tools are installed"

# Check AWS credentials
aws sts get-caller-identity >/dev/null 2>&1 || error "AWS credentials not configured"
log "✓ AWS credentials verified"

log "Step 2: Running tests..."

# Run Python tests
log "Running Python unit tests..."
cd apps/voice-orchestrator-pipecat
pytest --cov --cov-report=term-missing || error "Python tests failed"
cd ../..
log "✓ Python tests passed"

# Run NestJS tests
log "Running NestJS tests..."
cd apps/core-api
pnpm test || error "NestJS tests failed"
cd ../..
log "✓ NestJS tests passed"

# Run React tests
log "Running React tests..."
cd apps/web
pnpm test || error "React tests failed"
cd ../..
log "✓ React tests passed"

log "Step 3: Security scan..."

# Run npm audit
npm audit --audit-level=moderate || warn "Security vulnerabilities detected"

log "Step 4: Building application..."

# Build all packages
pnpm build || error "Build failed"
log "✓ Build completed successfully"

log "Step 5: Building Docker images..."

# Get AWS ECR registry
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=${AWS_REGION:-us-east-1}
ECR_REGISTRY="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"
IMAGE_TAG="$ENVIRONMENT-$TIMESTAMP"

# Login to ECR
log "Logging in to Amazon ECR..."
aws ecr get-login-password --region $AWS_REGION | \
    docker login --username AWS --password-stdin $ECR_REGISTRY || error "ECR login failed"

# Build Voice Orchestrator
log "Building Voice Orchestrator image..."
docker build -t $ECR_REGISTRY/wardline-voice:$IMAGE_TAG \
    -f apps/voice-orchestrator-pipecat/Dockerfile . || error "Voice Orchestrator build failed"

docker tag $ECR_REGISTRY/wardline-voice:$IMAGE_TAG \
    $ECR_REGISTRY/wardline-voice:$ENVIRONMENT-latest

# Build Core API
log "Building Core API image..."
docker build -t $ECR_REGISTRY/wardline-api:$IMAGE_TAG \
    -f apps/core-api/Dockerfile . || error "Core API build failed"

docker tag $ECR_REGISTRY/wardline-api:$IMAGE_TAG \
    $ECR_REGISTRY/wardline-api:$ENVIRONMENT-latest

log "✓ Docker images built successfully"

log "Step 6: Pushing images to ECR..."

docker push $ECR_REGISTRY/wardline-voice:$IMAGE_TAG || error "Voice push failed"
docker push $ECR_REGISTRY/wardline-voice:$ENVIRONMENT-latest

docker push $ECR_REGISTRY/wardline-api:$IMAGE_TAG || error "API push failed"
docker push $ECR_REGISTRY/wardline-api:$ENVIRONMENT-latest

log "✓ Images pushed to ECR"

log "Step 7: Running database migrations..."

# Run Prisma migrations
cd apps/core-api
if [[ "$ENVIRONMENT" == "production" ]]; then
    DATABASE_URL=$PROD_DATABASE_URL pnpm prisma migrate deploy || error "Migration failed"
else
    DATABASE_URL=$STAGING_DATABASE_URL pnpm prisma migrate deploy || error "Migration failed"
fi
cd ../..

log "✓ Database migrations completed"

log "Step 8: Deploying to ECS..."

# Update ECS services
CLUSTER="wardline-$ENVIRONMENT"

log "Updating Voice Orchestrator service..."
aws ecs update-service \
    --cluster $CLUSTER \
    --service voice-orchestrator \
    --force-new-deployment \
    --region $AWS_REGION || error "Voice Orchestrator deployment failed"

log "Updating Core API service..."
aws ecs update-service \
    --cluster $CLUSTER \
    --service core-api \
    --force-new-deployment \
    --region $AWS_REGION || error "Core API deployment failed"

log "Waiting for services to stabilize..."
aws ecs wait services-stable \
    --cluster $CLUSTER \
    --services voice-orchestrator core-api \
    --region $AWS_REGION || error "Services failed to stabilize"

log "✓ ECS services deployed"

log "Step 9: Deploying Web Dashboard to Vercel..."

cd apps/web

if [[ "$ENVIRONMENT" == "production" ]]; then
    vercel --prod --token $VERCEL_TOKEN || error "Vercel deployment failed"
else
    vercel --token $VERCEL_TOKEN || error "Vercel deployment failed"
fi

cd ../..

log "✓ Web dashboard deployed"

log "Step 10: Running smoke tests..."

# Wait for services to be fully ready
sleep 30

# Health check - Core API
API_URL="https://api-$ENVIRONMENT.wardline.com"
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" $API_URL/health)
if [[ "$HTTP_STATUS" == "200" ]]; then
    log "✓ Core API health check passed"
else
    error "Core API health check failed (HTTP $HTTP_STATUS)"
fi

# Health check - Voice Orchestrator
VOICE_URL="https://voice-$ENVIRONMENT.wardline.com"
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" $VOICE_URL/health)
if [[ "$HTTP_STATUS" == "200" ]]; then
    log "✓ Voice Orchestrator health check passed"
else
    error "Voice Orchestrator health check failed (HTTP $HTTP_STATUS)"
fi

log "Step 11: Creating deployment tag..."

# Tag the deployment
git tag "deploy-$ENVIRONMENT-$TIMESTAMP"
git push origin "deploy-$ENVIRONMENT-$TIMESTAMP"

log "✓ Deployment tagged: deploy-$ENVIRONMENT-$TIMESTAMP"

# Summary
echo ""
echo "======================================"
echo -e "${GREEN}✓ Deployment Completed Successfully!${NC}"
echo "======================================"
echo "Environment: $ENVIRONMENT"
echo "Image Tag: $IMAGE_TAG"
echo "Git Tag: deploy-$ENVIRONMENT-$TIMESTAMP"
echo "API URL: $API_URL"
echo "Voice URL: $VOICE_URL"
echo "Web URL: https://$([[ "$ENVIRONMENT" == "production" ]] && echo "app" || echo "$ENVIRONMENT").wardline.com"
echo "Log File: $LOG_FILE"
echo "======================================"

# Send notification (optional - requires Slack webhook)
if [[ -n "$SLACK_WEBHOOK" ]]; then
    curl -X POST $SLACK_WEBHOOK \
        -H 'Content-Type: application/json' \
        -d "{\"text\":\"✅ Wardline $ENVIRONMENT deployment successful!\nTag: $IMAGE_TAG\"}"
fi

exit 0
