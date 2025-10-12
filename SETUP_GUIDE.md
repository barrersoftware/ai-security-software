# AI Security Scanner - Setup Guide

**Version:** 3.1.0  
**Platforms:** Linux, macOS, Windows  
**Skill Level:** Beginner to SpecOps  

---

## 🚀 One-Line Installation

### Linux / macOS

```bash
curl -fsSL https://raw.githubusercontent.com/ssfdre38/ai-security-scanner/master/setup.sh | bash
```

Or download and run:

```bash
wget https://raw.githubusercontent.com/ssfdre38/ai-security-scanner/master/setup.sh
chmod +x setup.sh
./setup.sh
```

### Windows (PowerShell as Administrator)

```powershell
irm https://raw.githubusercontent.com/ssfdre38/ai-security-scanner/master/setup.ps1 | iex
```

Or download and run:

```powershell
Invoke-WebRequest -Uri https://raw.githubusercontent.com/ssfdre38/ai-security-scanner/master/setup.ps1 -OutFile setup.ps1
Set-ExecutionPolicy Bypass -Scope Process -Force
.\setup.ps1
```

---

## 📋 What the Setup Script Does

### Automatic Detection & Installation

1. **Detects Your Operating System**
   - Ubuntu, Debian, CentOS, RHEL, Fedora, Arch Linux
   - macOS
   - Windows 10/11/Server

2. **Installs Required Dependencies**
   - Node.js (LTS version)
   - npm (Node Package Manager)
   - Git (version control)
   - Python 3 (for scripts)
   - OpenSSL (for encryption)

3. **Installs Security Tools**
   - ClamAV (virus scanner)
   - rkhunter (rootkit detector)
   - AIDE (file integrity checker)
   - Windows Defender (on Windows)

4. **Downloads Repository**
   - Clones from GitHub
   - Installs to `~/ai-security-scanner`

5. **Installs Node.js Packages**
   - All 18 security packages
   - MFA, OAuth, logging, backup tools

6. **Generates Secure Configuration**
   - Creates `.env` file
   - Generates random encryption keys
   - Sets secure defaults

7. **Optional Configuration**
   - Firewall rules
   - SSL/TLS certificates
   - System service (auto-start)
   - Windows Service (NSSM)

8. **Tests Installation**
   - Validates all modules
   - Checks syntax
   - Sets permissions

9. **Starts Server**
   - Optionally starts immediately
   - Shows access URL

---

## 🎯 For Different Skill Levels

### 🟢 Beginners (Just Starting with Linux/Windows)

**What you need:**
- A computer with Linux, macOS, or Windows
- Internet connection
- Administrator/sudo access

**Steps:**

1. **Open Terminal/PowerShell as Administrator**
   - Linux/macOS: Open Terminal
   - Windows: Right-click PowerShell → "Run as Administrator"

2. **Run the one-line installer**
   - Copy and paste the command above
   - Press Enter

3. **Follow the prompts**
   - The script asks questions (Y/N)
   - Answer "Y" to recommended options
   - Answer "N" to optional features

4. **Access the Web UI**
   - Open browser: `http://localhost:3000`
   - Create admin account
   - Start scanning!

**What happens automatically:**
- ✅ Installs everything needed
- ✅ Configures security settings
- ✅ Generates secure keys
- ✅ Opens firewall ports
- ✅ Tests the installation

---

### 🟡 Intermediate Users (Some Command Line Experience)

**Additional Options:**

1. **Custom Installation Directory**
   ```bash
   # Edit the script before running
   INSTALL_DIR="/opt/ai-security-scanner"
   ```

2. **Skip Optional Components**
   - Answer "N" to ClamAV if you have another antivirus
   - Skip SSL setup for testing
   - Skip systemd service for manual control

3. **Manual Firewall Configuration**
   ```bash
   # Ubuntu/Debian
   sudo ufw allow 3000/tcp
   
   # CentOS/RHEL/Fedora
   sudo firewall-cmd --permanent --add-port=3000/tcp
   sudo firewall-cmd --reload
   ```

4. **Manual SSL Certificate**
   ```bash
   # Generate self-signed certificate
   openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes
   
   # Update .env
   SSL_CERT_PATH=/path/to/cert.pem
   SSL_KEY_PATH=/path/to/key.pem
   ```

---

### 🔴 Advanced Users / SpecOps

**Advanced Configuration:**

1. **Unattended Installation**
   ```bash
   # Set environment variables to skip prompts
   export SKIP_PROMPTS=true
   export AUTO_CONFIGURE=true
   ./setup.sh
   ```

2. **Custom Port**
   ```bash
   # Before running setup
   export WEB_UI_PORT=8443
   ./setup.sh
   ```

3. **Behind Proxy**
   ```bash
   export HTTP_PROXY=http://proxy:8080
   export HTTPS_PROXY=http://proxy:8080
   ./setup.sh
   ```

