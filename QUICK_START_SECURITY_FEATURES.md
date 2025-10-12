# Quick Start Guide - Security Features v3.1.0

## 🚀 Quick Setup (5 Minutes)

### 1. Install Dependencies

```bash
cd /home/ubuntu/ai-security-scanner/web-ui
npm install
```

### 2. Configure Environment

```bash
# Copy example configuration
cp .env.example .env

# Generate secure keys
node -e "console.log('SESSION_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('MFA_ENCRYPTION_KEY=' + require('crypto').randomBytes(32).toString('hex'))"

# Add the generated keys to .env file
nano .env
```

### 3. Start Server

```bash
cd /home/ubuntu/ai-security-scanner/web-ui
node server.js
```

### 4. Access Web UI

Open browser: `http://localhost:3000`

---

## 🔐 Enable MFA (2-Factor Authentication)

### For Users

1. **Login** to your account
2. **Go to Settings** or Profile
3. **Click "Enable MFA"**
4. **Scan QR code** with Google Authenticator or Microsoft Authenticator
5. **Enter 6-digit code** to verify
6. **Save backup codes** securely
7. **Done!** MFA is now enabled

### API Method

```bash
# 1. Setup MFA
curl -X POST http://localhost:3000/api/auth/mfa/setup \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"

# Response includes QR code and backup codes

# 2. Enable MFA (verify with token from authenticator)
curl -X POST http://localhost:3000/api/auth/mfa/enable \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"token":"123456"}'
```

---

## 🔑 Setup OAuth (Optional)

### Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create project → Enable OAuth 2.0
3. Add redirect URI: `http://localhost:3000/api/auth/google/callback`
4. Copy credentials to `.env`:
```bash
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback
```

### Microsoft OAuth

