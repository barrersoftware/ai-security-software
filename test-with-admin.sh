#!/bin/bash

# Test with both regular and admin users
API_URL="http://localhost:3001"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${CYAN}═══════════════════════════════════════${NC}"
echo -e "${CYAN}  Admin Token Test${NC}"
echo -e "${CYAN}═══════════════════════════════════════${NC}"
echo ""

# Create regular user
echo -e "${BLUE}1. Creating regular user...${NC}"
REGULAR_USER="user_$(date +%s)"
REGULAR_PASS="User123!@#"
RESPONSE=$(curl -s -X POST "$API_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$REGULAR_USER\",\"password\":\"$REGULAR_PASS\",\"email\":\"user@test.com\"}")
echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"

# Login regular user
echo ""
echo -e "${BLUE}2. Logging in as regular user...${NC}"
RESPONSE=$(curl -s -X POST "$API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$REGULAR_USER\",\"password\":\"$REGULAR_PASS\"}")
REGULAR_TOKEN=$(echo "$RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
echo ""
echo -e "${GREEN}Regular Token: ${REGULAR_TOKEN:0:30}...${NC}"

# Create admin user
echo ""
echo -e "${BLUE}3. Creating admin user...${NC}"
ADMIN_USER="admin_$(date +%s)"
ADMIN_PASS="Admin123!@#"
RESPONSE=$(curl -s -X POST "$API_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$ADMIN_USER\",\"password\":\"$ADMIN_PASS\",\"email\":\"admin@test.com\"}")
USER_ID=$(echo "$RESPONSE" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"

# Login admin user
echo ""
echo -e "${BLUE}4. Logging in as admin user...${NC}"
RESPONSE=$(curl -s -X POST "$API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$ADMIN_USER\",\"password\":\"$ADMIN_PASS\"}")
ADMIN_TOKEN=$(echo "$RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
echo ""
echo -e "${GREEN}Admin Token: ${ADMIN_TOKEN:0:30}...${NC}"

# Try to elevate to admin (may need to edit user file directly)
echo ""
echo -e "${BLUE}5. Testing admin endpoints...${NC}"

# Test with regular token
echo ""
echo -e "${CYAN}→ Testing /api/admin/system/resources with REGULAR token:${NC}"
RESPONSE=$(curl -s -X GET "$API_URL/api/admin/system/resources" \
  -H "Authorization: Bearer $REGULAR_TOKEN")
echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"

# Test with admin token (same result expected unless manually set)
echo ""
echo -e "${CYAN}→ Testing /api/admin/system/resources with ADMIN token:${NC}"
RESPONSE=$(curl -s -X GET "$API_URL/api/admin/system/resources" \
  -H "Authorization: Bearer $ADMIN_TOKEN")
echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"

# Try updating role via admin endpoint
if [ -n "$USER_ID" ] && [ -n "$REGULAR_TOKEN" ]; then
    echo ""
    echo -e "${BLUE}6. Attempting to set admin role...${NC}"
    RESPONSE=$(curl -s -X POST "$API_URL/api/admin/users/$USER_ID/role" \
      -H "Authorization: Bearer $ADMIN_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{"role":"admin"}')
    echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
fi

echo ""
echo -e "${CYAN}═══════════════════════════════════════${NC}"
echo ""
echo "To manually set admin role, edit:"
echo "  web-ui/data/users.json"
echo ""
echo "Change \"role\":\"user\" to \"role\":\"admin\" for user: $ADMIN_USER"
echo ""
