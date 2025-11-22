# Run Tests Manually with Existing Users

## Prerequisites
You need to create at least one test user in Clerk Dashboard to get started.

## Phase 1: Authentication (Automated via curl/PowerShell)

```powershell
# Test 1: Public endpoint (webhook) - Should reject invalid signature
Invoke-WebRequest -Uri "http://localhost:3001/webhooks/clerk" -Method POST -ContentType "application/json" -Body '{"type":"test"}'
# Expected: 401 Unauthorized

# Test 2: Protected endpoint without token
Invoke-WebRequest -Uri "http://localhost:3001/hospitals"
# Expected: 401 Unauthorized with "No token provided"

# Test  3: Protected endpoint with invalid token
Invoke-WebRequest -Uri "http://localhost:3001/hospitals" -Headers @{"Authorization"="Bearer invalid_token"}
# Expected: 401 Unauthorized
```

## Phase 2: Manual Testing with Real Token

### Step 1: Get a JWT Token from Clerk

Option A - Use Clerk Dashboard:
1. Go to https://dashboard.clerk.com
2. Navigate to your application
3. Go to Users → Select/Create a user
4. Click "..."→ "Generate JWT"
5. Copy the token

Option B - Use Frontend (if you have it):
```javascript
import { useAuth } from '@clerk/nextjs';
const { getToken } = useAuth();
const token = await getToken();
console.log(token);
```

### Step 2: Test authenticated endpoints

```powershell
$token = "YOUR_JWT_TOKEN_HERE"
$headers = @{"Authorization"="Bearer $token"}

# Test: List hospitals
Invoke-WebRequest -Uri "http://localhost:3001/hospitals" -Headers $headers | ConvertFrom-Json

# Test: Create hospital
$body = @{
    name = "Test Hospital"
    slug = "test-hospital"
    primaryPhone = "+1234567890"
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:3001/hospitals" -Method POST -Headers $headers -ContentType "application/json" -Body $body | ConvertFrom-Json

# Save the hospital ID from response
$hospitalId = "HOSPITAL_ID_FROM_RESPONSE"

# Test: Get specific hospital
Invoke-WebRequest -Uri "http://localhost:3001/hospitals/$hospitalId" -Headers $headers | ConvertFrom-Json

# Test: Update hospital
$updateBody = @{
    name = "Updated Test Hospital"
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:3001/hospitals/$hospitalId" -Method PATCH -Headers $headers -ContentType "application/json" -Body $updateBody | ConvertFrom-Json
```

## Phase 3: Database Verification (Audit Logs)

Connect to your PostgreSQL database and run:

```sql
-- Check recent audit logs
SELECT 
    id,
    action,
    entity_type,
    entity_id,
    user_id,
    hospital_id,
    ip_address,
    user_agent,
    created_at
FROM audit_logs
ORDER BY created_at DESC
LIMIT 10;

-- Check for specific hospital creation audit
SELECT * FROM audit_logs
WHERE entity_type = 'hospital' AND action = 'CREATE'
ORDER BY created_at DESC
LIMIT 5;

-- Verify sensitive data redaction
SELECT metadata
FROM audit_logs
ORDER BY created_at DESC
LIMIT 5;
-- Check that password, token, secret fields show [REDACTED]

-- Check user synchronization from webhooks
SELECT id, clerk_user_id, email, full_name, created_at
FROM users
ORDER BY created_at DESC
LIMIT 10;
```

## Phase 4: Webhook Testing

### Step 1: Configure Clerk Webhook (if not  done)
1. Go to Clerk Dashboard → Webhooks
2. Add endpoint: `https://uncongratulating-zaid-obeyingly.ngrok-free.dev/webhooks/clerk`
3. Select events: user.created, user.updated, user.deleted
4. Save the signing secret to `.env` as `CLERK_WEBHOOK_SIGNING_SECRET`
5. Restart your API server

### Step 2: Test webhook by creating user in Clerk
1. In Clerk Dashboard → Users → Create User
2. Fill in email, password, name
3. Check your API logs for:
```
[ClerkWebhookController] Received Clerk webhook: user.created
[ClerkWebhookController] Creating user from Clerk: newuser@example.com
```
4. Verify in database:
```sql
SELECT * FROM users WHERE email = 'newuser@example.com';
```

## Manual Test Checklist

### Authentication ✅
- [x] Public endpoints accessible without token
- [x] Protected endpoints return 401 without token
- [ ] Invalid JWT tokens rejected
- [ ] Valid JWT token grants access

### RBAC (Requires manual token testing)
- [ ] Create hospital with authenticated user
- [ ] Update hospital with same user
- [ ] Verify user-hospital association in database

### Audit Logging
- [ ] Audit logs created for hospital creation
- [ ] Audit logs have hospitalId, userId, action, entityType
- [ ] Sensitive fields redacted in metadata
- [ ] IP address and user agent captured

### Webhooks
- [x] Webhook secret configured in .env  
- [ ] Create user in Clerk triggers webhook
- [ ] User synced to database
- [ ] Webhook signature validation works

## Quick Database Check Script

```sql
-- Comprehensive audit log check
SELECT 
    action,
    entity_type,
    COUNT(*) as count,
    MAX(created_at) as latest
FROM audit_logs
GROUP BY action, entity_type
ORDER BY latest DESC;
```
