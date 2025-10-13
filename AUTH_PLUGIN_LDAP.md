# Auth Plugin - LDAP/Active Directory Support

**Added:** 2025-10-13 06:10 UTC  
**Status:** ✅ Complete

---

## Overview

The Auth plugin now includes comprehensive LDAP/Active Directory support for enterprise single sign-on (SSO) and centralized user management.

### Authentication Methods Supported:

1. ✅ **Local Users** - Database authentication
2. ✅ **MFA/2FA** - Time-based OTP with QR codes
3. ✅ **OAuth** - Google, Microsoft
4. ✅ **LDAP** - Standard LDAP servers
5. ✅ **Active Directory** - Microsoft AD integration

---

## LDAP Service Features

### Core Capabilities:
- ✅ LDAP authentication
- ✅ Active Directory support
- ✅ User search and discovery
- ✅ Group membership detection
- ✅ Role mapping from groups
- ✅ Connection verification
- ✅ TLS/SSL support
- ✅ Fallback to local auth

### Configuration:

Set via environment variables:

```bash
# Enable LDAP
LDAP_ENABLED=true

# LDAP Server
LDAP_URL=ldap://ldap.example.com:389
# or for LDAPS
LDAP_URL=ldaps://ldap.example.com:636

# Service Account (for searches)
LDAP_BIND_DN=cn=service,ou=users,dc=example,dc=com
LDAP_BIND_PASSWORD=servicepass

# Base DN
LDAP_BASE_DN=dc=example,dc=com
LDAP_USER_SEARCH_BASE=ou=users,dc=example,dc=com
LDAP_GROUP_SEARCH_BASE=ou=groups,dc=example,dc=com

# Attribute Mapping
LDAP_USERNAME_ATTR=uid
LDAP_EMAIL_ATTR=mail
LDAP_NAME_ATTR=cn
LDAP_GROUP_ATTR=memberOf

# TLS Options
LDAP_TLS_REJECT_UNAUTHORIZED=true
```

### Active Directory Configuration:

```bash
# Enable AD mode
LDAP_ENABLED=true
LDAP_IS_AD=true

# AD Server
LDAP_URL=ldap://ad.company.com:389

# AD Domain
AD_DOMAIN=COMPANY

# Users can login with:
# - user@company.com (UPN format)
# - COMPANY\user (domain format)
# - user (will be converted to COMPANY\user)

# Base DN
LDAP_BASE_DN=dc=company,dc=com
LDAP_USER_SEARCH_BASE=cn=users,dc=company,dc=com

# AD Attributes
LDAP_USERNAME_ATTR=sAMAccountName
LDAP_EMAIL_ATTR=userPrincipalName
LDAP_NAME_ATTR=displayName
LDAP_GROUP_ATTR=memberOf
```

---

## API Endpoints

### User Authentication:

```bash
# Login with LDAP
POST /api/auth/login
{
  "username": "jdoe",
  "password": "password123",
  "useLDAP": true
}

# Auto-detects LDAP if enabled
POST /api/auth/login
{
  "username": "jdoe@company.com",
  "password": "password123"
}
```

### LDAP Management (Admin Only):

```bash
# Check LDAP status
GET /api/auth/ldap/status

Response:
{
  "success": true,
  "data": {
    "enabled": true,
    "url": "ldap://ldap.example.com:389",
    "baseDN": "dc=example,dc=com",
    "isActiveDirectory": false,
    "configured": true
  }
}

# Verify LDAP connection
POST /api/auth/ldap/verify

Response:
{
  "success": true,
  "message": "LDAP connection successful"
}

# Search LDAP users
POST /api/auth/ldap/search
{
  "search": "john",
  "limit": 10
}

Response:
{
  "success": true,
  "users": [
    {
      "username": "jdoe",
      "email": "jdoe@example.com",
      "name": "John Doe"
    }
  ]
}
```

---

## Group to Role Mapping

Map LDAP/AD groups to application roles:

### Configuration (in ldap-service.js):

```javascript
roleMapping: {
  'cn=admins,ou=groups,dc=example,dc=com': 'admin',
  'cn=security,ou=groups,dc=example,dc=com': 'security_analyst',
  'cn=users,ou=groups,dc=example,dc=com': 'user'
}
```

### How It Works:

1. User authenticates via LDAP
2. System queries user's group memberships
3. Groups are mapped to application roles
4. User gets highest privilege role found
5. Defaults to 'user' role if no mapping found

### Active Directory Example:

```javascript
roleMapping: {
  'CN=Domain Admins,CN=Users,DC=company,DC=com': 'admin',
  'CN=Security Team,OU=Groups,DC=company,DC=com': 'security_analyst',
  'CN=Developers,OU=Groups,DC=company,DC=com': 'developer',
  'CN=Domain Users,CN=Users,DC=company,DC=com': 'user'
}
```

---

## Authentication Flow

### With LDAP Enabled:

