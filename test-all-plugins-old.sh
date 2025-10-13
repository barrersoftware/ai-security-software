#!/bin/bash

# AI Security Scanner v4.0.0 - Comprehensive Plugin Testing Script
# Based on V5_GAP_ANALYSIS.md testing phases

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Test configuration
API_URL="${API_URL:-http://localhost:3001}"
TEST_USER="testuser_$(date +%s)"
TEST_EMAIL="test_$(date +%s)@example.com"
TEST_PASSWORD="TestPass123!@#"
TOKEN=""
ADMIN_TOKEN=""

# Test results
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_TOTAL=0
TESTS_SKIPPED=0

# Logging
LOG_FILE="test-results-$(date +%Y%m%d_%H%M%S).log"

# Interactive mode
INTERACTIVE="${INTERACTIVE:-yes}"
PAUSE_BETWEEN_TESTS="${PAUSE_BETWEEN_TESTS:-yes}"
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
    if [ -n "$2" ]; then
        log "${RED}   Error:${NC} $2"
    fi
}

test_skip() {
    TESTS_SKIPPED=$((TESTS_SKIPPED + 1))
    log "${YELLOW}⏭️  SKIP${NC}: $1"
}

show_request() {
    if [ "$SHOW_REQUESTS" = "yes" ]; then
        log "${CYAN}→ Request:${NC} $1"
    fi
}

show_response() {
    if [ "$SHOW_RESPONSES" = "yes" ]; then
        log "${CYAN}← Response:${NC}"
        echo "$1" | jq '.' 2>/dev/null || echo "$1" | head -c 500
        echo ""
    fi
}

pause_if_interactive() {
    if [ "$PAUSE_BETWEEN_TESTS" = "yes" ] && [ "$INTERACTIVE" = "yes" ]; then
        echo ""
        log "${YELLOW}Press ENTER to continue, 's' to skip pauses, 'q' to quit...${NC}"
        read -r input
        if [ "$input" = "q" ]; then
            log "${RED}Testing aborted by user${NC}"
            print_summary
            exit 0
        elif [ "$input" = "s" ]; then
            PAUSE_BETWEEN_TESTS="no"
            log "${YELLOW}Skipping future pauses...${NC}"
        fi
    fi
}

api_call() {
    local method=$1
    local endpoint=$2
    local data=$3
    local auth=$4
    
    local cmd="curl -s -w '\n%{http_code}' -X $method '$API_URL$endpoint'"
    
    if [ -n "$data" ]; then
        cmd="$cmd -H 'Content-Type: application/json' -d '$data'"
    fi
    
    if [ -n "$auth" ]; then
        cmd="$cmd -H 'Authorization: Bearer $auth'"
    fi
    
    show_request "$method $endpoint"
    if [ -n "$data" ] && [ "$SHOW_REQUESTS" = "yes" ]; then
        log "${CYAN}   Data:${NC} $data"
    fi
    
    local response=$(eval $cmd)
    local http_code=$(echo "$response" | tail -n 1)
    local body=$(echo "$response" | sed '$d')
    
    show_response "$body"
    
    if [ "$SHOW_RESPONSES" = "yes" ]; then
        log "${CYAN}   HTTP Status:${NC} $http_code"
    fi
    
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
        log "${GREEN}✅ ALL TESTS PASSED!${NC}"
        PASS_RATE=100
    else
        PASS_RATE=$((TESTS_PASSED * 100 / TESTS_TOTAL))
        log "${YELLOW}⚠️  Some tests failed. Pass rate: ${PASS_RATE}%${NC}"
    fi
    
    log ""
    log "Test User: $TEST_USER"
    log "Log file: $LOG_FILE"
    log "Completed: $(date)"
    log ""
}

