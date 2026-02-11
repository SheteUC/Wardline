# Wardline Quick Start Guide 🚀

## Start the Full Platform (5 minutes)

### Prerequisites
```bash
# Required:
- Node.js 20+
- Python 3.11+
- Docker & Docker Compose
- pnpm (npm install -g pnpm)
```

### 1. Clone & Install (First Time Only)
```bash
cd C:\Users\Athar\Downloads\Wardline

# Install all dependencies
pnpm install

# Setup Python environment
cd apps/voice-orchestrator-pipecat
python -m venv venv
.\venv\Scripts\activate  # Windows
pip install -r requirements.txt
cd ../..
```

### 2. Start Infrastructure
```bash
# Terminal 1: Start Postgres + Redis
docker-compose up postgres redis

# Wait for "database system is ready to accept connections"
```

### 3. Setup Database
```bash
# Terminal 2: Run migrations (first time only)
cd apps/core-api
cp .env.example .env  # Edit with your Clerk keys
pnpm prisma generate
pnpm prisma migrate dev
```

### 4. Start Core API (NestJS Backend)
```bash
# Still in apps/core-api
pnpm start:dev

# Should see: "Nest application successfully started"
# Listening on: http://localhost:3001
```

### 5. Start Web Dashboard (Next.js)
```bash
# Terminal 3
cd apps/web
cp .env.example .env.local  # Edit with your Clerk keys
pnpm dev

# Should see: "Ready on http://localhost:3000"
```

### 6. (Optional) Start Voice Orchestrator
```bash
# Terminal 4
cd apps/voice-orchestrator-pipecat
.\venv\Scripts\activate
python server.py

# Should see: "Voice Orchestrator running on port 3002"
```

## Test the Integration ✅

### Open your browser:
```
http://localhost:3000
```

1. **Landing Page** - Should show workflow builder showcase
2. **Click "Start Building"** → Sign up with Clerk
3. **Dashboard** → Navigate to "Workflows"
4. **Workflows Page** → Should show:
   - Either real workflows from API
   - Or fallback mock data with warning banner
5. **Click "Create Workflow"** → Opens visual editor with 7 node types

## Environment Variables

### Core API (`apps/core-api/.env`)
```bash
DATABASE_URL="postgresql://wardline:wardline@localhost:5432/wardline"
REDIS_HOST="localhost"
REDIS_PORT=6379
CLERK_SECRET_KEY="sk_test_..." # Get from dashboard.clerk.com
JWT_SECRET="your-random-secret-key"
PORT=3001
```

### Web App (`apps/web/.env.local`)
```bash
NEXT_PUBLIC_API_BASE_URL="http://localhost:3001"
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..." # Get from dashboard.clerk.com
CLERK_SECRET_KEY="sk_test_..." # Same as Core API
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/sign-in"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/sign-up"
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL="/dashboard"
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL="/dashboard"
```

### Voice Orchestrator (`apps/voice-orchestrator-pipecat/.env`)
```bash
CORE_API_URL="http://localhost:3001"
AZURE_SPEECH_KEY="your-key"
AZURE_SPEECH_REGION="eastus"
AZURE_OPENAI_KEY="your-key"
AZURE_OPENAI_ENDPOINT="https://your-resource.openai.azure.com/"
TWILIO_ACCOUNT_SID="your-sid"
TWILIO_AUTH_TOKEN="your-token"
```

## Troubleshooting

### Port Already in Use
```bash
# Find and kill process
netstat -ano | findstr :3001  # Windows
lsof -ti:3001 | xargs kill    # Mac/Linux
```

### Database Connection Failed
```bash
# Restart Docker containers
docker-compose down
docker-compose up postgres redis
```

### Clerk Authentication Error
- Verify keys match in both `.env` files
- Check keys are active at https://dashboard.clerk.com
- Clear browser cookies and retry

### Workflows Not Loading
- Check Core API is running (`http://localhost:3001/health`)
- Check browser console for errors
- Verify `NEXT_PUBLIC_API_BASE_URL` is set correctly
- Fallback to mock data should display with warning banner

## Production Deployment

### Using Docker
```bash
# Build and start all services
docker-compose up --build

# Or deploy individually
./scripts/deploy.sh staging
```

### Using Vercel + AWS
```bash
# Deploy Web App to Vercel
cd apps/web
vercel deploy --prod

# Deploy API to AWS ECS
./scripts/deploy.sh production
```

## Key URLs

- **Landing Page**: http://localhost:3000
- **Dashboard**: http://localhost:3000/dashboard
- **Workflows**: http://localhost:3000/dashboard/workflows
- **Core API**: http://localhost:3001
- **API Health**: http://localhost:3001/health
- **API Docs**: http://localhost:3001/api
- **Voice Orchestrator**: http://localhost:3002

## Architecture

```
┌──────────────────────────────────────────────────┐
│  Web Dashboard (Next.js) - Port 3000            │
│  - Landing page with workflow showcase           │
│  - Visual workflow editor (ReactFlow)            │
│  - 7 custom node types with config panels        │
└───────────────────┬──────────────────────────────┘
                    │ HTTP + WebSocket
                    ↓
┌──────────────────────────────────────────────────┐
│  Core API (NestJS) - Port 3001                  │
│  - Workflow CRUD & validation                    │
│  - Hospital configuration                        │
│  - Queue management & escalation                 │
│  - Safety event logging                          │
└───────────────────┬──────────────────────────────┘
                    │
        ┌───────────┴───────────┐
        ↓                       ↓
┌──────────────────┐   ┌──────────────────┐
│  PostgreSQL      │   │  Redis Cache     │
│  Port 5432       │   │  Port 6379       │
└──────────────────┘   └──────────────────┘

┌──────────────────────────────────────────────────┐
│  Voice Orchestrator (Python) - Port 3002        │
│  - Pipecat voice AI runtime                      │
│  - Dynamic workflow execution                    │
│  - Real-time safety monitoring                   │
│  - LangSmith tracing                             │
└──────────────────────────────────────────────────┘
```

## Next Steps

1. ✅ **Verify Integration** - Follow `TEST_INTEGRATION.md`
2. ✅ **Create Test Workflows** - Use visual editor
3. ✅ **Configure Hospital Settings** - `/dashboard/settings/workflows`
4. ✅ **Setup Phone Numbers** - Twilio configuration
5. ✅ **Deploy to Staging** - `./scripts/deploy.sh staging`

## Support

- 📖 Full Documentation: `README.md`
- 🔒 Security Checklist: `tests/security/SECURITY_AUDIT_CHECKLIST.md`
- 🧪 Integration Tests: `TEST_INTEGRATION.md`
- 🔌 API Integration: `FRONTEND_BACKEND_INTEGRATION.md`
- 🗑️ Cleanup Report: `CLEANUP_SUMMARY.txt`

---

**Ready to Build!** 🎉

Your Wardline platform is now running locally. Sign up, create workflows, and start transforming patient experiences.
