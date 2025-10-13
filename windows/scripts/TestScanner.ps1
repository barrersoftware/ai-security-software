#!/usr/bin/env pwsh
# Test scanner for cross-platform validation
# Compatible with PowerShell Core 7+

Write-Host "=== PowerShell Test Scanner Started ===" -ForegroundColor Green
Write-Host "Timestamp: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Host "Platform: $([System.Environment]::OSVersion.Platform)"
Write-Host "PowerShell Version: $($PSVersionTable.PSVersion)"
Write-Host "User: $env:USER$env:USERNAME"
Write-Host ""

Start-Sleep -Seconds 1
Write-Host "Running simulated scan..." -ForegroundColor Yellow
Start-Sleep -Seconds 1
Write-Host "Progress: 25%" -ForegroundColor Cyan
Start-Sleep -Seconds 1
Write-Host "Progress: 50%" -ForegroundColor Cyan
Start-Sleep -Seconds 1
Write-Host "Progress: 75%" -ForegroundColor Cyan
Start-Sleep -Seconds 1
Write-Host "Progress: 100%" -ForegroundColor Cyan

Write-Host ""
Write-Host "=== PowerShell Test Scanner Complete ===" -ForegroundColor Green
exit 0