```
1. User submits credentials
   ↓
2. Check if LDAP enabled
   ↓
3. Try LDAP authentication
   ↓
4. If LDAP succeeds:
   - Get user info from LDAP
   - Get group memberships
   - Map groups to roles
   - Create local session
   - Return success
   ↓
5. If LDAP fails:
   - Fall back to local auth
   - Try local database
   - Return result
```

### Benefits:
- ✅ Single Sign-On (SSO)
- ✅ Centralized user management
- ✅ No password storage needed
- ✅ Automatic role assignment
- ✅ Graceful fallback to local auth
- ✅ Works with existing AD infrastructure

---

## Examples

### Standard LDAP (OpenLDAP):

```bash
# Environment variables
export LDAP_ENABLED=true
export LDAP_URL=ldap://ldap.example.com:389
export LDAP_BIND_DN=cn=admin,dc=example,dc=com
export LDAP_BIND_PASSWORD=adminpass
export LDAP_BASE_DN=dc=example,dc=com
export LDAP_USER_SEARCH_BASE=ou=people,dc=example,dc=com
export LDAP_USERNAME_ATTR=uid
export LDAP_EMAIL_ATTR=mail

# Start server
node server-new.js

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "jdoe", "password": "secret"}'
```

### Active Directory:

```bash
# Environment variables
export LDAP_ENABLED=true
export LDAP_IS_AD=true
export LDAP_URL=ldap://ad.company.com:389
export AD_DOMAIN=COMPANY
export LDAP_BASE_DN=dc=company,dc=com
export LDAP_USER_SEARCH_BASE=cn=users,dc=company,dc=com
export LDAP_USERNAME_ATTR=sAMAccountName
export LDAP_EMAIL_ATTR=userPrincipalName

# Start server
node server-new.js

# Login (multiple formats supported)
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "jdoe@company.com", "password": "secret"}'

# Or
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "COMPANY\\jdoe", "password": "secret"}'

# Or
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "jdoe", "password": "secret"}'
```

---

## Security Features

### TLS/SSL Support:
```bash
# Use LDAPS (LDAP over SSL)
LDAP_URL=ldaps://ldap.example.com:636

# Or use StartTLS
LDAP_URL=ldap://ldap.example.com:389
# (StartTLS negotiated automatically)

# Certificate validation
LDAP_TLS_REJECT_UNAUTHORIZED=true  # Verify certificates (default)
LDAP_TLS_REJECT_UNAUTHORIZED=false # Accept self-signed (dev only!)
```

### Connection Security:
- ✅ Timeouts prevent hanging
- ✅ Connection pooling ready
- ✅ Credentials never logged
- ✅ Service account with minimal permissions
- ✅ Read-only LDAP access

### Integration with IDS:
- Failed LDAP attempts tracked
- IP blocking still applies
- Suspicious activity detected
- Notifications sent on attacks

---

## Deployment Scenarios

### Scenario 1: Small Business (OpenLDAP)
- Local LDAP server
- Few users
- Simple group structure
- Direct LDAP auth

### Scenario 2: Enterprise (Active Directory)
- Microsoft AD infrastructure
- Thousands of users
- Complex OU structure
- Multiple domains
- Group-based access control

### Scenario 3: Hybrid
- Some users in LDAP/AD
- Some local accounts
- Contractors use local
- Employees use LDAP
- Fallback ensures access

### Scenario 4: Multi-Domain
- Multiple AD forests
- Configure multiple LDAP services
- Route by domain suffix
- Unified authentication

---

## Troubleshooting

### Connection Issues:

```bash
# Test LDAP connection
curl -X POST http://localhost:3000/api/auth/ldap/verify \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Check logs
tail -f logs/ai-security-scanner-YYYY-MM-DD.log | grep LDAP
```

### Common Problems:

**Can't connect:**
- Check LDAP_URL is correct
- Verify firewall allows port 389/636
- Test with ldapsearch command

**Authentication fails:**
- Verify LDAP_BASE_DN is correct
- Check username attribute matches
- Ensure user exists in search base
- Verify password is correct

**Groups not mapping:**
- Check LDAP_GROUP_SEARCH_BASE
- Verify group DN format
- Update roleMapping configuration
- Check user is member of group

---

## Dependencies

Required npm package:
```bash
npm install ldapjs
```

Already included in package.json.

---

## Summary

The Auth plugin now provides **complete enterprise authentication**:

- ✅ **5 authentication methods**
- ✅ **LDAP/AD integration**
- ✅ **Group-based roles**
- ✅ **Fallback to local auth**
- ✅ **Admin management APIs**
- ✅ **Production-ready**

Perfect for:
- Enterprise deployments
- Corporate environments
- Existing AD infrastructure
- Centralized user management
- Single Sign-On requirements

---

**Status:** ✅ LDAP/AD Support Complete!  
**Files:** 7 files total in auth plugin  
**Lines of Code:** ~1,000 lines  
**Ready:** Production deployment!