4. **Docker Deployment**
   ```bash
   # Create Dockerfile (see Docker section below)
   docker build -t ai-security-scanner .
   docker run -p 3000:3000 -v ~/data:/data ai-security-scanner
   ```

5. **Kubernetes Deployment**
   ```yaml
   # See kubernetes/ directory for manifests
   kubectl apply -f kubernetes/deployment.yaml
   ```

6. **High Availability Setup**
   - Load balancer with multiple instances
   - Redis session store (set USE_REDIS=true)
   - Shared storage for backups
   - Database replication

7. **Custom Security Policies**
   ```bash
   # Edit .env after installation
   AUTH_RATE_LIMIT_MAX=3        # More restrictive
   SCAN_RATE_LIMIT_MAX=5        # Limit scan frequency
   MFA_REQUIRED_FOR_ADMIN=true  # Force MFA
   ```

---

## 🐧 Linux-Specific Instructions

### Ubuntu / Debian

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Run installer
curl -fsSL https://raw.githubusercontent.com/ssfdre38/ai-security-scanner/master/setup.sh | bash

# Or manual installation
git clone https://github.com/ssfdre38/ai-security-scanner.git
cd ai-security-scanner
./setup.sh
```

### CentOS / RHEL / Fedora

```bash
# Update system
sudo yum update -y

# Run installer
curl -fsSL https://raw.githubusercontent.com/ssfdre38/ai-security-scanner/master/setup.sh | bash
```

### Arch Linux

```bash
# Update system
sudo pacman -Syu

# Run installer
curl -fsSL https://raw.githubusercontent.com/ssfdre38/ai-security-scanner/master/setup.sh | bash
```

### Systemd Service

```bash
# Start service
sudo systemctl start ai-security-scanner

# Enable auto-start
sudo systemctl enable ai-security-scanner

# Check status
sudo systemctl status ai-security-scanner

# View logs
sudo journalctl -u ai-security-scanner -f
```

---

## 🍎 macOS-Specific Instructions

### macOS (Intel & Apple Silicon)

```bash
# Install Homebrew (if not installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Run installer
curl -fsSL https://raw.githubusercontent.com/ssfdre38/ai-security-scanner/master/setup.sh | bash
```

### Launch Agent (Auto-Start on macOS)

```bash
# Create launch agent
cat > ~/Library/LaunchAgents/com.ai-security-scanner.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.ai-security-scanner</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>server.js</string>
    </array>
    <key>WorkingDirectory</key>
    <string>~/ai-security-scanner/web-ui</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
</dict>
</plist>
EOF

# Load launch agent
launchctl load ~/Library/LaunchAgents/com.ai-security-scanner.plist
```

---

## 🪟 Windows-Specific Instructions

### Windows 10 / 11 / Server

**Prerequisites:**
- PowerShell 5.1 or higher
- Administrator access

**Installation:**

1. **Open PowerShell as Administrator**
   - Press Windows key
   - Type "PowerShell"
   - Right-click → "Run as Administrator"

2. **Run installer**
   ```powershell
   irm https://raw.githubusercontent.com/ssfdre38/ai-security-scanner/master/setup.ps1 | iex
   ```

3. **Or download and run**
   ```powershell
   Invoke-WebRequest -Uri https://raw.githubusercontent.com/ssfdre38/ai-security-scanner/master/setup.ps1 -OutFile setup.ps1
   Set-ExecutionPolicy Bypass -Scope Process -Force
   .\setup.ps1
   ```

### Windows Service

```powershell
# Start service
Start-Service "AI Security Scanner"

# Stop service
Stop-Service "AI Security Scanner"

# Check status
Get-Service "AI Security Scanner"

# Set to auto-start
Set-Service "AI Security Scanner" -StartupType Automatic
```

### Windows Firewall

```powershell
# Manually add firewall rule
New-NetFirewallRule -DisplayName "AI Security Scanner" `
    -Direction Inbound `
    -Protocol TCP `
    -LocalPort 3000 `
    -Action Allow
```

---

## 🐳 Docker Installation (Advanced)

### Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Install dependencies
RUN apk add --no-cache git python3 openssl clamav

# Clone repository
RUN git clone https://github.com/ssfdre38/ai-security-scanner.git .

# Install Node packages
WORKDIR /app/web-ui
RUN npm install --production

# Create data directory
RUN mkdir -p /data

# Expose port
EXPOSE 3000

# Start server
CMD ["node", "server.js"]
```

### Docker Compose

```yaml
version: '3.8'

services:
  ai-security-scanner:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ./data:/data
      - ./config:/app/web-ui/.env
    environment:
      - NODE_ENV=production
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    volumes:
      - redis-data:/data
    restart: unless-stopped

volumes:
  redis-data:
```

### Run with Docker

```bash
# Build image
docker build -t ai-security-scanner .

# Run container
docker run -d \
  --name ai-security-scanner \
  -p 3000:3000 \
  -v ~/ai-scanner-data:/data \
  ai-security-scanner

# View logs
docker logs -f ai-security-scanner
```

