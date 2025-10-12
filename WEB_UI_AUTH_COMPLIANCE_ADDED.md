# Web UI Authentication & Compliance Integration ✅

**Date:** October 12, 2025  
**Status:** Ready for Integration  

## Overview

Added comprehensive user authentication system and OpenSCAP/DISA STIG compliance scanning to the AI Security Scanner Web UI.

## 🔐 Authentication System

### Backend Components

**1. Authentication Module** (`web-ui/auth.js`)
- Password hashing with PBKDF2 + salt
- Session management with token-based auth
- User management (CRUD operations)
- Role-based access control (admin/user)
- Session expiration and cleanup
- Secure password policies

**2. Authentication Routes** (`web-ui/routes/auth.js`)
- `/api/auth/setup/needed` - Check if initial setup required
- `/api/auth/setup` - Create initial admin account
- `/api/auth/login` - User login
- `/api/auth/logout` - User logout
- `/api/auth/me` - Get current user info
- `/api/auth/users` - List all users (admin)
- `/api/auth/users` (POST) - Add new user (admin)
- `/api/auth/users/:id` (DELETE) - Delete user (admin)
- `/api/auth/password` (PUT) - Update password
- `/api/auth/users/:id/password` (PUT) - Reset user password (admin)

### Frontend Components

**1. Initial Setup Page** (`web-ui/public/setup.html`)
- First-time setup wizard
- Create initial admin account
- Password strength indicator
- Email configuration (optional)
- Automatic redirect to login

**2. Login Page** (`web-ui/public/login.html`)
- Clean, modern design
- Username/password authentication
- Error handling
- Auto-redirect to setup if needed
- Token storage in localStorage

**3. User Management Page** (`web-ui/public/users.html`)
- Admin-only access
- List all users
- Add new users
- Delete users
- Reset passwords
- Role management (admin/user)

**4. Frontend Auth Manager** (`web-ui/public/js/auth.js`)
- Authentication state management
- Token handling
- API call wrapper with auth headers
- Auto-logout on 401
- User role checking

## 🛡️ Compliance Scanning Integration

### Backend Routes

**Compliance Routes** (`web-ui/routes/compliance.js`)

**Standard Compliance:**
- `/api/compliance/scan` (POST) - Run PCI-DSS, HIPAA, SOC2, GDPR scans

**OpenSCAP:**
- `/api/compliance/openscap` (POST) - Run OpenSCAP security scans
- `/api/compliance/openscap/profiles` (GET) - List available security profiles
- `/api/compliance/openscap/status` (GET) - Check OpenSCAP installation status

**DISA STIG:**
- `/api/compliance/disa-stig` (POST) - Run DISA STIG compliance scans

### Frontend Components

**Compliance Scanner** (`web-ui/public/js/compliance.js`)
- OpenSCAP scan controls
- DISA STIG scan controls
- Standard compliance scan controls
- Profile selection
- Real-time scan output via WebSocket
- OpenSCAP installation status check
- Safety warnings for auto-fix

## 📊 Features Implemented

### Authentication Features
✅ Initial setup wizard for first admin account  
✅ Secure login/logout  
✅ Session management with 24-hour expiration  
✅ Password hashing (PBKDF2 + salt)  
✅ Token-based authentication  
✅ Role-based access control (admin/user)  
✅ User management (admin only)  
✅ Password reset functionality  
✅ Session cleanup (automatic hourly)  
✅ Protected API endpoints  

### Compliance Features
✅ OpenSCAP security scanning (8+ profiles)  
✅ DISA STIG DoD compliance scanning  
✅ Standard compliance scans (PCI-DSS, HIPAA, etc.)  
✅ Profile selection and management  
✅ AI-powered analysis integration  
✅ Notification system integration  
✅ Real-time scan output  
✅ Installation status checking  
✅ Safety warnings for auto-fix  

## 🚀 Quick Start

### 1. Server Setup

The authentication routes and compliance routes are already integrated into `server.js`. All API endpoints are now protected and require authentication (except `/api/auth/*` endpoints).

### 2. First Time Setup

```bash
# Start the web UI
cd web-ui
npm start

# Navigate to http://localhost:3000
# You'll be redirected to /setup.html
```

**Setup Process:**
1. Create admin username and password
2. Provide email (optional)
3. System creates first admin account
4. Redirects to login page

### 3. Login

```bash
# Navigate to http://localhost:3000
# You'll be redirected to /login.html if not authenticated
```

**Login:**
1. Enter username and password
2. System validates credentials
3. Redirects to main dashboard

### 4. User Management (Admin Only)

```bash
# Navigate to http://localhost:3000/users.html
# Or add a link in the main UI navigation
```

**Features:**
- View all users
- Add new users
- Delete users (cannot delete yourself or last admin)
- Reset passwords
- Assign roles (admin/user)

## 📝 Integration Tasks

### Required Updates to index.html

**1. Add Authentication Scripts**
```html
<!-- Add before closing </body> tag -->
<script src="/js/auth.js"></script>
<script src="/js/compliance.js"></script>
```

