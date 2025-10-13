#!/bin/bash

# AI Security Scanner v4.0.0 - Interactive Testing Script
# Fixed routes and enhanced visibility

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

# Configuration
API_URL="${API_URL:-http://localhost:3001}"
TEST_USER="testuser_$(date +%s)"
TEST_EMAIL="test_$(date +%s)@example.com"
TEST_PASSWORD="TestPass123!@#"
TOKEN=""

# Results
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_TOTAL=0
TESTS_SKIPPED=0

# Logging
LOG_FILE="test-results-$(date +%Y%m%d_%H%M%S).log"

# Interactive settings
INTERACTIVE="${INTERACTIVE:-yes}"
PAUSE_BETWEEN="${PAUSE_BETWEEN:-yes}"
SHOW_REQUESTS="${SHOW_REQUESTS:-yes}"
SHOW_RESPONSES="${SHOW_RESPONSES:-yes}"

# Functions
log() {
    echo -e "${1}" | tee -a "$LOG_FILE"
}

header() {
    echo ""
    log "${CYAN}═══════════════════════════════════════════════════════════${NC}"
    log "${CYAN}${1}${NC}"
    log "${CYAN}═══════════════════════════════════════════════════════════${NC}"
}

test_start() {
    TESTS_TOTAL=$((TESTS_TOTAL + 1))
    echo ""
    log "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    log "${MAGENTA}[TEST $TESTS_TOTAL] $1${NC}"
    log "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

test_pass() {
    TESTS_PASSED=$((TESTS_PASSED + 1))
    log "${GREEN}✅ PASS${NC}: $1"
}

test_fail() {
    TESTS_FAILED=$((TESTS_FAILED + 1))
    log "${RED}❌ FAIL${NC}: $1"
    [ -n "$2" ] && log "${RED}   Error:${NC} $2"
}

test_skip() {
    TESTS_SKIPPED=$((TESTS_SKIPPED + 1))
    log "${YELLOW}⏭️  SKIP${NC}: $1"
}

show_request() {
    [ "$SHOW_REQUESTS" = "yes" ] && log "${CYAN}→ Request:${NC} $1"
}

show_response() {
    if [ "$SHOW_RESPONSES" = "yes" ]; then
        log "${CYAN}← Response:${NC}"
        echo "$1" | jq '.' 2>/dev/null || echo "$1" | head -c 500
        echo ""
    fi
}

pause_if_interactive() {
    if [ "$PAUSE_BETWEEN" = "yes" ]; then
        echo ""
        log "${YELLOW}Press ENTER to continue, 's' to skip pauses, 'q' to quit...${NC}"
        read -r input
        if [ "$input" = "q" ]; then
            log "${RED}Testing aborted by user${NC}"
            print_summary
            exit 0
        elif [ "$input" = "s" ]; then
            PAUSE_BETWEEN="no"
            log "${YELLOW}Auto-continuing...${NC}"
        fi
    fi
}

api_call() {
    local method=$1
    local endpoint=$2
    local data=$3
    local auth=$4
    
    show_request "$method $endpoint"
    [ -n "$data" ] && [ "$SHOW_REQUESTS" = "yes" ] && log "${CYAN}   Data:${NC} $data"
    
    local cmd="curl -s -w '\n%{http_code}' -X $method '$API_URL$endpoint' -H 'Content-Type: application/json'"
    [ -n "$data" ] && cmd="$cmd -d '$data'"
    [ -n "$auth" ] && cmd="$cmd -H 'Authorization: Bearer $auth'"
    
    local response=$(eval $cmd 2>&1)
    local http_code=$(echo "$response" | tail -n 1)
    local body=$(echo "$response" | sed '$d')
    
    show_response "$body"
    [ "$SHOW_RESPONSES" = "yes" ] && log "${CYAN}   HTTP Status:${NC} $http_code"
    
    echo "$body"
}

print_summary() {
    header "TEST RESULTS SUMMARY"
    log ""
    log "Total Tests:    $TESTS_TOTAL"
    log "${GREEN}Passed:         $TESTS_PASSED${NC}"
    log "${RED}Failed:         $TESTS_FAILED${NC}"
    log "${YELLOW}Skipped:        $TESTS_SKIPPED${NC}"
    log ""
    
    if [ $TESTS_FAILED -eq 0 ]; then
        PASS_RATE=100
        log "${GREEN}✅ ALL TESTS PASSED!${NC}"
    else
        PASS_RATE=$((TESTS_PASSED * 100 / TESTS_TOTAL))
        log "${YELLOW}⚠️  Pass rate: ${PASS_RATE}%${NC}"
    fi
    
    log ""
    log "Test User: $TEST_USER"
    log "Log file: $LOG_FILE"
    log "Completed: $(date)"
    log ""
}

# Main
main() {
    clear
    header "AI Security Scanner v4.0.0 - Interactive Test Suite"
    log ""
    log "${CYAN}Configuration:${NC}"
    log "  API URL: $API_URL"
    log "  Test User: $TEST_USER"
    log "  Interactive: $INTERACTIVE"
    log "  Show Requests: $SHOW_REQUESTS"
    log "  Show Responses: $SHOW_RESPONSES"
    log "  Pause Between Tests: $PAUSE_BETWEEN"
    log "  Log File: $LOG_FILE"
    log ""
    
    # Check server
    log "${YELLOW}Checking server status...${NC}"
    if ! curl -s "$API_URL" >/dev/null 2>&1; then
        log "${RED}ERROR: Server not running at $API_URL${NC}"
        log "Start server: cd web-ui && node server-new.js"
        exit 1
    fi
    log "${GREEN}✓ Server is running${NC}"
    
    if [ "$INTERACTIVE" = "yes" ]; then
        log ""
        log "${YELLOW}Press ENTER to start testing...${NC}"
        read
    fi
    
    # ========================================
    # PHASE 1: AUTHENTICATION
    # ========================================
    header "PHASE 1: Authentication System (5 tests)"
    
    test_start "User Registration"
    RESPONSE=$(api_call POST "/api/auth/register" "{\"username\":\"$TEST_USER\",\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}")
    if echo "$RESPONSE" | grep -q "success\|token\|user"; then
        test_pass "User registered"
    else
        test_fail "Registration failed" "$RESPONSE"
    fi
    pause_if_interactive
    
    test_start "User Login"
    RESPONSE=$(api_call POST "/api/auth/login" "{\"username\":\"$TEST_USER\",\"password\":\"$TEST_PASSWORD\"}")
    TOKEN=$(echo "$RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
    if [ -n "$TOKEN" ]; then
        test_pass "Login successful"
        log "${CYAN}   Token:${NC} ${TOKEN:0:30}..."
    else
        test_fail "Login failed" "$RESPONSE"
    fi
    pause_if_interactive
    
    test_start "Get Session (authenticated)"
    if [ -n "$TOKEN" ]; then
        RESPONSE=$(api_call GET "/api/auth/session" "" "$TOKEN")
        if echo "$RESPONSE" | grep -q "$TEST_USER\|username"; then
            test_pass "Session retrieved"
        else
            test_fail "Session failed" "$RESPONSE"
        fi
    else
        test_skip "No token available"
    fi
    pause_if_interactive
    
    test_start "CSRF Token Generation"
    if [ -n "$TOKEN" ]; then
        RESPONSE=$(api_call GET "/api/auth/csrf-token" "" "$TOKEN")
        if echo "$RESPONSE" | grep -q "token\|csrf"; then
            test_pass "CSRF token generated"
        else
            test_fail "CSRF failed" "$RESPONSE"
        fi
    else
        test_skip "No token available"
    fi
    pause_if_interactive
    
    test_start "Protected Route (no auth)"
    RESPONSE=$(api_call GET "/api/auth/session" "")
    if echo "$RESPONSE" | grep -qi "unauthorized\|401\|authentication"; then
        test_pass "Auth enforced correctly"
    else
        test_fail "Auth not enforced" "$RESPONSE"
    fi
    pause_if_interactive
    
    # ========================================
    # PHASE 2: MFA
    # ========================================
    header "PHASE 2: Multi-Factor Authentication (3 tests)"
    
    if [ -n "$TOKEN" ]; then
        test_start "MFA Setup"
        RESPONSE=$(api_call POST "/api/auth/mfa/setup" "" "$TOKEN")
        if echo "$RESPONSE" | grep -q "secret\|qr\|mfa"; then
            test_pass "MFA setup successful"
        else
            test_fail "MFA setup failed" "$RESPONSE"
        fi
        pause_if_interactive
        
        test_start "MFA Backup Codes"
        RESPONSE=$(api_call GET "/api/auth/mfa/backup-codes" "" "$TOKEN")
        if echo "$RESPONSE" | grep -q "codes\|backup"; then
            test_pass "Backup codes generated"
        else
            test_fail "Backup codes failed" "$RESPONSE"
        fi
        pause_if_interactive
        
        test_start "MFA Disable"
        RESPONSE=$(api_call POST "/api/auth/mfa/disable" "" "$TOKEN")
        if echo "$RESPONSE" | grep -q "success\|disabled"; then
            test_pass "MFA disabled"
        else
            test_fail "MFA disable failed" "$RESPONSE"
        fi
        pause_if_interactive
    else
        test_skip "MFA tests - No token"
        test_skip "MFA tests - No token"
        test_skip "MFA tests - No token"
    fi
    
    # ========================================
    # PHASE 3: SECURITY
    # ========================================
    header "PHASE 3: Security Plugin (5 tests)"
    
    if [ -n "$TOKEN" ]; then
        test_start "Rate Limit Status"
        RESPONSE=$(api_call GET "/api/security/rate-limit/status" "" "$TOKEN")
        if echo "$RESPONSE" | grep -q "limit\|remaining\|rate"; then
            test_pass "Rate limit status retrieved"
        else
            test_fail "Rate limit failed" "$RESPONSE"
        fi
        pause_if_interactive
        
        test_start "CSRF Token"
        RESPONSE=$(api_call GET "/api/security/csrf-token" "" "$TOKEN")
        if echo "$RESPONSE" | grep -q "token\|csrf"; then
            test_pass "CSRF token retrieved"
        else
            test_fail "CSRF failed" "$RESPONSE"
        fi
        pause_if_interactive
        
        test_start "Input Validation (SQL Injection)"
        SQL_INJECT="admin' OR 1=1--"
        RESPONSE=$(api_call POST "/api/security/validate" "{\"input\":\"$SQL_INJECT\",\"type\":\"sql\"}" "$TOKEN")
        if echo "$RESPONSE" | grep -q "invalid\|dangerous\|blocked\|detected"; then
            test_pass "SQL injection detected"
        else
            test_fail "SQL not detected" "$RESPONSE"
        fi
        pause_if_interactive
        
        test_start "Data Encryption"
        RESPONSE=$(api_call POST "/api/security/encrypt" "{\"data\":\"Secret\",\"key\":\"test123\"}" "$TOKEN")
        if echo "$RESPONSE" | grep -q "encrypted\|cipher"; then
            test_pass "Encryption successful"
        else
            test_fail "Encryption failed" "$RESPONSE"
        fi
        pause_if_interactive
        
        test_start "Data Hashing"
        RESPONSE=$(api_call POST "/api/security/hash" "{\"data\":\"password123\"}" "$TOKEN")
        if echo "$RESPONSE" | grep -q "hash\|digest"; then
            test_pass "Hashing successful"
        else
            test_fail "Hashing failed" "$RESPONSE"
        fi
        pause_if_interactive
    else
        for i in {1..5}; do test_skip "Security tests - No token"; done
    fi
    
    # ========================================
    # PHASE 4: SCANNER
    # ========================================
    header "PHASE 4: Scanner Plugin (3 tests)"
    
    if [ -n "$TOKEN" ]; then
        test_start "Scanner Status"
        RESPONSE=$(api_call GET "/api/scanner/status" "" "$TOKEN")
        if echo "$RESPONSE" | grep -q "status\|scanner"; then
            test_pass "Scanner status retrieved"
        else
            test_fail "Scanner status failed" "$RESPONSE"
        fi
        pause_if_interactive
        
        test_start "Platform Detection"
        RESPONSE=$(api_call GET "/api/scanner/platform" "" "$TOKEN")
        if echo "$RESPONSE" | grep -q "platform\|linux\|windows"; then
            test_pass "Platform detected"
        else
            test_fail "Platform detection failed" "$RESPONSE"
        fi
        pause_if_interactive
        
        test_start "Available Scans"
        RESPONSE=$(api_call GET "/api/scanner/scans" "" "$TOKEN")
        if echo "$RESPONSE" | grep -q "scan\|available"; then
            test_pass "Scan list retrieved"
        else
            test_fail "Scan list failed" "$RESPONSE"
        fi
        pause_if_interactive
    else
        for i in {1..3}; do test_skip "Scanner tests - No token"; done
    fi
    
    # ========================================
    # PHASE 5: STORAGE
    # ========================================
    header "PHASE 5: Storage Plugin (3 tests)"
    
    if [ -n "$TOKEN" ]; then
        test_start "List Backups"
        RESPONSE=$(api_call GET "/api/storage/backup/list" "" "$TOKEN")
        if echo "$RESPONSE" | grep -q "backup\|list\|\["; then
            test_pass "Backup list retrieved"
        else
            test_fail "Backup list failed" "$RESPONSE"
        fi
        pause_if_interactive
        
        test_start "List Reports"
        RESPONSE=$(api_call GET "/api/storage/reports" "" "$TOKEN")
        if echo "$RESPONSE" | grep -q "report\|list\|\["; then
            test_pass "Report list retrieved"
        else
            test_fail "Report list failed" "$RESPONSE"
        fi
        pause_if_interactive
        
        test_start "Storage Status"
        RESPONSE=$(api_call GET "/api/storage/status" "" "$TOKEN")
        if echo "$RESPONSE" | grep -q "status\|storage\|disk"; then
            test_pass "Storage status retrieved"
        else
            test_fail "Storage status failed" "$RESPONSE"
        fi
        pause_if_interactive
    else
        for i in {1..3}; do test_skip "Storage tests - No token"; done
    fi
    
    # ========================================
    # PHASE 6: ADMIN
    # ========================================
    header "PHASE 6: Admin Plugin (5 tests)"
    
    if [ -n "$TOKEN" ]; then
        test_start "System Health"
        RESPONSE=$(api_call GET "/api/admin/system/health" "" "$TOKEN")
        if echo "$RESPONSE" | grep -q "health\|status\|cpu\|memory"; then
            test_pass "System health retrieved"
        else
            test_fail "Health check failed" "$RESPONSE"
        fi
        pause_if_interactive
        
        test_start "Resource Usage"
        RESPONSE=$(api_call GET "/api/admin/system/resources" "" "$TOKEN")
        if echo "$RESPONSE" | grep -q "cpu\|memory\|disk"; then
            test_pass "Resources retrieved"
        else
            test_fail "Resources failed" "$RESPONSE"
        fi
        pause_if_interactive
        
        test_start "Plugin Status"
        RESPONSE=$(api_call GET "/api/admin/system/plugins" "" "$TOKEN")
        if echo "$RESPONSE" | grep -q "plugin\|auth\|security"; then
            test_pass "Plugin status retrieved"
        else
            test_fail "Plugin status failed" "$RESPONSE"
        fi
        pause_if_interactive
        
        test_start "List Users"
        RESPONSE=$(api_call GET "/api/admin/users" "" "$TOKEN")
        if echo "$RESPONSE" | grep -q "user\|list\|\["; then
            test_pass "User list retrieved"
        else
            test_fail "User list failed" "$RESPONSE"
        fi
        pause_if_interactive
        
        test_start "Audit Logs"
        RESPONSE=$(api_call GET "/api/admin/audit/logs" "" "$TOKEN")
        if echo "$RESPONSE" | grep -q "log\|audit\|\["; then
            test_pass "Audit logs retrieved"
        else
            test_fail "Audit logs failed" "$RESPONSE"
        fi
        pause_if_interactive
    else
        for i in {1..5}; do test_skip "Admin tests - No token"; done
    fi
    
    # ========================================
    # PHASE 7: VPN
    # ========================================
    header "PHASE 7: VPN Plugin (3 tests)"
    
    if [ -n "$TOKEN" ]; then
        test_start "VPN Status"
        RESPONSE=$(api_call GET "/api/vpn/status" "" "$TOKEN")
        if echo "$RESPONSE" | grep -q "vpn\|status\|wireguard\|openvpn"; then
            test_pass "VPN status retrieved"
        else
            test_fail "VPN status failed" "$RESPONSE"
        fi
        pause_if_interactive
        
        test_start "WireGuard Status"
        RESPONSE=$(api_call GET "/api/vpn/wireguard/status" "" "$TOKEN")
        if echo "$RESPONSE" | grep -q "wireguard\|status"; then
            test_pass "WireGuard status retrieved"
        else
            test_fail "WireGuard status failed" "$RESPONSE"
        fi
        pause_if_interactive
        
        test_start "OpenVPN Status"
        RESPONSE=$(api_call GET "/api/vpn/openvpn/status" "" "$TOKEN")
        if echo "$RESPONSE" | grep -q "openvpn\|status"; then
            test_pass "OpenVPN status retrieved"
        else
            test_fail "OpenVPN status failed" "$RESPONSE"
        fi
        pause_if_interactive
    else
        for i in {1..3}; do test_skip "VPN tests - No token"; done
    fi
    
    # Summary
    print_summary
    
    # Exit code
    [ $TESTS_FAILED -gt 0 ] && exit 1 || exit 0
}

# Run
main "$@"
