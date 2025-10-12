# AI Security Scanner for Windows 🛡️

Enterprise-grade security analysis for Windows servers and workstations, powered by local AI.

## Windows-Specific Features

- ✅ **Windows Server Security** - IIS, Active Directory, RDP analysis
- ✅ **PowerShell Integration** - Native Windows administration
- ✅ **Event Log Analysis** - Security, System, Application logs
- ✅ **Windows Defender** - Antivirus status, scanning, and configuration
- ✅ **Malware & Rootkit Detection** - Comprehensive threat scanning with AI analysis
- ✅ **SMB Security** - Network share and SMB version checks
- ✅ **Firewall Analysis** - Windows Firewall configuration review
- ✅ **Registry Security** - Security-critical registry settings and persistence detection
- ✅ **Active Directory** - Domain security assessment (when applicable)

## Requirements

### System Requirements
- Windows 10/11 or Windows Server 2016+
- PowerShell 5.1 or higher
- 8GB RAM minimum (16GB+ recommended for 70B model)
- 50GB free disk space
- Administrator privileges

### Prerequisites
- .NET Framework 4.7.2 or higher
- Internet connection (initial setup only)

## Installation

### Quick Install (Recommended)

1. **Download the repository:**
   ```powershell
   git clone https://github.com/ssfdre38/ai-security-scanner.git
   cd ai-security-scanner\windows
   ```

2. **Run installer as Administrator:**
   ```powershell
   # Right-click PowerShell and select "Run as Administrator"
   Set-ExecutionPolicy Bypass -Scope Process -Force
   .\install.ps1
   ```

The installer will:
- Install Chocolatey package manager (if needed)
- Install required dependencies (curl, jq)
- Install and configure Ollama
- Download your chosen AI model
- Set up security scanner scripts
- Configure system PATH

### Manual Installation

1. **Install Chocolatey:**
   ```powershell
   Set-ExecutionPolicy Bypass -Scope Process -Force
   [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
   iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
   ```

2. **Install dependencies:**
   ```powershell
   choco install curl jq -y
   ```