# Main test suite
main() {
    clear
    header "AI Security Scanner v4.0.0 - Comprehensive Test Suite"
    log ""
    log "${CYAN}Configuration:${NC}"
    log "  API URL: $API_URL"
    log "  Interactive Mode: $INTERACTIVE"
    log "  Show Requests: $SHOW_REQUESTS"
    log "  Show Responses: $SHOW_RESPONSES"
    log "  Pause Between Tests: $PAUSE_BETWEEN_TESTS"
    log "  Started: $(date)"
    log ""
    
    # Check if server is running
    log "${YELLOW}Checking server status...${NC}"
    if ! curl -s "$API_URL" >/dev/null 2>&1; then
        log "${RED}ERROR: Server is not running at $API_URL${NC}"
        log "Please start the server first: cd web-ui && node server-new.js"
        exit 1
    fi
    
    log "${GREEN}✓ Server is running${NC}"
    
    if [ "$INTERACTIVE" = "yes" ]; then
        log ""
        log "${YELLOW}Press ENTER to start testing...${NC}"
        read
    fi
    
    # ========================================
    # PHASE 1: AUTHENTICATION SYSTEM
    # ========================================
    log "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
    log "${YELLOW}PHASE 1: Authentication System (5 tests)${NC}"
    log "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
    
    # Test 1.1: User Registration
    test_start "User Registration"
    RESPONSE=$(api_call POST "/api/auth/register" "{\"username\":\"$TEST_USER\",\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}")
    if echo "$RESPONSE" | grep -q "success\|token\|user"; then
        test_pass "User registered successfully"
    else
        test_fail "User registration failed" "$RESPONSE"
    fi
    
    # Test 1.2: User Login
    test_start "User Login"
    RESPONSE=$(api_call POST "/api/auth/login" "{\"username\":\"$TEST_USER\",\"password\":\"$TEST_PASSWORD\"}")
    TOKEN=$(echo "$RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
    if [ -n "$TOKEN" ]; then
        test_pass "User logged in successfully"
        log "   Token: ${TOKEN:0:20}..."
    else
        test_fail "User login failed" "$RESPONSE"
    fi
    
    # Test 1.3: Get Profile
    test_start "Get User Profile"
    if [ -n "$TOKEN" ]; then
        RESPONSE=$(api_call GET "/api/auth/profile" "" "$TOKEN")
        if echo "$RESPONSE" | grep -q "$TEST_USER"; then
            test_pass "Profile retrieved successfully"
        else
            test_fail "Profile retrieval failed" "$RESPONSE"
        fi
    else
        test_skip "No token available"
    fi
    
    # Test 1.4: Token Validation
    test_start "Token Validation"
    if [ -n "$TOKEN" ]; then
        RESPONSE=$(api_call GET "/api/auth/validate" "" "$TOKEN")
        if echo "$RESPONSE" | grep -q "valid\|true\|success"; then
            test_pass "Token is valid"
        else
            test_fail "Token validation failed" "$RESPONSE"
        fi
    else
        test_skip "No token available"
    fi
    
    # Test 1.5: Protected Route Access
    test_start "Protected Route Access Without Token"
    RESPONSE=$(api_call GET "/api/auth/profile" "")
    if echo "$RESPONSE" | grep -q "unauthorized\|Unauthorized\|401"; then
        test_pass "Protected route correctly blocked"
    else
        test_fail "Protected route not enforcing auth" "$RESPONSE"
    fi
    
    # ========================================
    # PHASE 2: MFA SYSTEM
    # ========================================
    log "\n${YELLOW}═══════════════════════════════════════════════════════════${NC}"
    log "${YELLOW}PHASE 2: Multi-Factor Authentication (3 tests)${NC}"
    log "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
    
    if [ -n "$TOKEN" ]; then
        # Test 2.1: MFA Enable
        test_start "Enable MFA"
        RESPONSE=$(api_call POST "/api/auth/mfa/enable" "" "" "$TOKEN")
        if echo "$RESPONSE" | grep -q "secret\|qr\|success"; then
            test_pass "MFA enabled successfully"
        else
            test_fail "MFA enable failed" "$RESPONSE"
        fi
        
        # Test 2.2: Get MFA Status
        test_start "Get MFA Status"
        RESPONSE=$(api_call GET "/api/auth/mfa/status" "" "$TOKEN")
        if echo "$RESPONSE" | grep -q "enabled\|mfa"; then
            test_pass "MFA status retrieved"
        else
            test_fail "MFA status retrieval failed" "$RESPONSE"
        fi
        
        # Test 2.3: MFA Backup Codes
        test_start "Get MFA Backup Codes"
        RESPONSE=$(api_call GET "/api/auth/mfa/backup-codes" "" "$TOKEN")
        if echo "$RESPONSE" | grep -q "codes\|backup"; then
            test_pass "Backup codes generated"
        else
            test_fail "Backup codes generation failed" "$RESPONSE"
        fi
    else
        test_skip "MFA tests - No token available"
        test_skip "MFA tests - No token available"
        test_skip "MFA tests - No token available"
    fi
    
    # ========================================
    # PHASE 3: SECURITY PLUGIN
    # ========================================
    log "\n${YELLOW}═══════════════════════════════════════════════════════════${NC}"
    log "${YELLOW}PHASE 3: Security Plugin (5 tests)${NC}"
    log "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
    
    if [ -n "$TOKEN" ]; then
        # Test 3.1: Rate Limit Status
        test_start "Get Rate Limit Status"
        RESPONSE=$(api_call GET "/api/security/rate-limit/status" "" "$TOKEN")
        if echo "$RESPONSE" | grep -q "limit\|remaining"; then
            test_pass "Rate limit status retrieved"
        else
            test_fail "Rate limit status failed" "$RESPONSE"
        fi
        
        # Test 3.2: CSRF Token
        test_start "Get CSRF Token"
        RESPONSE=$(api_call GET "/api/security/csrf-token" "" "$TOKEN")
        if echo "$RESPONSE" | grep -q "token\|csrf"; then
            test_pass "CSRF token generated"
        else
            test_fail "CSRF token generation failed" "$RESPONSE"
        fi
        
        # Test 3.3: Input Validation (SQL Injection)
        test_start "Input Validation - SQL Injection"
        RESPONSE=$(api_call POST "/api/security/validate" "{\"input\":\"admin' OR 1=1--\",\"type\":\"sql\"}" "$TOKEN")
        if echo "$RESPONSE" | grep -q "invalid\|dangerous\|blocked"; then
            test_pass "SQL injection detected"
        else
            test_fail "SQL injection not detected" "$RESPONSE"
        fi
        
        # Test 3.4: Encryption
        test_start "Encryption Service"
        RESPONSE=$(api_call POST "/api/security/encrypt" "{\"data\":\"Secret message\",\"key\":\"test-key-123\"}" "$TOKEN")
        if echo "$RESPONSE" | grep -q "encrypted\|cipher"; then
            test_pass "Data encrypted successfully"
        else
            test_fail "Encryption failed" "$RESPONSE"
        fi
        
        # Test 3.5: Hashing
        test_start "Hashing Service"
        RESPONSE=$(api_call POST "/api/security/hash" "{\"data\":\"password123\"}" "$TOKEN")
        if echo "$RESPONSE" | grep -q "hash\|digest"; then
            test_pass "Data hashed successfully"
        else
            test_fail "Hashing failed" "$RESPONSE"
        fi
    else
        for i in {1..5}; do
            test_skip "Security tests - No token available"
        done
    fi
    
    # ========================================
    # PHASE 4: SCANNER PLUGIN
    # ========================================
    log "\n${YELLOW}═══════════════════════════════════════════════════════════${NC}"
    log "${YELLOW}PHASE 4: Scanner Plugin (3 tests)${NC}"
    log "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
    
    if [ -n "$TOKEN" ]; then
        # Test 4.1: Platform Detection
        test_start "Platform Detection"
        RESPONSE=$(api_call GET "/api/scanner/platform" "" "$TOKEN")
        if echo "$RESPONSE" | grep -q "platform\|linux\|windows"; then
            test_pass "Platform detected"
        else
            test_fail "Platform detection failed" "$RESPONSE"
        fi
        
        # Test 4.2: List Available Scans
        test_start "List Available Scans"
        RESPONSE=$(api_call GET "/api/scanner/scans" "" "$TOKEN")
        if echo "$RESPONSE" | grep -q "scan\|available"; then
            test_pass "Scan list retrieved"
        else
            test_fail "Scan list retrieval failed" "$RESPONSE"
        fi
        
        # Test 4.3: Scanner Status
        test_start "Get Scanner Status"
        RESPONSE=$(api_call GET "/api/scanner/status" "" "$TOKEN")
        if echo "$RESPONSE" | grep -q "status\|ready\|active"; then
            test_pass "Scanner status retrieved"
        else
            test_fail "Scanner status retrieval failed" "$RESPONSE"
        fi
    else
        for i in {1..3}; do
            test_skip "Scanner tests - No token available"
        done
    fi
    
    # ========================================
    # PHASE 5: STORAGE PLUGIN
    # ========================================
    log "\n${YELLOW}═══════════════════════════════════════════════════════════${NC}"
    log "${YELLOW}PHASE 5: Storage Plugin (3 tests)${NC}"
    log "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
    
    if [ -n "$TOKEN" ]; then
        # Test 5.1: List Backups
        test_start "List Backups"
        RESPONSE=$(api_call GET "/api/storage/backup/list" "" "$TOKEN")
        if echo "$RESPONSE" | grep -q "backup\|list\|\["; then
            test_pass "Backup list retrieved"
        else
            test_fail "Backup list retrieval failed" "$RESPONSE"
        fi
        
        # Test 5.2: List Reports
        test_start "List Reports"
        RESPONSE=$(api_call GET "/api/storage/reports" "" "$TOKEN")
        if echo "$RESPONSE" | grep -q "report\|list\|\["; then
            test_pass "Report list retrieved"
        else
            test_fail "Report list retrieval failed" "$RESPONSE"
        fi
        
        # Test 5.3: Storage Status
        test_start "Get Storage Status"
        RESPONSE=$(api_call GET "/api/storage/status" "" "$TOKEN")
        if echo "$RESPONSE" | grep -q "status\|disk\|space"; then
            test_pass "Storage status retrieved"
        else
            test_fail "Storage status retrieval failed" "$RESPONSE"
        fi
    else
        for i in {1..3}; do
            test_skip "Storage tests - No token available"
        done
    fi
    
    # ========================================
    # PHASE 6: ADMIN PLUGIN
    # ========================================
    log "\n${YELLOW}═══════════════════════════════════════════════════════════${NC}"
    log "${YELLOW}PHASE 6: Admin Plugin (5 tests)${NC}"
    log "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
    
    if [ -n "$TOKEN" ]; then
        # Test 6.1: System Health
        test_start "System Health Check"
        RESPONSE=$(api_call GET "/api/admin/system/health" "" "$TOKEN")
        if echo "$RESPONSE" | grep -q "health\|status\|cpu"; then
            test_pass "System health retrieved"
        else
            test_fail "System health check failed" "$RESPONSE"
        fi
        
        # Test 6.2: Resource Usage
        test_start "Resource Usage"
        RESPONSE=$(api_call GET "/api/admin/system/resources" "" "$TOKEN")
        if echo "$RESPONSE" | grep -q "cpu\|memory\|disk"; then
            test_pass "Resource usage retrieved"
        else
            test_fail "Resource usage retrieval failed" "$RESPONSE"
        fi
        
        # Test 6.3: Plugin Status
        test_start "Plugin Status"
        RESPONSE=$(api_call GET "/api/admin/system/plugins" "" "$TOKEN")
        if echo "$RESPONSE" | grep -q "plugin\|auth\|security"; then
            test_pass "Plugin status retrieved"
        else
            test_fail "Plugin status retrieval failed" "$RESPONSE"
        fi
        
        # Test 6.4: List Users
        test_start "List Users"
        RESPONSE=$(api_call GET "/api/admin/users" "" "$TOKEN")
        if echo "$RESPONSE" | grep -q "user\|list\|\["; then
            test_pass "User list retrieved"
        else
            test_fail "User list retrieval failed" "$RESPONSE"
        fi
        
        # Test 6.5: Audit Logs
        test_start "Get Audit Logs"
        RESPONSE=$(api_call GET "/api/admin/audit/logs" "" "$TOKEN")
        if echo "$RESPONSE" | grep -q "log\|audit\|\["; then
            test_pass "Audit logs retrieved"
        else
            test_fail "Audit logs retrieval failed" "$RESPONSE"
        fi
    else
        for i in {1..5}; do
            test_skip "Admin tests - No token available"
        done
    fi
    
    # ========================================
    # PHASE 7: VPN PLUGIN
    # ========================================
    log "\n${YELLOW}═══════════════════════════════════════════════════════════${NC}"
    log "${YELLOW}PHASE 7: VPN Plugin (3 tests)${NC}"
    log "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
    
    if [ -n "$TOKEN" ]; then
        # Test 7.1: VPN Status
        test_start "Get VPN Status"
        RESPONSE=$(api_call GET "/api/vpn/status" "" "$TOKEN")
        if echo "$RESPONSE" | grep -q "vpn\|status\|wireguard\|openvpn"; then
            test_pass "VPN status retrieved"
        else
            test_fail "VPN status retrieval failed" "$RESPONSE"
        fi
        
        # Test 7.2: WireGuard Status
        test_start "Get WireGuard Status"
        RESPONSE=$(api_call GET "/api/vpn/wireguard/status" "" "$TOKEN")
        if echo "$RESPONSE" | grep -q "wireguard\|status"; then
            test_pass "WireGuard status retrieved"
        else
            test_fail "WireGuard status retrieval failed" "$RESPONSE"
        fi
        
        # Test 7.3: OpenVPN Status
        test_start "Get OpenVPN Status"
        RESPONSE=$(api_call GET "/api/vpn/openvpn/status" "" "$TOKEN")
        if echo "$RESPONSE" | grep -q "openvpn\|status"; then
            test_pass "OpenVPN status retrieved"
        else
            test_fail "OpenVPN status retrieval failed" "$RESPONSE"
        fi
    else
        for i in {1..3}; do
            test_skip "VPN tests - No token available"
        done
    fi
    
    # ========================================
    # RESULTS SUMMARY
    # ========================================
    log "\n${BLUE}═══════════════════════════════════════════════════════════${NC}"
    log "${BLUE}   TEST RESULTS SUMMARY${NC}"
    log "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    log ""
    log "Total Tests:  $TESTS_TOTAL"
    log "${GREEN}Passed:       $TESTS_PASSED${NC}"
    log "${RED}Failed:       $TESTS_FAILED${NC}"
    log ""
    
    if [ $TESTS_FAILED -eq 0 ]; then
        log "${GREEN}✅ ALL TESTS PASSED!${NC}"
        PASS_RATE=100
    else
        PASS_RATE=$((TESTS_PASSED * 100 / TESTS_TOTAL))
        log "${YELLOW}⚠️  Some tests failed. Pass rate: ${PASS_RATE}%${NC}"
    fi
    
    log ""
    log "Completed: $(date)"
    log "Log file: $LOG_FILE"
    log ""
    
    # Exit code
    if [ $TESTS_FAILED -gt 0 ]; then
        exit 1
    fi
}

# Run tests
main "$@"
