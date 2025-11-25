# Frontend-Backend Integration Testing Guide

This guide helps you test the frontend-backend integration.

## Prerequisites

1. **Database Running**
   - PostgreSQL must be accessible
   - Database URL configured in `.env`

2. **Services Started**

Open 3 terminal windows:

### Terminal 1: Core API
```bash
cd apps/core-api
pnpm dev
```
Should see: `🚀 Core API is running on: http://localhost:3001`

### Terminal 2: Voice Orchestrator
```bash
cd apps/voice-orchestrator
pnpm dev
```
Should see: `🚀 Voice Orchestrator running on port 3002`

### Terminal 3: Web App
```bash
cd apps/web
pnpm dev
```
Should see: `Ready on http://localhost:3000`

## Testing Steps

### 1. Health Checks

Verify all services are running:

```bash
# Core API health
curl http://localhost:3001/health

# Voice Orchestrator health
curl http://localhost:3002/health
```

### 2. Test Dashboard

1. Open http://localhost:3000
2. Sign in with Clerk
3. Navigate to dashboard

**Expected Behavior:**
- Dashboard loads with loading skeletons first
- Metrics populate from API or show "0" if no data
- Charts render (may be empty if no calls yet)
- Recent calls table appears (may show "No recent calls")
- No console errors related to API

### 3. Test API Calls

Open browser DevTools (F12) → Network tab:

1. Refresh dashboard
2. Look for requests to:
   - `/hospitals/{id}/calls` - Recent calls
   - `/hospitals/{id}/calls/analytics` - Analytics data

**Verify:**
- Requests have `Authorization: Bearer <token>` header
- Status codes are 200 (or 404 if no data)
- Response contains JSON data

### 4. Set Hospital ID

If you see errors about "No hospital selected":

**Option A: Use localStorage (Quick Test)**
```javascript
// In browser console:
localStorage.setItem('selectedHospitalId', 'YOUR_HOSPITAL_UUID_HERE');
// Reload page
```

**Option B: Create Test Hospital**
```bash
# Use Prisma Studio
cd packages/db
pnpm studio
# Create a hospital record and copy its ID
```

**Option C: Set in Clerk User Metadata**
- Go to Clerk Dashboard
- Find your test user
- Add public metadata: `{ "defaultHospitalId": "YOUR_HOSPITAL_UUID" }`

### 5. Test WebSocket Connection

1. Keep dashboard open
2. Open DevTools → Network → WS (WebSocket)
3. Look for connection to `ws://localhost:3002`

**Expected:**
- Connection established
- No errors in console
- Connection indicator can be added to UI later

### 6. Test Real-Time Updates

If you have the voice orchestrator running:

1. Trigger a test call (if Twilio is configured)
2. Dashboard should automatically refresh
3. New call should appear in recent calls

## Common Issues

### "No hospital selected" Error

**Fix:** Set hospital ID using one of the methods in Step 4

### API Returns 401 Unauthorized

**Possible Causes:**
- Clerk JWT not configured properly in core-api
- User not signed in
- Token expired

**Check:**
- Verify `CLERK_SECRET_KEY` in core-api `.env`
- Check browser console for authentication errors

### WebSocket Won't Connect

**Possible Causes:**
- Voice orchestrator not running
- Wrong URL in env config

**Fix:**
- Verify voice orchestrator is running on port 3002
- Check `NEXT_PUBLIC_VOICE_ORCHESTRATOR_URL` in web `.env.local`

### TypeScript Errors

**Run type check:**
```bash
cd apps/web
pnpm type-check
```

### Build Fails

**Run build:**
```bash
cd apps/web
pnpm build
```

## Next Steps After Testing

1. **Update Other Pages**
   - Calls list page with filters
   - Analytics page with date range
   - Workflows page with CRUD operations
   - Team page with member management

2. **Add Hospital Selector**
   - Create hospital selector component
   - Allow users to switch between hospitals

3. **Error Boundaries**
   - Add error boundaries for better error handling
   - Show user-friendly error messages

4. **Loading Improvements**
   - Better skeleton loaders
   - Progress indicators
   - Optimistic updates

5. **Real-Time Enhancements**
   - Live call status indicator
   - Toast notifications for new calls
   - Sound alerts for emergencies
