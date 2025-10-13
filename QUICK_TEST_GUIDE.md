# Quick Test Guide - AI Security Scanner v4.0.0

**Purpose:** Test v4.0.0 on a minimal Ubuntu environment  
**Status:** Ready for testing

---

## Option 1: Docker Container (Recommended)

### Prerequisites
- Docker installed
- 2GB RAM minimum
- Internet connection

### Quick Start (Automated)

```bash
cd /home/ubuntu/ai-security-scanner

# Build test image (one-time, ~5-10 minutes)
docker build -f Dockerfile.test -t ai-scanner-test:latest .

# Start test container
docker run -it --privileged --name ai-scanner-test ai-scanner-test:latest

# Inside container, run automated test
./test-scanner.sh
```

### Manual Testing in Container

```bash
# Start container
docker run -it --privileged --name ai-scanner-test ai-scanner-test:latest

# Clone and setup
git clone https://github.com/ssfdre38/ai-security-scanner.git
cd ai-security-scanner
git checkout v4
cd web-ui
npm install

# Create .env file
cat > .env << 'EOF'
NODE_ENV=development
PORT=3001
SESSION_SECRET=$(openssl rand -hex 32)
MFA_ENCRYPTION_KEY=$(openssl rand -hex 16)
JWT_SECRET=$(openssl rand -hex 32)
EOF

# Start server
node server-new.js
```

### Test VPN Installers

```bash
# Inside container (requires privileged mode)
cd /home/ubuntu/ai-security-scanner

# Test WireGuard installer
sudo ./scripts/install-wireguard.sh

# Test OpenVPN installer
sudo ./scripts/install-openvpn.sh

# Or test both
sudo ./scripts/install-vpn-all.sh
```

### Cleanup

```bash
# Exit container
exit

# Remove container
docker stop ai-scanner-test
docker rm ai-scanner-test

# Remove image (if needed)
docker rmi ai-scanner-test:latest
```

---

## Option 2: LXD Container (Ubuntu Native)

### Prerequisites
- LXD installed: `sudo snap install lxd`
- Initialized: `lxd init` (use defaults)

### Setup

```bash
# Create Ubuntu 22.04 container
lxc launch ubuntu:22.04 ai-test

# Enter container
lxc exec ai-test -- /bin/bash

# Inside container - Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs git

# Clone and test
git clone https://github.com/ssfdre38/ai-security-scanner.git
cd ai-security-scanner
git checkout v4
cd web-ui
npm install
node server-new.js
```

### Cleanup

```bash
lxc stop ai-test
lxc delete ai-test
```

---

## Option 3: Multipass VM (Full Ubuntu VM)

### Prerequisites
- Multipass installed: `sudo snap install multipass`

### Setup

```bash
# Create Ubuntu 22.04 VM (2GB RAM, 10GB disk)
multipass launch 22.04 --name ai-test --memory 2G --disk 10G

# Enter VM
multipass shell ai-test

# Inside VM - Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
sudo apt-get install -y nodejs git

# Clone and test
git clone https://github.com/ssfdre38/ai-security-scanner.git
cd ai-security-scanner
git checkout v4
cd web-ui
npm install
node server-new.js
```

### VPN Testing

```bash
# Inside VM
cd ai-security-scanner
sudo ./scripts/install-vpn-all.sh
```

### Cleanup

```bash
# Exit VM
exit

# Delete VM
multipass delete ai-test
multipass purge
```

---

## Option 4: Current System Testing (Simplest)

If you want to test on the current system:

```bash
cd /home/ubuntu/ai-security-scanner

# Ensure on v4 branch
git checkout v4

# Pull latest
git pull origin v4

# Install/update dependencies
cd web-ui
npm install

# Start server
node server-new.js
```

### Test VPN Installers

```bash
# Back to project root
cd /home/ubuntu/ai-security-scanner

# Test in separate directory to avoid conflicts
mkdir -p ~/vpn-test
cd ~/vpn-test
cp ~/ai-security-scanner/scripts/install-*.sh .

# Run installer (installs actual VPN servers)
sudo ./install-vpn-all.sh
```

---

## Test Checklist

### Server Tests
- [ ] All 7 plugins load
- [ ] Server starts without errors
- [ ] All 98 routes registered
- [ ] Authentication works
- [ ] Admin endpoints respond

### VPN Tests
- [ ] WireGuard installer completes
- [ ] OpenVPN installer completes
- [ ] WireGuard status shows running
- [ ] OpenVPN status shows running
- [ ] Client config generation works
- [ ] VPN API endpoints respond

### API Tests

```bash
# Health check
curl http://localhost:3001/api/vpn/status

# Register user
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test","email":"test@example.com","password":"Test123!"}'

# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"Test123!"}'

# Get admin dashboard (requires admin token)
curl http://localhost:3001/api/admin/dashboard \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Expected Results

### Server Startup
```
✅ Loaded plugin: auth v1.0.0
✅ Loaded plugin: security v1.0.0
✅ Loaded plugin: scanner v1.0.0
✅ Loaded plugin: storage v1.0.0
✅ Loaded plugin: admin v1.0.0
✅ Loaded plugin: system-info v1.0.0
✅ Loaded plugin: vpn v1.0.0
Successfully loaded 7 plugins
Registered 7 routes from 7 plugins
```

### VPN Status (Before Installation)
```json
{
  "success": true,
  "data": {
    "wireguard": {
      "installed": false,
      "running": false
    },
    "openvpn": {
      "installed": false,
      "running": false
    }
  }
}
```

### VPN Status (After Installation)
```json
{
  "success": true,
  "data": {
    "wireguard": {
      "installed": true,
      "running": true,
      "connectedPeers": 0
    },
    "openvpn": {
      "installed": true,
      "running": true,
      "connectedClients": 0
    }
  }
}
```

---

## Troubleshooting

### Docker Build Slow
- Docker is downloading Ubuntu image and Node.js
- First build takes 5-10 minutes
- Subsequent builds use cache (faster)

### Permission Denied
```bash
# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker
```

### Port Already in Use
```bash
# Change PORT in .env file
PORT=3002

# Or stop conflicting service
sudo lsof -ti:3001 | xargs kill -9
```

### VPN Installation Fails
- Ensure running as root: `sudo ./install-*.sh`
- Check OS is supported: Ubuntu, Debian, CentOS, RHEL, Fedora
- Check internet connection for package downloads

---

## Performance Notes

### Minimal Requirements
- **CPU:** 1 core
- **RAM:** 1GB (2GB recommended)
- **Disk:** 5GB
- **Network:** Internet for package installation

### Recommended for Testing
- **CPU:** 2 cores
- **RAM:** 2GB
- **Disk:** 10GB
- **OS:** Ubuntu 22.04 LTS

---

## Next Steps After Testing

1. ✅ Verify all plugins load
2. ✅ Test API endpoints
3. ✅ Test VPN installers
4. ✅ Document any issues found
5. ✅ If all pass, merge v4 to main
6. ✅ Tag as v4.0.0 release
7. ✅ Deploy to production

---

**Created:** 2025-10-13 17:05 UTC  
**Version:** v4.0.0  
**Status:** Ready for testing