**2. Add User Info to Header**
```html
<!-- The auth.js script will automatically add user info -->
<!-- No manual changes needed, handled by initializeApp() -->
```

**3. Add Compliance Tab**

Add this to the navigation tabs section:
```html
<button class="tab-button" data-tab="compliance">🛡️ Compliance</button>
```

Add this tab content section:
```html
<!-- Compliance Tab -->
<div class="tab-content" id="compliance">
    <div class="compliance-grid">
        <!-- Standard Compliance -->
        <div class="card">
            <h2>📋 Standard Compliance</h2>
            <p>PCI-DSS, HIPAA, SOC2, GDPR</p>
            <form id="complianceForm">
                <div class="form-group">
                    <label>Framework:</label>
                    <select id="complianceFramework">
                        <option value="pci-dss">PCI-DSS</option>
                        <option value="hipaa">HIPAA</option>
                        <option value="soc2">SOC 2</option>
                        <option value="gdpr">GDPR</option>
                        <option value="all">All Frameworks</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="complianceNotify">
                        Send notifications
                    </label>
                </div>
                <button type="submit" class="btn">Run Compliance Scan</button>
            </form>
        </div>

        <!-- OpenSCAP -->
        <div class="card">
            <h2>🔒 OpenSCAP Security Scanning</h2>
            <p>200+ automated security checks</p>
            
            <div id="openscapInstallMsg" class="alert" style="display: none;">
                ⚠️ OpenSCAP not installed. Run: <code>cd scripts && sudo ./install-openscap.sh</code>
            </div>
            
            <form id="openscapForm">
                <div class="form-group">
                    <label>Security Profile:</label>
                    <select id="openscapProfile">
                        <option value="standard">Standard Security</option>
                        <option value="cis">CIS Benchmark</option>
                        <option value="pci-dss">PCI-DSS</option>
                        <option value="hipaa">HIPAA</option>
                        <option value="stig">DISA STIG</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="openscapAnalyze">
                        AI Analysis
                    </label>
                </div>
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="openscapNotify">
                        Send notifications
                    </label>
                </div>
                <button type="submit" class="btn">Run OpenSCAP Scan</button>
            </form>
            
            <div style="margin-top: 15px; font-size: 13px; color: #666;">
                Status: <span id="openscapStatus">Checking...</span>
            </div>
        </div>

        <!-- DISA STIG -->
        <div class="card">
            <h2>🎖️ DISA STIG</h2>
            <p>DoD/Government Compliance (300+ checks)</p>
            <form id="disaStigForm">
                <div class="form-group">
                    <label>Category:</label>
                    <select id="stigCategory">
                        <option value="">All Categories</option>
                        <option value="CAT1">CAT I (Critical)</option>
                        <option value="CAT2">CAT II (Medium)</option>
                        <option value="CAT3">CAT III (Low)</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="stigAnalyze">
                        AI Analysis
                    </label>
                </div>
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="stigNotify">
                        Send notifications
                    </label>
                </div>
                <button type="submit" class="btn">Run DISA STIG Scan</button>
            </form>
        </div>
    </div>
</div>
```

**4. Add User Management Link (Admin Only)**
```html
<!-- Add to navigation or system tab -->
<div class="admin-only" style="display: none;">
    <a href="/users.html" class="btn">👥 Manage Users</a>
</div>
```

**5. Add Logout Button**
```html
<!-- Add to header (will be added automatically by auth.js) -->
<!-- Or add manually in header section -->
<button onclick="authManager.logout()" class="btn-logout">Logout</button>
```

### CSS Updates Needed

Add to `style.css`:
```css
/* User info in header */
.user-info {
    display: flex;
    align-items: center;
    gap: 10px;
}

.user-name {
    font-weight: 500;
}

.admin-badge {
    background: #ff9800;
    color: white;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
}

.btn-logout {
    padding: 6px 12px;
    background: #f44336;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 13px;
}

.btn-logout:hover {
    background: #d32f2f;
}

.admin-only {
    /* Initially hidden, shown by auth.js for admins */
}

/* Compliance grid */
.compliance-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
    gap: 20px;
}

.form-group {
    margin-bottom: 15px;
}

.form-group label {
    display: block;
    margin-bottom: 5px;
    font-weight: 500;
}

.form-group select,
.form-group input[type="text"] {
    width: 100%;
    padding: 8px;
    border: 1px solid #ddd;
    border-radius: 4px;
}

.alert {
    background: #fff3cd;
    border: 1px solid #ffc107;
    padding: 10px;
    border-radius: 4px;
    margin-bottom: 15px;
    font-size: 13px;
}

.alert code {
    background: #f5f5f5;
    padding: 2px 6px;
    border-radius: 3px;
    font-family: monospace;
}
```

## 🔒 Security Features

### Password Security
- PBKDF2 hashing with 100,000 iterations
- Random salt for each password
- Minimum 8 character requirement
- Password strength indicator on setup

### Session Security
- Token-based authentication
- 24-hour session expiration
- Automatic session cleanup
- Secure token storage

### API Security
- All endpoints protected (except auth endpoints)
- Role-based access control
- Admin-only endpoints for user management
- Input validation and sanitization