3. **Install Ollama:**
   - Download from [ollama.com/download](https://ollama.com/download)
   - Or use Chocolatey: `choco install ollama -y`

4. **Start Ollama:**
   ```powershell
   ollama serve
   ```
   (Keep this window open or run as a service)

5. **Install AI model:**
   ```powershell
   # Choose based on your RAM
   ollama pull llama3.1:8b     # For 16GB RAM
   # OR
   ollama pull llama3.1:70b    # For 32GB+ RAM
   ```

6. **Copy scripts:**
   ```powershell
   $installDir = "$env:ProgramFiles\AISecurityScanner"
   New-Item -ItemType Directory -Force -Path $installDir
   Copy-Item -Path ".\scripts\*" -Destination $installDir -Recurse
   ```

## Usage

### 1. Comprehensive Security Scanner

Run a complete Windows security audit:

```powershell
cd "$env:ProgramFiles\AISecurityScanner"
.\SecurityScanner.ps1
```

**What it scans:**
- System configuration and user accounts
- IIS web server (if installed)
- RDP and remote access settings
- File system permissions
- Network configuration and SMB
- Windows Defender and updates
- Installed applications
- Event logs (Security, System, Application)

**Output:** Detailed report in `Documents\SecurityReports\`

### 2. Malware & Rootkit Scanner

Comprehensive malware detection with Windows Defender:

```powershell
.\MalwareScanner.ps1
# OR for quick scan
.\MalwareScanner.ps1 -QuickScan
# OR for full scan
.\MalwareScanner.ps1 -FullScan
```

**What it scans:**
- Windows Defender virus/malware scan with latest definitions
- Running processes and network connections
- File system for malware indicators (temp files, hidden files, startup items)
- Registry persistence mechanisms
- Web shells in IIS directories
- Network configuration and suspicious DNS queries
- Scheduled tasks and autorun locations

**Output:** Detailed report in `Documents\security-reports\malware_scan_*.md`

### 3. Interactive Security Assistant

Chat with AI security expert:

```powershell
.\SecurityChat.ps1
```

**Example questions:**
- "How do I secure RDP on Windows Server?"
- "What are the best practices for Active Directory security?"
- "How to detect if my Windows server is compromised?"
- "Analyze this suspicious PowerShell command: [command]"

### 4. Code Security Review

Scan code for vulnerabilities:

```powershell
.\CodeReview.ps1 "C:\inetpub\wwwroot\myapp"
```

Supports: PowerShell, C#, JavaScript, Python, PHP, Java, C/C++

## Automated Scheduling

### Set up daily scans with Task Scheduler:

```powershell
# Create scheduled task for 3:30 AM daily
$action = New-ScheduledTaskAction -Execute 'PowerShell.exe' -Argument "-File `"$env:ProgramFiles\AISecurityScanner\SecurityScanner.ps1`""
$trigger = New-ScheduledTaskTrigger -Daily -At 3:30AM
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName "AI Security Scan" -Action $action -Trigger $trigger -Principal $principal
```

### View scheduled tasks:
```powershell
Get-ScheduledTask -TaskName "AI Security Scan"
```

## Windows-Specific Security Checks

### System Security
- Local user accounts and password policies
- Administrator group membership
- Failed login attempts from Event Log
- Scheduled tasks
- Auto-start programs in registry

### Web Server (IIS)
- IIS service status and configuration
- Website bindings and SSL
- Application pool isolation
- Anonymous authentication
- Request filtering

### Remote Access
- RDP status and configuration
- RDP port (default vs custom)
- Network Level Authentication (NLA)
- WinRM configuration
- OpenSSH server (if installed)

### Network Security
- Listening ports and services
- Active network connections
- Network shares and permissions
- SMB version (SMBv1 detection)
- DNS configuration

### Windows Defender
- Real-time protection status
- Scan history and frequency
- Exclusion paths (potential risks)
- Windows Update status
- Missing critical updates

### File System
- World-writable directories
- Excessive permissions on executables
- System32 directory protection
- Program Files security

### Event Logs
- Failed login attempts (Event ID 4625)
- Successful logins (Event ID 4624)
- System errors
- Application crashes
- Security policy changes

## Configuration

### Change AI Model

Edit any script and modify:
```powershell
$MODEL = "llama3.1:8b"  # Change to your preferred model
```

### Customize Scan Depth

Edit `SecurityScanner.ps1` and adjust:
- Number of events to analyze (`-MaxEvents`)
- Paths to scan
- Services to check
- Report sections

### Change Report Location

```powershell
$REPORT_DIR = "D:\SecurityReports"  # Custom location
```

## Troubleshooting

### Ollama not responding
```powershell
# Check if Ollama is running
Get-Process ollama

# Restart Ollama
Stop-Process -Name ollama -Force
Start-Process ollama -ArgumentList "serve" -WindowStyle Hidden
```

### Script execution policy error
```powershell
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Missing module error
```powershell
# Install required modules
Install-Module -Name WebAdministration -Force
Import-Module WebAdministration
```

### Out of memory
- Use smaller model: `ollama pull llama3.1:8b`
- Close other applications
- Increase page file size

## Windows Security Best Practices

The scanner checks for:

1. **Disable SMBv1** - Known security vulnerability
2. **Enable NLA for RDP** - Prevents unauthorized access
3. **Windows Firewall** - Ensure it's enabled and configured
4. **Strong Password Policy** - Complex passwords required
5. **Principle of Least Privilege** - Minimize admin accounts
6. **Windows Update** - Install security patches
7. **Defender Real-Time Protection** - Always enabled
8. **Audit Logging** - Track security events
9. **Remove Unnecessary Services** - Reduce attack surface
10. **Secure Network Shares** - Proper permissions

## Integration Examples

### Email Reports
```powershell
$report = Get-Content "Documents\SecurityReports\security_analysis_*.md" | Out-String
Send-MailMessage -To "admin@company.com" -From "security@company.com" -Subject "Security Scan Report" -Body $report -SmtpServer "smtp.company.com"
```

### Teams/Slack Webhook
```powershell
$webhook = "https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
$report = Get-Content "Documents\SecurityReports\security_analysis_*.md" -First 50
$body = @{ text = "Security Scan Complete: $report" } | ConvertTo-Json
Invoke-RestMethod -Uri $webhook -Method Post -Body $body -ContentType 'application/json'
```

## Active Directory Security

For domain controllers and AD environments:

```powershell
# Additional checks can be added:
Get-ADUser -Filter * -Properties PasswordLastSet, PasswordNeverExpires
Get-ADGroup "Domain Admins" -Properties Members
Get-GPOReport -All -ReportType Html -Path "GPOReport.html"
```

## Performance Notes

- **8GB RAM**: Use llama3.2:3b model (fast)
- **16GB RAM**: Use llama3.1:8b model (balanced)
- **32GB+ RAM**: Use llama3.1:70b model (best quality)
- **Scan Time**: 5-15 minutes depending on system size and model

## Support

- **Issues**: [GitHub Issues](https://github.com/ssfdre38/ai-security-scanner/issues)
- **Windows-specific questions**: Tag with `windows` label
- **Documentation**: [Main README](../README.md)

## License

MIT License - see [LICENSE](../LICENSE) file

---

**Made for Windows administrators and security professionals** 🪟🛡️
