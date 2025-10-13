#!/bin/bash

# AI Security Scanner - Backend Testing Script
# Tests all plugins before UI development

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SERVER_URL="${SERVER_URL:-http://localhost:3000}"
API_TOKEN=""
TEST_USER="testuser_$(date +%s)"
TEST_PASS="TestPass123!@#"
TEST_EMAIL="test_$(date +%s)@example.com"

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  AI Security Scanner - Backend Testing Suite          ║${NC}"
echo -e "${BLUE}║  Testing all plugins before UI development            ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Server URL: $SERVER_URL${NC}"
echo -e "${YELLOW}Test User: $TEST_USER${NC}"
echo ""

# Helper functions
success() {
    echo -e "${GREEN}✓${NC} $1"
}

error() {
    echo -e "${RED}✗${NC} $1"
}

warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# Check if server is running
info "Checking if server is running..."
if curl -s "$SERVER_URL/health" > /dev/null 2>&1; then
    success "Server is running"
else
    error "Server is not running at $SERVER_URL"
    echo ""
    echo "Please start the server first:"
    echo "  cd web-ui && npm start"
    exit 1
fi

echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Phase 1: Authentication System Testing${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo ""

# Test 1: User Registration
info "Test 1: User registration..."
REGISTER_RESPONSE=$(curl -s -X POST "$SERVER_URL/api/auth/register" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"$TEST_USER\",\"password\":\"$TEST_PASS\",\"email\":\"$TEST_EMAIL\"}")

if echo "$REGISTER_RESPONSE" | grep -q "success\|token\|id"; then
    success "User registration successful"
else
    error "User registration failed: $REGISTER_RESPONSE"
    exit 1
fi

# Test 2: User Login
info "Test 2: User login..."
LOGIN_RESPONSE=$(curl -s -X POST "$SERVER_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"$TEST_USER\",\"password\":\"$TEST_PASS\"}")

if echo "$LOGIN_RESPONSE" | grep -q "token"; then
    API_TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
    success "Login successful (token obtained)"
else
    error "Login failed: $LOGIN_RESPONSE"
    exit 1
fi

# Test 3: Get Profile
info "Test 3: Get user profile..."
PROFILE_RESPONSE=$(curl -s -X GET "$SERVER_URL/api/auth/profile" \
    -H "Authorization: Bearer $API_TOKEN")

if echo "$PROFILE_RESPONSE" | grep -q "$TEST_USER"; then
    success "Profile retrieved successfully"
else
    error "Failed to get profile: $PROFILE_RESPONSE"
fi

# Test 4: Invalid Login
info "Test 4: Invalid login attempt..."
INVALID_LOGIN=$(curl -s -X POST "$SERVER_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"$TEST_USER\",\"password\":\"wrongpassword\"}")

if echo "$INVALID_LOGIN" | grep -q "error\|invalid\|incorrect"; then
    success "Invalid login correctly rejected"
else
    warning "Invalid login response unexpected: $INVALID_LOGIN"
fi

echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Phase 2: Security Plugin Testing${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo ""

# Test 5: Rate Limit Status
info "Test 5: Get rate limit status..."
RATE_LIMIT=$(curl -s -X GET "$SERVER_URL/api/security/rate-limit/status" \
    -H "Authorization: Bearer $API_TOKEN")

if echo "$RATE_LIMIT" | grep -q "auth\|api\|scan"; then
    success "Rate limit status retrieved"
else
    warning "Rate limit status not available"
fi

# Test 6: CSRF Token
info "Test 6: Get CSRF token..."
CSRF_TOKEN=$(curl -s -X GET "$SERVER_URL/api/security/csrf-token" \
    -H "Authorization: Bearer $API_TOKEN")

if echo "$CSRF_TOKEN" | grep -q "token\|csrf"; then
    success "CSRF token generated"
else
    warning "CSRF token not available"
fi

# Test 7: Input Validation
info "Test 7: Test input validation (SQL injection)..."
VALIDATION=$(curl -s -X POST "$SERVER_URL/api/security/validate" \
    -H "Authorization: Bearer $API_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"input":"admin'"'"' OR 1=1--","type":"sql"}')

if echo "$VALIDATION" | grep -q "invalid\|blocked\|false"; then
    success "SQL injection detected and blocked"
else
    warning "Validation response: $VALIDATION"
fi

echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Phase 3: Scanner Plugin Testing${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo ""

# Test 8: Platform Detection
info "Test 8: Detect platform..."
PLATFORM=$(curl -s -X GET "$SERVER_URL/api/scanner/platform" \
    -H "Authorization: Bearer $API_TOKEN")

if echo "$PLATFORM" | grep -q "linux\|windows\|darwin"; then
    success "Platform detected: $(echo $PLATFORM | grep -o '"platform":"[^"]*"' | cut -d'"' -f4)"
else
    warning "Platform detection response: $PLATFORM"
fi

# Test 9: List Scripts
info "Test 9: List available scripts..."
SCRIPTS=$(curl -s -X GET "$SERVER_URL/api/scanner/scripts" \
    -H "Authorization: Bearer $API_TOKEN")

if echo "$SCRIPTS" | grep -q "scripts\|bash\|powershell"; then
    success "Scripts list retrieved"
else
    warning "Scripts list response: $SCRIPTS"
fi

echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Phase 4: Admin Plugin Testing${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo ""

# Test 10: System Health
info "Test 10: Get system health..."
HEALTH=$(curl -s -X GET "$SERVER_URL/api/admin/system/health" \
    -H "Authorization: Bearer $API_TOKEN")

if echo "$HEALTH" | grep -q "status\|uptime\|healthy"; then
    success "System health retrieved"
else
    warning "System health response: $HEALTH"
fi

# Test 11: System Resources
info "Test 11: Get system resources..."
RESOURCES=$(curl -s -X GET "$SERVER_URL/api/admin/system/resources" \
    -H "Authorization: Bearer $API_TOKEN")

if echo "$RESOURCES" | grep -q "cpu\|memory\|disk"; then
    success "System resources retrieved"
else
    warning "System resources response: $RESOURCES"
fi

# Test 12: Plugin Status
info "Test 12: Get plugin status..."
PLUGINS=$(curl -s -X GET "$SERVER_URL/api/admin/system/plugins" \
    -H "Authorization: Bearer $API_TOKEN")

if echo "$PLUGINS" | grep -q "plugins\|auth\|security"; then
    success "Plugin status retrieved"
else
    warning "Plugin status response: $PLUGINS"
fi

echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Phase 5: Storage Plugin Testing${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo ""

# Test 13: List Backups
info "Test 13: List backups..."
BACKUPS=$(curl -s -X GET "$SERVER_URL/api/storage/backup/list" \
    -H "Authorization: Bearer $API_TOKEN")

if echo "$BACKUPS" | grep -q "backups\|total\|\[\]"; then
    success "Backup list retrieved"
else
    warning "Backup list response: $BACKUPS"
fi

# Test 14: List Reports
info "Test 14: List reports..."
REPORTS=$(curl -s -X GET "$SERVER_URL/api/storage/reports" \
    -H "Authorization: Bearer $API_TOKEN")

if echo "$REPORTS" | grep -q "reports\|total\|\[\]"; then
    success "Report list retrieved"
else
    warning "Report list response: $REPORTS"
fi

echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Phase 6: VPN Plugin Testing${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo ""

# Test 15: WireGuard Status
info "Test 15: Get WireGuard status..."
WG_STATUS=$(curl -s -X GET "$SERVER_URL/api/vpn/wireguard/status" \
    -H "Authorization: Bearer $API_TOKEN")

if echo "$WG_STATUS" | grep -q "status\|installed\|running"; then
    success "WireGuard status retrieved"
else
    warning "WireGuard status response: $WG_STATUS"
fi

# Test 16: OpenVPN Status
info "Test 16: Get OpenVPN status..."
OVPN_STATUS=$(curl -s -X GET "$SERVER_URL/api/vpn/openvpn/status" \
    -H "Authorization: Bearer $API_TOKEN")

if echo "$OVPN_STATUS" | grep -q "status\|installed\|running"; then
    success "OpenVPN status retrieved"
else
    warning "OpenVPN status response: $OVPN_STATUS"
fi

echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Phase 7: System Info Plugin Testing${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo ""

# Test 17: System Information
info "Test 17: Get system information..."
SYSINFO=$(curl -s -X GET "$SERVER_URL/api/system/info" \
    -H "Authorization: Bearer $API_TOKEN")

if echo "$SYSINFO" | grep -q "hostname\|platform\|arch"; then
    success "System information retrieved"
else
    warning "System information response: $SYSINFO"
fi

echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}Backend Testing Complete!${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"
echo ""
echo "Summary:"
echo "  • Authentication: ✓ Tested"
echo "  • Security: ✓ Tested"
echo "  • Scanner: ✓ Tested"
echo "  • Admin: ✓ Tested"
echo "  • Storage: ✓ Tested"
echo "  • VPN: ✓ Tested"
echo "  • System-Info: ✓ Tested"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "  1. Review any warnings above"
echo "  2. Test advanced features manually"
echo "  3. Run comprehensive integration tests"
echo "  4. Build missing v5.0.0 features"
echo "  5. Then proceed with UI development"
echo ""
echo "For detailed testing guide, see: V5_GAP_ANALYSIS.md"
echo ""
