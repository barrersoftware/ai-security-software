# AI Security Scanner - Windows Setup Script
# Compatible with: Windows 10, Windows 11, Windows Server
# Skill Level: Beginner to SpecOps
# Version: 3.1.0
# Requires: PowerShell 5.1 or higher

#Requires -RunAsAdministrator

$ErrorActionPreference = "Stop"

# Configuration
$RepoUrl = "https://github.com/ssfdre38/ai-security-scanner.git"
$InstallDir = "$env:USERPROFILE\ai-security-scanner"
$WebUIPort = 3000

################################################################################
# Colors and Output Functions
################################################################################

function Write-Success {
    param([string]$Message)
    Write-Host "✓ " -ForegroundColor Green -NoNewline
    Write-Host $Message
}

function Write-Error-Custom {
    param([string]$Message)
    Write-Host "✗ " -ForegroundColor Red -NoNewline
    Write-Host $Message
}

function Write-Warning-Custom {
    param([string]$Message)
    Write-Host "! " -ForegroundColor Yellow -NoNewline
    Write-Host $Message
}

function Write-Info {
    param([string]$Message)
    Write-Host "ℹ " -ForegroundColor Cyan -NoNewline
    Write-Host $Message
}

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host "▶ " -ForegroundColor Cyan -NoNewline
    Write-Host $Message -ForegroundColor Blue
    Write-Host ""
}

function Show-Banner {
    Clear-Host
    Write-Host @"
╔══════════════════════════════════════════════════════════════════╗
║                                                                  ║
║           AI SECURITY SCANNER v3.1.0                            ║
║           Windows Setup Script                                   ║
║                                                                  ║
║           From Zero to Secure in Minutes                        ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
"@ -ForegroundColor Cyan
    Write-Host ""
}

function Prompt-YesNo {
    param(
        [string]$Question,
        [string]$Default = "N"
    )
    
    $prompt = if ($Default -eq "Y") { "$Question [Y/n]: " } else { "$Question [y/N]: " }
    $response = Read-Host $prompt
    
    if ([string]::IsNullOrWhiteSpace($response)) {
        $response = $Default
    }
    
    return $response -match "^[Yy]"
}

function Generate-RandomKey {
    $bytes = New-Object byte[] 32
    [Security.Cryptography.RNGCryptoServiceProvider]::Create().GetBytes($bytes)
    return [BitConverter]::ToString($bytes).Replace("-", "").ToLower()
}

################################################################################
# System Detection
################################################################################

