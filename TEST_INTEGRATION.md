# Frontend-Backend Integration Test

## Test Checklist

### Prerequisites
- [ ] Core API running on `http://localhost:3001`
- [ ] Web app running on `http://localhost:3000`
- [ ] PostgreSQL database running
- [ ] Redis running
- [ ] Environment variables configured

### 1. Landing Page Tests
```bash
# Open browser to http://localhost:3000
```
- [ ] Landing page loads without errors
- [ ] "Build Intelligent Call Workflows Visually" headline displays
- [ ] Workflow showcase section with node cards displays
- [ ] "Start Building" button links to `/sign-up`
- [ ] "Explore Features" button links to `/features`
- [ ] Stats show: <200ms, 100%, 24/7, 7 Node Types

### 2. Authentication Tests
```bash
# Test sign-up flow
```
- [ ] Navigate to `/sign-up`
- [ ] Clerk sign-up form loads
- [ ] Can create new account
- [ ] Redirects to `/dashboard` after sign-up

### 3. Dashboard Tests
```bash
# Login and navigate to /dashboard
```
- [ ] Dashboard loads without errors
- [ ] Navigation sidebar shows:
  - Operations (Dashboard, Calls, Analytics)
  - Workflow System (Workflows, AI Agents, Queues, Team)
  - Settings (General, Workflow Config, Integrations, Security)
- [ ] NO links to: Patient Portal, Departments, Prescriptions, Insurance, Events, Billing, Appointments
- [ ] User profile button displays in header

### 4. Workflows Page Tests
```bash
# Navigate to /dashboard/workflows
```
- [ ] Workflows list page loads
- [ ] "Create Workflow" button displays
- [ ] Either:
  - Workflows from backend API display, OR
  - Fallback mock data displays with warning banner
- [ ] Each workflow card shows:
  - Name, description, status badge
  - Edit and Test buttons
  - Version, node count, last modified date

### 5. Workflow Editor Tests
```bash
# Click "Edit" on a workflow or "Create Workflow"
```
- [ ] Navigate to `/dashboard/workflows/[id]`
- [ ] EnhancedWorkflowEditor component loads
- [ ] ReactFlow canvas displays
- [ ] Node palette sidebar shows 7 node types:
  - AI Agent
  - Human Queue
  - Conditional
  - Safety Check
  - Integration
  - End Node
  - (Start node implicit)
- [ ] Can drag nodes onto canvas
- [ ] Can connect nodes with edges
- [ ] Node configuration panels appear when node selected

### 6. API Integration Tests
```bash
# Test API connectivity
curl -X GET http://localhost:3001/api/health

# Test workflows endpoint (with auth token)
curl -X GET "http://localhost:3001/api/workflows?hospitalId=test-hospital" \
  -H "Authorization: Bearer YOUR_TOKEN"
```
- [ ] Health endpoint returns 200 OK
- [ ] Workflows endpoint returns workflow data or 401 (auth required)
- [ ] Network tab shows API calls to `http://localhost:3001`
- [ ] Console shows no CORS errors

### 7. Settings Page Tests
```bash
# Navigate to /dashboard/settings/workflows
```
- [ ] Workflow settings page loads
- [ ] Hospital-level configuration options display
- [ ] Can configure modules, prompts, escalation rules

## Quick Start Commands

### Start All Services
```bash
# Terminal 1: Start PostgreSQL + Redis
docker-compose up postgres redis

# Terminal 2: Start Core API
cd apps/core-api
pnpm install
pnpm prisma generate
pnpm prisma migrate dev
pnpm start:dev

# Terminal 3: Start Web App
cd apps/web
pnpm install
pnpm dev
```

### Environment Setup
```bash
# Core API (.env)
DATABASE_URL="postgresql://wardline:wardline@localhost:5432/wardline"
REDIS_HOST="localhost"
REDIS_PORT=6379
CLERK_SECRET_KEY="sk_test_..."
JWT_SECRET="your-secret-key"

# Web App (.env.local)
NEXT_PUBLIC_API_BASE_URL="http://localhost:3001"
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."
```

## Expected Results

✅ **PASS**: All services start, pages load, workflows display (API or fallback), editor functional
❌ **FAIL**: 500 errors, blank pages, CORS errors, missing components

## Troubleshooting

### CORS Errors
- Check Core API has CORS enabled for `http://localhost:3000`
- Verify `NEXT_PUBLIC_API_BASE_URL` in web `.env.local`

### 401 Unauthorized
- Verify Clerk keys match in both apps
- Check token is being sent in Authorization header
- Verify backend JWT validation

### Workflows Not Loading
- Check Core API logs for errors
- Verify database connection
- Check hospital_id exists in database
- Fallback to mock data should display

### Components Not Rendering
- Check browser console for React errors
- Verify all dependencies installed (`pnpm install`)
- Check for TypeScript errors (`pnpm typecheck`)

## Success Criteria

Integration test passes when:
1. ✅ Landing page loads with workflow showcase
2. ✅ Authentication works (Clerk)
3. ✅ Dashboard navigation cleaned up (no deleted pages)
4. ✅ Workflows page connects to API OR shows fallback data
5. ✅ Workflow editor loads with all 7 node types
6. ✅ Configuration panels functional
7. ✅ No console errors or warnings
8. ✅ All deleted pages return 404

Last Updated: February 10, 2026
