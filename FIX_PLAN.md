# Plugin Integration Fix Plan
**Date:** 2025-10-13 06:53 UTC  
**Goal:** Fix auth + security plugin integration before proceeding  
**Approach:** Systematic fixes with testing after each step

---

## Current Status

✅ **What Works:**
- All 4 plugins load successfully
- PowerShell installed and working (v7.5.3)
- PS1 scripts execute on Linux
- Core architecture solid
- Individual services work

❌ **What's Broken:**
- Login endpoint returns 500 error
- Security middleware not applied
- Security API endpoints missing
- Plugins don't communicate

---

## Fix Order (Priority-Based)

### Fix 1: Apply Security Headers Middleware Globally
**Priority:** HIGH  
**Time:** 5 minutes  
**Impact:** All responses will have security headers

**File:** `web-ui/core/server.js`  
**Action:** Apply security headers after plugins load

### Fix 2: Add Security API Endpoints
**Priority:** HIGH  
**Time:** 15 minutes  
**Impact:** Enable encryption, validation, etc.

**File:** `web-ui/plugins/security/index.js`  
**Action:** Add REST endpoints for all security services

### Fix 3: Fix Login 500 Error
**Priority:** CRITICAL  
**Time:** 15 minutes  
**Impact:** Enable all auth testing

**File:** `web-ui/plugins/auth/index.js` and `auth-service.js`  
**Action:** Add error logging, fix database init

### Fix 4: Integrate Auth with Security
**Priority:** HIGH  
**Time:** 15 minutes  
**Impact:** Rate limiting, validation on auth endpoints

**File:** `web-ui/plugins/auth/index.js`  
**Action:** Use security services in auth routes

### Fix 5: Add Missing LDAP/CSRF Endpoints
**Priority:** MEDIUM  
**Time:** 10 minutes  
**Impact:** Complete API surface

**File:** `web-ui/plugins/auth/index.js`  
**Action:** Add LDAP status and CSRF token endpoints

---

**Total Estimated Time:** 60 minutes  
**Then:** Full test suite with bash + PowerShell scripts

---

## Testing Plan After Fixes

1. **Auth + Security Integration Test** (existing test suite)
2. **Bash Scripts Test** (security-scanner.sh, etc.)
3. **PowerShell Scripts Test** (SecurityScanner.ps1, etc.)
4. **Cross-Platform Validation**
5. **Full System Test**

**Expected Result:** 90%+ test pass rate

---

Let's do this systematically!