function Test-Administrator {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Get-SystemInfo {
    Write-Step "Detecting System Information"
    
    $os = Get-CimInstance Win32_OperatingSystem
    $cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
    
    Write-Info "OS: $($os.Caption) $($os.Version)"
    Write-Info "Architecture: $($os.OSArchitecture)"
    Write-Info "CPU: $($cpu.Name)"
    Write-Info "RAM: $([math]::Round($os.TotalVisibleMemorySize/1MB, 2)) GB"
}

################################################################################
# Check Dependencies
################################################################################

function Test-Chocolatey {
    Write-Step "Checking Package Manager"
    
    if (Get-Command choco -ErrorAction SilentlyContinue) {
        $version = choco --version
        Write-Success "Chocolatey $version installed"
        return $true
    } else {
        Write-Warning-Custom "Chocolatey not found"
        return $false
    }
}

function Install-Chocolatey {
    Write-Step "Installing Chocolatey Package Manager"
    
    Write-Info "Chocolatey is a package manager for Windows (like apt for Ubuntu)"
    
    if (!(Prompt-YesNo "Install Chocolatey?" "Y")) {
        Write-Info "Skipping Chocolatey installation"
        return $false
    }
    
    Write-Info "Installing Chocolatey..."
    Set-ExecutionPolicy Bypass -Scope Process -Force
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
    Invoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://chocolatey.org/install.ps1'))
    
    # Refresh environment
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    
    Write-Success "Chocolatey installed successfully"
    return $true
}

function Test-NodeJS {
    Write-Step "Checking Node.js Installation"
    
    if (Get-Command node -ErrorAction SilentlyContinue) {
        $nodeVersion = node -v
        $npmVersion = npm -v
        Write-Success "Node.js $nodeVersion installed"
        Write-Success "npm $npmVersion installed"
        
        # Check version
        $major = [int]($nodeVersion.Substring(1).Split('.')[0])
        if ($major -lt 14) {
            Write-Warning-Custom "Node.js version is old. Recommend v18 or higher."
            if (Prompt-YesNo "Upgrade Node.js?" "Y") {
                return $false
            }
        }
        return $true
    } else {
        Write-Warning-Custom "Node.js not found"
        return $false
    }
}

function Install-NodeJS {
    Write-Step "Installing Node.js"
    
    if (Test-Chocolatey) {
        Write-Info "Installing Node.js via Chocolatey..."
        choco install nodejs-lts -y
    } else {
        Write-Info "Please download Node.js from: https://nodejs.org/"
        Write-Info "Install the LTS version and run this script again."
        Start-Process "https://nodejs.org/"
        exit 1
    }
    
    # Refresh environment
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    
    Write-Success "Node.js installed"
}

function Test-Git {
    Write-Step "Checking Git Installation"
    
    if (Get-Command git -ErrorAction SilentlyContinue) {
        $gitVersion = git --version
        Write-Success "$gitVersion installed"
        return $true
    } else {
        Write-Warning-Custom "Git not found"
        return $false
    }
}

function Install-Git {
    Write-Step "Installing Git"
    
    if (Test-Chocolatey) {
        Write-Info "Installing Git via Chocolatey..."
        choco install git -y
    } else {
        Write-Info "Please download Git from: https://git-scm.com/download/win"
        Start-Process "https://git-scm.com/download/win"
        exit 1
    }
    
    # Refresh environment
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    
    Write-Success "Git installed"
}

function Install-SecurityTools {
    Write-Step "Installing Security Tools (Optional)"
    
    if (!(Prompt-YesNo "Install Windows Defender and security tools?" "Y")) {
        Write-Info "Skipping security tools installation"
        return
    }
    
    # Enable Windows Defender
    Write-Info "Ensuring Windows Defender is enabled..."
    Set-MpPreference -DisableRealtimeMonitoring $false -ErrorAction SilentlyContinue
    
    # Update definitions
    Write-Info "Updating Windows Defender definitions..."
    Update-MpSignature -ErrorAction SilentlyContinue
    
    # Install additional tools via Chocolatey
    if (Test-Chocolatey) {
        if (Prompt-YesNo "Install additional security tools (Sysinternals, OpenSSL)?" "Y") {
            Write-Info "Installing security tools..."
            choco install sysinternals openssl.light -y
        }
    }
    
    Write-Success "Security tools configured"
}

################################################################################
# Download Repository
################################################################################

function Get-Repository {
    Write-Step "Downloading AI Security Scanner"
    
    if (Test-Path $InstallDir) {
        Write-Warning-Custom "Installation directory already exists: $InstallDir"
        if (Prompt-YesNo "Remove and reinstall?" "Y") {
            Remove-Item -Path $InstallDir -Recurse -Force
        } else {
            Write-Info "Using existing installation"
            Set-Location $InstallDir
            git pull origin master 2>$null
            return
        }
    }
    
    Write-Info "Cloning repository..."
    git clone $RepoUrl $InstallDir
    Set-Location $InstallDir
    
    Write-Success "Repository downloaded to $InstallDir"
}

################################################################################
# Install NPM Dependencies
################################################################################

function Install-NPMPackages {
    Write-Step "Installing Node.js Packages"
    
    Set-Location "$InstallDir\web-ui"
    
    Write-Info "Installing packages (this may take a few minutes)..."
    npm install --quiet 2>$null
    
    Write-Success "Node.js packages installed"
}

################################################################################
# Configuration
################################################################################

function New-EnvironmentConfig {
    Write-Step "Configuring Environment"
    
    Set-Location "$InstallDir\web-ui"
    
    if (Test-Path ".env") {
        Write-Warning-Custom "Configuration file already exists"
        if (!(Prompt-YesNo "Reconfigure?" "N")) {
            Write-Info "Using existing configuration"
            return
        }
    }
    
    Write-Info "Creating .env configuration file..."
    
    # Generate secure keys
    $sessionSecret = Generate-RandomKey
    $mfaKey = Generate-RandomKey
    $csrfKey = Generate-RandomKey
    
    $envContent = @"
# AI Security Scanner Configuration
# Generated: $(Get-Date)
# DO NOT COMMIT THIS FILE TO VERSION CONTROL

# Application Settings
NODE_ENV=production
PORT=$WebUIPort
LOG_LEVEL=info

# Security Settings
SESSION_SECRET=$sessionSecret
MFA_ENCRYPTION_KEY=$mfaKey
CSRF_SECRET=$csrfKey

# Redis Configuration (optional)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
USE_REDIS=false

# Backup Settings
AUTO_BACKUP_ENABLED=true
AUTO_BACKUP_SCHEDULE=0 2 * * *
BACKUP_RETENTION_DAYS=30

# Rate Limiting
AUTH_RATE_LIMIT_WINDOW_MS=900000
AUTH_RATE_LIMIT_MAX=5
API_RATE_LIMIT_WINDOW_MS=60000
API_RATE_LIMIT_MAX=100
SCAN_RATE_LIMIT_WINDOW_MS=300000
SCAN_RATE_LIMIT_MAX=10

# SSL/TLS Settings (configure if needed)
SSL_CERT_PATH=
SSL_KEY_PATH=
FORCE_HTTPS=false

# OAuth Settings (optional - leave blank to disable)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:$WebUIPort/api/auth/google/callback

MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_CALLBACK_URL=http://localhost:$WebUIPort/api/auth/microsoft/callback

# Notification Settings (optional)
SLACK_WEBHOOK_URL=
DISCORD_WEBHOOK_URL=
EMAIL_ENABLED=false
EMAIL_FROM=security@localhost
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
PAGERDUTY_KEY=
"@

    $envContent | Out-File -FilePath ".env" -Encoding UTF8
    
    Write-Success "Configuration file created with secure keys"
}

################################################################################
# Firewall Configuration
################################################################################

function Set-FirewallRule {
    Write-Step "Configuring Windows Firewall"
    
    if (!(Prompt-YesNo "Open Windows Firewall port $WebUIPort?" "Y")) {
        Write-Info "Skipping firewall configuration"
        return
    }
    
    Write-Info "Creating firewall rule..."
    
    # Remove existing rule if present
    Remove-NetFirewallRule -DisplayName "AI Security Scanner" -ErrorAction SilentlyContinue
    
    # Create new rule
    New-NetFirewallRule -DisplayName "AI Security Scanner" `
        -Direction Inbound `
        -Protocol TCP `
        -LocalPort $WebUIPort `
        -Action Allow `
        -Profile Any | Out-Null
    
    Write-Success "Firewall rule created for port $WebUIPort"
}

################################################################################
# SSL Certificate Setup
################################################################################

function Set-SSLCertificate {
    Write-Step "SSL/TLS Certificate Setup"
    
    if (!(Prompt-YesNo "Configure SSL/TLS certificates?" "N")) {
        Write-Info "Skipping SSL setup (you can configure later)"
        return
    }
    
    Write-Host ""
    Write-Host "SSL Certificate Options:"
    Write-Host "1) Self-signed certificate (for testing)"
    Write-Host "2) Use existing certificates"
    Write-Host "3) Skip SSL setup"
    Write-Host ""
    $sslOption = Read-Host "Select option [1-3]"
    
    switch ($sslOption) {
        "1" { New-SelfSignedCertificate-Custom }
        "2" { Set-ExistingCertificate }
        default { Write-Info "Skipping SSL setup" }
    }
}

function New-SelfSignedCertificate-Custom {
    $certDir = "$InstallDir\web-ui\certs"
    New-Item -ItemType Directory -Path $certDir -Force | Out-Null
    
    Write-Info "Generating self-signed certificate..."
    
    # Check if OpenSSL is available
    if (Get-Command openssl -ErrorAction SilentlyContinue) {
        & openssl req -x509 -newkey rsa:4096 -keyout "$certDir\key.pem" -out "$certDir\cert.pem" `
            -days 365 -nodes -subj "/CN=localhost" 2>$null
    } else {
        # Use PowerShell method
        $cert = New-SelfSignedCertificate -DnsName "localhost" -CertStoreLocation "Cert:\CurrentUser\My"
        $certPath = "Cert:\CurrentUser\My\$($cert.Thumbprint)"
        
        # Export certificate
        Export-Certificate -Cert $certPath -FilePath "$certDir\cert.pem" -Type CERT | Out-Null
        
        # Export private key (requires password)
        $password = ConvertTo-SecureString -String "temp" -Force -AsPlainText
        Export-PfxCertificate -Cert $certPath -FilePath "$certDir\cert.pfx" -Password $password | Out-Null
        
        Write-Warning-Custom "Note: Private key exported as PFX. Convert to PEM if needed."
    }
    
    # Update .env
    $envPath = "$InstallDir\web-ui\.env"
    (Get-Content $envPath) -replace 'SSL_CERT_PATH=.*', "SSL_CERT_PATH=$certDir\cert.pem" | Set-Content $envPath
    (Get-Content $envPath) -replace 'SSL_KEY_PATH=.*', "SSL_KEY_PATH=$certDir\key.pem" | Set-Content $envPath
    
    Write-Success "Self-signed certificate created"
    Write-Warning-Custom "Note: Browsers will show security warnings for self-signed certificates"
}

