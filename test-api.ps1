# Wardline API Testing Script
# Run this from PowerShell in the Wardline directory

$baseUrl = "http://localhost:3001"
$ngrokUrl = "https://uncongratulating-zaid-obeyingly.ngrok-free.dev"

Write-Host "`n=== PHASE 1: AUTHENTICATION TESTING ===" -ForegroundColor Cyan

# Test 1.1: Public Endpoint (Webhook - marked with @Public())
Write-Host "`n[Test 1.1] Testing public endpoint (webhook)..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/webhooks/clerk" -Method POST `
        -ContentType "application/json" `
        -Body '{"type":"test"}' `
        -ErrorAction Stop
    Write-Host "✅ Public endpoint accessible (Status: $($response.StatusCode))" -ForegroundColor Green
} catch {
    if ($_.Exception.Response.StatusCode -eq 401) {
        Write-Host "❌ Webhook signature validation rejected request (expected for invalid signature)" -ForegroundColor Yellow
        Write-Host "   Response: $($_.ErrorDetails.Message)" -ForegroundColor Gray
    } else {
        Write-Host "❌ Unexpected error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Test 1.2: Protected Endpoint Without Token
Write-Host "`n[Test 1.2] Testing protected endpoint without token..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/hospitals" -ErrorAction Stop
    Write-Host "❌ FAIL: Should have returned 401" -ForegroundColor Red
} catch {
    if ($_.Exception.Response.StatusCode -eq 401) {
        Write-Host "✅ PASS: Returns 401 Unauthorized" -ForegroundColor Green
        Write-Host "   Response: $($_.ErrorDetails.Message)" -ForegroundColor Gray
    } else {
        Write-Host "❌ Unexpected status code" -ForegroundColor Red
    }
}

Write-Host "`n" -NoNewline
Write-Host "NEXT STEPS:" -ForegroundColor Magenta
Write-Host "1. Go to Clerk Dashboard → Users → Create a test user"
Write-Host "2. Copy the User ID (starts with 'user_')"
Write-Host "3. Generate a JWT token for the user"
Write-Host "4. Run Phase 2 tests with the token"

Write-Host "`n=== PHASE 2: RBAC TESTING (Requires JWT Token) ===" -ForegroundColor Cyan
Write-Host "Update the `$jwtToken variable below with your actual token from Clerk" -ForegroundColor Yellow

# Placeholder for JWT token - USER NEEDS TO UPDATE THIS
$jwtToken = "YOUR_JWT_TOKEN_HERE"

if ($jwtToken -eq "YOUR_JWT_TOKEN_HERE") {
    Write-Host "`n⚠️  JWT Token not set. Please:" -ForegroundColor Yellow
    Write-Host "   1. Get a JWT token from Clerk Dashboard" -ForegroundColor Gray
    Write-Host "   2. Update the `$jwtToken variable in this script" -ForegroundColor Gray
    Write-Host "   3. Re-run the script" -ForegroundColor Gray
    exit
}

# Test 2.1: Access Protected Endpoint With Valid Token
Write-Host "`n[Test 2.1] Testing protected endpoint with valid token..." -ForegroundColor Yellow
try {
    $headers = @{
        "Authorization" = "Bearer $jwtToken"
    }
    $response = Invoke-WebRequest -Uri "$baseUrl/hospitals" -Headers $headers -ErrorAction Stop
    Write-Host "✅ PASS: Authenticated successfully" -ForegroundColor Green
    Write-Host "   Response: $($response.Content)" -ForegroundColor Gray
} catch {
    Write-Host "❌ FAIL: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   Response: $($_.ErrorDetails.Message)" -ForegroundColor Gray
}

# Test 2.2: Create Hospital
Write-Host "`n[Test 2.2] Creating test hospital..." -ForegroundColor Yellow
try {
    $body = @{
        name = "Test Hospital"
        slug = "test-hospital"
        primaryPhone = "+1234567890"
    } | ConvertTo-Json

    $response = Invoke-WebRequest -Uri "$baseUrl/hospitals" -Method POST `
        -Headers $headers `
        -ContentType "application/json" `
        -Body $body `
        -ErrorAction Stop
    
    $hospitalData = $response.Content | ConvertFrom-Json
    $hospitalId = $hospitalData.id
    Write-Host "✅ PASS: Hospital created" -ForegroundColor Green
    Write-Host "   Hospital ID: $hospitalId" -ForegroundColor Gray
    
    # Save for later tests
    $hospitalId | Out-File -FilePath "test_hospital_id.txt"
} catch {
    Write-Host "❌ FAIL: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   Response: $($_.ErrorDetails.Message)" -ForegroundColor Gray
}

Write-Host "`n=== PHASE 3: AUDIT LOGGING ===" -ForegroundColor Cyan
Write-Host "Check your PostgreSQL database for audit logs:" -ForegroundColor Yellow
Write-Host "SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 5;" -ForegroundColor Gray

Write-Host "`n=== PHASE 4: WEBHOOK CONFIGURATION ===" -ForegroundColor Cyan
Write-Host "Configure Clerk webhook with these settings:" -ForegroundColor Yellow
Write-Host "  Endpoint URL: $ngrokUrl/webhooks/clerk" -ForegroundColor Green
Write-Host "  Events: user.created, user.updated, user.deleted" -ForegroundColor Green
Write-Host "  Copy the signing secret and add to .env:" -ForegroundColor Green
Write-Host "  CLERK_WEBHOOK_SIGNING_SECRET=whsec_..." -ForegroundColor Gray

Write-Host "`n=== TESTING COMPLETE ===" -ForegroundColor Cyan
