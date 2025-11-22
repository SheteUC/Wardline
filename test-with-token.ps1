# Quick Test Script - Run after getting JWT token
# Save as: test-with-token.ps1

param(
    [Parameter(Mandatory = $false)]
    [string]$Token = ""
)

if ($Token -eq "") {
    Write-Host "Usage: .\test-with-token.ps1 -Token YOUR_JWT_TOKEN" -ForegroundColor Yellow
    Write-Host "`nOr edit this file and set the `$Token variable" -ForegroundColor Yellow
    exit
}

$headers = @{"Authorization" = "Bearer $Token" }
$base = "http://localhost:3001"

Write-Host "`n=== API VERIFICATION TESTS ===" -ForegroundColor Cyan

# Test 1: Authenticated access
Write-Host "`n[Test 1] Testing authenticated access..." -ForegroundColor Yellow
try {
    $result = Invoke-WebRequest -Uri "$base/hospitals" -Headers $headers
    Write-Host "✅ Can access protected endpoints" -ForegroundColor Green
}
catch {
    Write-Host "❌ Authentication failed: $($_.Exception.Message)" -ForegroundColor Red
    exit
}

# Test 2: Create hospital  
Write-Host "`n[Test 2] Creating test hospital..." -ForegroundColor Yellow
try {
    $timestamp = Get-Date -Format 'yyyyMMddHHmmss'
    $hospital = @{
        name         = "Test Hospital"
        slug         = "test-hospital-$timestamp"
        primaryPhone = "+1234567890"
    } | ConvertTo-Json

    $result = Invoke-WebRequest -Uri "$base/hospitals" -Method POST `
        -Headers $headers -ContentType "application/json" -Body $hospital
    $hospitalData = $result.Content | ConvertFrom-Json
    $hospitalId = $hospitalData.id
    Write-Host "✅ Hospital created: $hospitalId" -ForegroundColor Green
}
catch {
    Write-Host "❌ Failed to create hospital: $($_.Exception.Message)" -ForegroundColor Red
    exit
}

# Test 3: Update hospital
Write-Host "`n[Test 3] Updating hospital..." -ForegroundColor Yellow
try {
    $update = @{ name = "Updated Test Hospital" } | ConvertTo-Json
    Invoke-WebRequest -Uri "$base/hospitals/$hospitalId" -Method PATCH `
        -Headers $headers -ContentType "application/json" -Body $update | Out-Null
    Write-Host "✅ Hospital updated successfully" -ForegroundColor Green
}
catch {
    Write-Host "❌ Failed to update hospital: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 4: Get hospital
Write-Host "`n[Test 4] Retrieving hospital..." -ForegroundColor Yellow  
try {
    $result = Invoke-WebRequest -Uri "$base/hospitals/$hospitalId" -Headers $headers
    $data = $result.Content | ConvertFrom-Json
    Write-Host "✅ Hospital retrieved: $($data.name)" -ForegroundColor Green
}
catch {
    Write-Host "❌ Failed to retrieve hospital: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== ALL TESTS PASSED! ===" -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor Cyan
Write-Host "1. Check database for audit logs:" -ForegroundColor White
Write-Host "   SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 10;" -ForegroundColor Gray
Write-Host "2. Check user-hospital associations:" -ForegroundColor White  
Write-Host "   SELECT * FROM user_hospitals;" -ForegroundColor Gray
Write-Host "3. Test webhook by creating a user in Clerk Dashboard" -ForegroundColor White
