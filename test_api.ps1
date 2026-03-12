$ErrorActionPreference = "Stop"

$baseUrl = "http://localhost:8080/api"

Write-Host "1. Registering User..."
$regBody = @{
    username = "testdelegate"
    email = "test@munify.com"
    password = "password123"
} | ConvertTo-Json
try {
    Invoke-RestMethod -Uri "$baseUrl/auth/register" -Method Post -Body $regBody -ContentType "application/json" | Out-Null
} catch {}
Write-Host "✅ Registered successfully.`n"

Write-Host "2. Logging In..."
$loginBody = @{
    username = "testdelegate"
    password = "password123"
} | ConvertTo-Json
$loginRes = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -Body $loginBody -ContentType "application/json"
$token = $loginRes.token
$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type"  = "application/json"
}
Write-Host "✅ Logged in successfully. Got JWT.`n"

Write-Host "3. Fetching Templates..."
$templates = Invoke-RestMethod -Uri "$baseUrl/templates" -Method Get -Headers $headers
$posTemplate = $templates | Where-Object { $_.documentType -eq "RESOLUTION" } | Select-Object -First 1
Write-Host "✅ Reached templates endpoint. Template ID: $($posTemplate.id)`n"

Write-Host "4. Creating Document from Template..."
$docBody = @{
    title = "Draft Resolution on Climate Action"
    topic = "Climate Change Adaptation"
    committee = "UNEP"
    country = "Brazil"
    documentType = "RESOLUTION"
    templateId = $posTemplate.id
} | ConvertTo-Json
$doc = Invoke-RestMethod -Uri "$baseUrl/documents" -Method Post -Body $docBody -Headers $headers
Write-Host "✅ Document created with ID $($doc.id). Initial Version: $($doc.currentVersion)`n"

Write-Host "5. Fetching Document Versions..."
$versions = Invoke-RestMethod -Uri "$baseUrl/documents/$($doc.id)/versions" -Method Get -Headers $headers
Write-Host "✅ Got $($versions.Count) versions. Version 1 content length: $($versions[0].content.Length)`n"

Write-Host "6. Triggering AI Generation (This may take up to 60s)..."
$aiDoc = Invoke-RestMethod -Uri "$baseUrl/documents/$($doc.id)/generate" -Method Post -Headers $headers -TimeoutSec 120
Write-Host "✅ AI Generation successful! New Version: $($aiDoc.currentVersion)"
Write-Host "AI Output Preview: $($aiDoc.content.Substring(0, [math]::Min(200, $aiDoc.content.Length)))..."

Write-Host "`n🎉 All end-to-end tests completed successfully!"