1. Go to [Azure Portal](https://portal.azure.com/)
2. Azure Active Directory → App Registrations → New
3. Add redirect URI: `http://localhost:3000/api/auth/microsoft/callback`
4. Copy credentials to `.env`:
```bash
MICROSOFT_CLIENT_ID=your-application-id
MICROSOFT_CLIENT_SECRET=your-client-secret
MICROSOFT_CALLBACK_URL=http://localhost:3000/api/auth/microsoft/callback
```

---

## 📦 Backup Your System

### Manual Backup

```bash
# Create backup
curl -X POST http://localhost:3000/api/admin/backup/create \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# List backups
curl http://localhost:3000/api/admin/backup/list \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Download backup
curl http://localhost:3000/api/admin/backup/download/backup-2025-10-12.zip \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -o backup.zip
```

### Automated Backup

Edit `.env`:
```bash
AUTO_BACKUP_ENABLED=true
AUTO_BACKUP_SCHEDULE=0 2 * * *  # Daily at 2 AM
```

Restart server for changes to take effect.

---

## 📊 View Audit Logs

```bash
# Get recent logs
curl "http://localhost:3000/api/admin/audit/logs?limit=50" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Get logs for date range
curl "http://localhost:3000/api/admin/audit/logs?startDate=2025-10-01&endDate=2025-10-12" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Get statistics
curl http://localhost:3000/api/admin/audit/stats?days=7 \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

---

## 🏥 System Health Check

```bash
curl http://localhost:3000/api/admin/health \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

---

## 🔒 SSL/HTTPS Setup (Production)

### Option 1: Let's Encrypt (Recommended)

```bash
# Install certbot
sudo apt install certbot

# Get certificate
sudo certbot certonly --standalone -d yourdomain.com

# Update .env
SSL_CERT_PATH=/etc/letsencrypt/live/yourdomain.com/fullchain.pem
SSL_KEY_PATH=/etc/letsencrypt/live/yourdomain.com/privkey.pem
FORCE_HTTPS=true
```

### Option 2: Self-Signed (Testing Only)

```bash
# Generate certificate
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes

# Update .env
SSL_CERT_PATH=/path/to/cert.pem
SSL_KEY_PATH=/path/to/key.pem
```

---

## ⚙️ Rate Limiting Configuration

Edit `.env` to adjust limits:

```bash
# Authentication (login/signup)
AUTH_RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
AUTH_RATE_LIMIT_MAX=5              # 5 attempts

# API endpoints
API_RATE_LIMIT_WINDOW_MS=60000     # 1 minute
API_RATE_LIMIT_MAX=100             # 100 requests

# Scan endpoints
SCAN_RATE_LIMIT_WINDOW_MS=300000   # 5 minutes
SCAN_RATE_LIMIT_MAX=10             # 10 scans
```

---

## 🧪 Testing Security Features

### Test MFA

```bash
# 1. Setup MFA
TOKEN="your-session-token"
curl -X POST http://localhost:3000/api/auth/mfa/setup \
  -H "Authorization: Bearer $TOKEN" | jq .

# 2. Get 6-digit code from authenticator app

# 3. Enable MFA
curl -X POST http://localhost:3000/api/auth/mfa/enable \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"token":"123456"}'

# 4. Login with MFA
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"yourpass","mfaToken":"123456"}'
```

### Test Rate Limiting

```bash
# Try 6 failed login attempts (should be rate limited)
for i in {1..6}; do
  curl -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"test","password":"wrong"}' \
    -w "\nAttempt $i: %{http_code}\n"
  sleep 1
done
```

### Test Backup

```bash
# Create backup
curl -X POST http://localhost:3000/api/admin/backup/create \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .

# List backups
curl http://localhost:3000/api/admin/backup/list \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .
```

---

## 📱 Compatible Authenticator Apps

### Google Authenticator
- **iOS:** [App Store](https://apps.apple.com/app/google-authenticator/id388497605)
- **Android:** [Google Play](https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2)

### Microsoft Authenticator
- **iOS:** [App Store](https://apps.apple.com/app/microsoft-authenticator/id983156458)
- **Android:** [Google Play](https://play.google.com/store/apps/details?id=com.azure.authenticator)

### Other Options
- Authy (iOS/Android/Desktop)
- 1Password (iOS/Android/Desktop)
- LastPass Authenticator
- Any TOTP-compatible app

---

## 🚨 Emergency Procedures

### Lost MFA Device

Use backup codes to login:
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"yourpass","mfaToken":"BACKUP-CODE"}'
```

### Disable MFA (Emergency)

Admin can disable for user by editing `web-ui/data/mfa.json` (requires server restart).

### Restore from Backup

```bash
curl -X POST http://localhost:3000/api/admin/backup/restore \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"filename":"backup-2025-10-12.zip"}'

# Restart server after restore
```

### Locked Out (Rate Limited)

Wait for rate limit window to expire (15 minutes for auth), or restart server to reset in-memory limits.

---

## 📖 Additional Resources

- **Full Documentation:** `SECURITY_ENHANCEMENTS_v3.1.0.md`
- **Environment Config:** `.env.example`
- **API Documentation:** See routes files in `web-ui/routes/`
- **Audit Logs:** `web-ui/logs/audit-*.log`
- **System Health:** `GET /api/admin/health`

---

## ✅ Production Checklist

Before deploying to production:

- [ ] Set `NODE_ENV=production`
- [ ] Generate strong random keys
- [ ] Enable SSL/HTTPS
- [ ] Configure OAuth (if needed)
- [ ] Enable automated backups
- [ ] Set appropriate rate limits
- [ ] Test MFA functionality
- [ ] Review audit log settings
- [ ] Test backup/restore
- [ ] Configure firewall rules
- [ ] Set up monitoring
- [ ] Test all authentication flows
- [ ] Secure `.env` file permissions
- [ ] Document emergency procedures

---

## 🆘 Support

**Issues?**
- Check logs: `web-ui/logs/`
- System health: `/api/admin/health`
- Audit logs: `/api/admin/audit/logs`
- GitHub Issues: Report bugs

**Questions?**
- Documentation: `SECURITY_ENHANCEMENTS_v3.1.0.md`
- API Examples: This file
- Community: GitHub Discussions

---

**Version:** 3.1.0  
**Last Updated:** October 12, 2025  
**Status:** Production Ready ✅