function Set-ExistingCertificate {
    $certPath = Read-Host "Enter path to certificate file"
    $keyPath = Read-Host "Enter path to private key file"
    
    if (!(Test-Path $certPath) -or !(Test-Path $keyPath)) {
        Write-Error-Custom "Certificate or key file not found"
        return
    }
    
    # Update .env
    $envPath = "$InstallDir\web-ui\.env"
    (Get-Content $envPath) -replace 'SSL_CERT_PATH=.*', "SSL_CERT_PATH=$certPath" | Set-Content $envPath
    (Get-Content $envPath) -replace 'SSL_KEY_PATH=.*', "SSL_KEY_PATH=$keyPath" | Set-Content $envPath
    
    Write-Success "Existing certificates configured"
}

################################################################################
# Windows Service
################################################################################

function New-WindowsService {
    Write-Step "Creating Windows Service"
    
    if (!(Prompt-YesNo "Create Windows Service for auto-start?" "Y")) {
        Write-Info "Skipping service creation"
        return
    }
    
    Write-Info "Installing NSSM (Non-Sucking Service Manager)..."
    
    if (Test-Chocolatey) {
        choco install nssm -y 2>$null
    } else {
        Write-Warning-Custom "NSSM not available. Install manually from: https://nssm.cc/"
        return
    }
    
    # Refresh environment
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    
    Write-Info "Creating service..."
    
    # Remove existing service if present
    & nssm stop "AI Security Scanner" 2>$null
    & nssm remove "AI Security Scanner" confirm 2>$null
    
    # Install service
    $nodePath = (Get-Command node).Path
    $serverPath = "$InstallDir\web-ui\server.js"
    
    & nssm install "AI Security Scanner" $nodePath $serverPath
    & nssm set "AI Security Scanner" AppDirectory "$InstallDir\web-ui"
    & nssm set "AI Security Scanner" DisplayName "AI Security Scanner"
    & nssm set "AI Security Scanner" Description "AI-powered security scanning and monitoring platform"
    & nssm set "AI Security Scanner" Start SERVICE_AUTO_START
    & nssm set "AI Security Scanner" AppEnvironmentExtra "NODE_ENV=production"
    
    Write-Success "Windows Service created"
    Write-Info "Start with: Start-Service 'AI Security Scanner'"
    Write-Info "View status: Get-Service 'AI Security Scanner'"
}