### Safety Features
- Cannot delete yourself
- Cannot delete last admin
- Confirmation dialogs for destructive actions
- Auto-fix warnings for compliance scans

## 📂 File Structure

```
web-ui/
├── auth.js                          # Backend auth module
├── server.js                        # Updated with auth middleware
├── data/                            # Created automatically
│   ├── users.json                   # User accounts
│   └── sessions.json                # Active sessions
├── routes/
│   ├── auth.js                      # Auth API routes
│   └── compliance.js                # Compliance API routes
└── public/
    ├── login.html                   # Login page
    ├── setup.html                   # Initial setup
    ├── users.html                   # User management
    ├── index.html                   # Main dashboard (needs updates)
    └── js/
        ├── auth.js                  # Frontend auth manager
        └── compliance.js            # Frontend compliance scanner
```

## 🧪 Testing

### Test Authentication

**1. Initial Setup:**
```bash
# Delete existing users (if testing)
rm -rf web-ui/data/

# Start server
cd web-ui && npm start

# Navigate to http://localhost:3000
# Should redirect to /setup.html
```

**2. Create Admin:**
- Username: admin
- Password: Admin123!
- Email: admin@example.com

**3. Test Login:**
- Should redirect to /login.html
- Login with admin credentials
- Should redirect to dashboard

**4. Test User Management:**
- Navigate to /users.html
- Add a new user
- Reset password
- Delete user

### Test Compliance Scanning

**1. Check OpenSCAP Status:**
- Go to Compliance tab
- Check if OpenSCAP is installed
- If not, follow install instructions

**2. Run OpenSCAP Scan:**
- Select profile (e.g., "Standard Security")
- Check "AI Analysis"
- Click "Run OpenSCAP Scan"
- Monitor output in activity log

**3. Run DISA STIG Scan:**
- Select category (e.g., "CAT I")
- Check "AI Analysis"
- Click "Run DISA STIG Scan"
- Wait for completion

## 🚨 Important Notes

### Before Going to Production

1. **Change Default Setup:**
   - Use strong admin password
   - Configure email for password recovery
   - Set up HTTPS/SSL

2. **Security Hardening:**
   - Use environment variables for secrets
   - Enable rate limiting on auth endpoints
   - Add CSRF protection
   - Implement password reset via email

3. **Backup:**
   - Backup `web-ui/data/` directory
   - Contains all user accounts and sessions

4. **Monitoring:**
   - Monitor failed login attempts
   - Set up alerts for admin actions
   - Log all security events

### Known Limitations

- Sessions stored in JSON file (consider Redis for production)
- Password reset requires admin intervention
- No email verification
- No 2FA (consider adding for production)
- File-based user storage (consider database for scale)

## ✅ Next Steps

1. **Complete index.html Integration:**
   - Add compliance tab content
   - Add authentication scripts
   - Add user info display
   - Add logout button

2. **Test Everything:**
   - Test initial setup
   - Test login/logout
   - Test user management
   - Test compliance scans
   - Test role permissions

3. **Optional Enhancements:**
   - Add email-based password reset
   - Add 2FA support
   - Add session management UI
   - Add audit log viewer
   - Add user activity tracking

4. **Documentation:**
   - Update main README
   - Create user guide
   - Document API endpoints
   - Add security best practices

## 📚 API Documentation

### Authentication Endpoints

```
POST /api/auth/setup
  Body: { username, password, email }
  Returns: { success, user }

POST /api/auth/login
  Body: { username, password }
  Returns: { token, user }

POST /api/auth/logout
  Headers: Authorization: Bearer <token>
  Returns: { success }

GET /api/auth/me
  Headers: Authorization: Bearer <token>
  Returns: { user }

GET /api/auth/users (admin)
  Headers: Authorization: Bearer <token>
  Returns: { users: [...] }

POST /api/auth/users (admin)
  Headers: Authorization: Bearer <token>
  Body: { username, password, email, role }
  Returns: { success, user }

DELETE /api/auth/users/:userId (admin)
  Headers: Authorization: Bearer <token>
  Returns: { success }
```

### Compliance Endpoints

```
POST /api/compliance/scan
  Headers: Authorization: Bearer <token>
  Body: { framework, notify }
  Returns: { success, framework }

POST /api/compliance/openscap
  Headers: Authorization: Bearer <token>
  Body: { profile, analyze, fix, notify }
  Returns: { success, profile }

POST /api/compliance/disa-stig
  Headers: Authorization: Bearer <token>
  Body: { category, analyze, fix, notify }
  Returns: { success, category }

GET /api/compliance/openscap/profiles
  Headers: Authorization: Bearer <token>
  Returns: { profiles: [...] }

GET /api/compliance/openscap/status
  Headers: Authorization: Bearer <token>
  Returns: { installed, contentAvailable, contentFiles }
```

---

**Status:** ✅ Ready for Integration  
**Files Created:** 8 files  
**Lines of Code:** ~4,000 lines  
**Testing:** Ready for manual testing  
**Production Ready:** After index.html integration and testing  

Made with ❤️ for the security community