---

## ☸️ Kubernetes Deployment (SpecOps)

### Deployment YAML

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ai-security-scanner
spec:
  replicas: 3
  selector:
    matchLabels:
      app: ai-security-scanner
  template:
    metadata:
      labels:
        app: ai-security-scanner
    spec:
      containers:
      - name: scanner
        image: ai-security-scanner:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: USE_REDIS
          value: "true"
        - name: REDIS_HOST
          value: "redis-service"
        volumeMounts:
        - name: data
          mountPath: /data
      volumes:
      - name: data
        persistentVolumeClaim:
          claimName: scanner-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: ai-security-scanner
spec:
  type: LoadBalancer
  ports:
  - port: 443
    targetPort: 3000
  selector:
    app: ai-security-scanner
```

### Deploy

```bash
kubectl apply -f deployment.yaml
kubectl get pods -l app=ai-security-scanner
kubectl get service ai-security-scanner
```

---

## 🔧 Troubleshooting

### Common Issues

**1. "Node.js not found"**
```bash
# Install Node.js manually
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Or use nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install --lts
```

**2. "Permission denied"**
```bash
# Run with sudo (Linux/macOS)
sudo ./setup.sh

# Or fix permissions
chmod +x setup.sh
```

**3. "Port already in use"**
```bash
# Change port in .env
PORT=8080

# Or find and kill process using port
lsof -ti:3000 | xargs kill -9  # Linux/macOS
netstat -ano | findstr :3000   # Windows
```

**4. "Cannot connect to server"**
```bash
# Check if server is running
ps aux | grep node              # Linux/macOS
Get-Process node                # Windows

# Check firewall
sudo ufw status                 # Ubuntu
sudo firewall-cmd --list-all    # CentOS/RHEL
Get-NetFirewallRule             # Windows
```

**5. "Module not found"**
```bash
# Reinstall dependencies
cd ~/ai-security-scanner/web-ui
rm -rf node_modules package-lock.json
npm install
```

---

## 📚 Post-Installation

### First Steps

1. **Access Web UI**
   - Open browser: `http://localhost:3000`

2. **Create Admin Account**
   - Username: Choose secure username
   - Password: Strong password (8+ chars, mixed case, numbers, symbols)
   - Email: Your email address

3. **Enable MFA (Recommended)**
   - Go to Settings
   - Click "Enable MFA"
   - Scan QR code with Google/Microsoft Authenticator
   - Save backup codes

4. **Run First Scan**
   - Click "Start Scan"
   - Wait for results
   - Review findings

5. **Configure Notifications (Optional)**
   - Settings → Notifications
   - Add Slack/Discord webhook
   - Test notification

---

## 🔐 Security Hardening

### Production Checklist

- [ ] Change default port (if exposed to internet)
- [ ] Enable SSL/TLS certificates
- [ ] Configure strong passwords
- [ ] Enable MFA for all admin accounts
- [ ] Set up automated backups
- [ ] Configure firewall rules
- [ ] Review rate limiting settings
- [ ] Set up monitoring/alerting
- [ ] Configure log rotation
- [ ] Implement IP whitelisting (if needed)
- [ ] Use reverse proxy (nginx/Apache)
- [ ] Enable Redis for sessions (multi-server)
- [ ] Regular security updates

---

## 📖 Additional Resources

- **Documentation:** [SECURITY_ENHANCEMENTS_v3.1.0.md](SECURITY_ENHANCEMENTS_v3.1.0.md)
- **Quick Start:** [QUICK_START_SECURITY_FEATURES.md](QUICK_START_SECURITY_FEATURES.md)
- **Changelog:** [CHANGELOG_v3.1.0.md](CHANGELOG_v3.1.0.md)
- **GitHub:** https://github.com/ssfdre38/ai-security-scanner
- **Issues:** https://github.com/ssfdre38/ai-security-scanner/issues

---

## 🆘 Getting Help

### Support Channels

1. **Documentation** - Read the docs (most issues covered)
2. **GitHub Issues** - Report bugs or request features
3. **GitHub Discussions** - Ask questions, share tips
4. **System Logs** - Check logs for errors
   - Linux: `/var/log/syslog` or `journalctl -u ai-security-scanner`
   - Windows: Event Viewer or service logs
   - Application: `~/ai-security-scanner/web-ui/logs/`

### Getting Logs

```bash
# Linux systemd
sudo journalctl -u ai-security-scanner -n 100

# Application logs
tail -f ~/ai-security-scanner/web-ui/logs/application-*.log
tail -f ~/ai-security-scanner/web-ui/logs/error-*.log

# Windows service
Get-Content "C:\Users\YourUser\ai-security-scanner\web-ui\logs\application-*.log" -Tail 100 -Wait
```

---

**Version:** 3.1.0  
**Last Updated:** October 12, 2025  
**Status:** Production Ready ✅