################################################################################
# Test Installation
################################################################################

function Test-Installation {
    Write-Step "Testing Installation"
    
    Set-Location "$InstallDir\web-ui"
    
    # Test syntax
    Write-Info "Checking syntax..."
    
    try {
        node -c server.js
        Write-Success "Server syntax OK"
    } catch {
        Write-Error-Custom "Syntax error in server.js"
    }
    
    try {
        node -c mfa.js
        Write-Success "MFA module OK"
    } catch {
        Write-Error-Custom "Syntax error in mfa.js"
    }
    
    try {
        node -c security.js
        Write-Success "Security module OK"
    } catch {
        Write-Error-Custom "Syntax error in security.js"
    }
}

################################################################################
# Start Server
################################################################################

function Start-Server {
    Write-Step "Starting Server"
    
    if (!(Prompt-YesNo "Start the AI Security Scanner now?" "Y")) {
        Write-Info "You can start manually with: cd $InstallDir\web-ui; node server.js"
        return
    }
    
    Set-Location "$InstallDir\web-ui"
    
    Write-Info "Starting server on port $WebUIPort..."
    Write-Info "Press Ctrl+C to stop the server"
    Write-Host ""
    
    node server.js
}

################################################################################
# Show Summary
################################################################################

function Show-Summary {
    Write-Step "Installation Complete!"
    
    Write-Host ""
    Write-Host "╔══════════════════════════════════════════════════════════════════╗" -ForegroundColor Green
    Write-Host "║                                                                  ║" -ForegroundColor Green
    Write-Host "║           AI Security Scanner v3.1.0                            ║" -ForegroundColor Green
    Write-Host "║           Installation Successful!                               ║" -ForegroundColor Green
    Write-Host "║                                                                  ║" -ForegroundColor Green
    Write-Host "╚══════════════════════════════════════════════════════════════════╝" -ForegroundColor Green
    Write-Host ""
    
    Write-Success "Installation Directory: $InstallDir"
    Write-Success "Web UI Port: $WebUIPort"
    Write-Success "Configuration: $InstallDir\web-ui\.env"
    Write-Host ""
    
    Write-Info "Access the Web UI:"
    $envPath = "$InstallDir\web-ui\.env"
    if ((Test-Path $envPath) -and (Select-String -Path $envPath -Pattern "SSL_CERT_PATH=.*pem" -Quiet)) {
        Write-Host "  https://localhost:$WebUIPort" -ForegroundColor Cyan
    } else {
        Write-Host "  http://localhost:$WebUIPort" -ForegroundColor Cyan
    }
    Write-Host ""
    
    Write-Info "Start the server:"
    Write-Host "  cd $InstallDir\web-ui"
    Write-Host "  node server.js"
    Write-Host ""
    
    if (Get-Service "AI Security Scanner" -ErrorAction SilentlyContinue) {
        Write-Info "Or use Windows Service:"
        Write-Host "  Start-Service 'AI Security Scanner'"
        Write-Host "  Get-Service 'AI Security Scanner'"
        Write-Host ""
    }
    
    Write-Info "Documentation:"
    Write-Host "  Quick Start: $InstallDir\QUICK_START_SECURITY_FEATURES.md"
    Write-Host "  Full Docs:   $InstallDir\SECURITY_ENHANCEMENTS_v3.1.0.md"
    Write-Host "  Changelog:   $InstallDir\CHANGELOG_v3.1.0.md"
    Write-Host ""
    
    Write-Info "Security Features:"
    Write-Host "  ✓ Multi-Factor Authentication (MFA)"
    Write-Host "  ✓ OAuth 2.0 (Google/Microsoft)"
    Write-Host "  ✓ Rate Limiting"
    Write-Host "  ✓ Audit Logging"
    Write-Host "  ✓ Automated Backups"
    Write-Host "  ✓ SSL/TLS Support"
    Write-Host "  ✓ 10 Compliance Frameworks"
    Write-Host ""
    
    Write-Warning-Custom "First Steps:"
    Write-Host "  1. Access the web UI"
    Write-Host "  2. Create admin account"
    Write-Host "  3. Enable MFA for security"
    Write-Host "  4. Configure OAuth (optional)"
    Write-Host "  5. Run your first security scan"
    Write-Host ""
    
    Write-Info "Need help? Check the documentation or visit:"
    Write-Host "  https://github.com/ssfdre38/ai-security-scanner"
    Write-Host ""
}

################################################################################
# Main Installation Flow
################################################################################

function Main {
    Show-Banner
    
    if (!(Test-Administrator)) {
        Write-Error-Custom "This script must be run as Administrator"
        Write-Info "Right-click PowerShell and select 'Run as Administrator'"
        exit 1
    }
    
    Write-Host "This script will install the AI Security Scanner with all security features."
    Write-Host "It supports Windows 10, Windows 11, and Windows Server."
    Write-Host ""
    
    if (!(Prompt-YesNo "Continue with installation?" "Y")) {
        Write-Info "Installation cancelled"
        exit 0
    }
    
    Get-SystemInfo
    
    # Check and install dependencies
    if (!(Test-Chocolatey)) {
        Install-Chocolatey
    }
    
    if (!(Test-NodeJS)) {
        Install-NodeJS
    }
    
    if (!(Test-Git)) {
        Install-Git
    }
    
    Install-SecurityTools
    Get-Repository
    Install-NPMPackages
    New-EnvironmentConfig
    Set-FirewallRule
    Set-SSLCertificate
    New-WindowsService
    Test-Installation
    Show-Summary
    
    if (Prompt-YesNo "Start server now?" "Y") {
        Start-Server
    }
}

# Run main installation
Main
