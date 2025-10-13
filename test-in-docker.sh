#!/bin/bash

###############################################################################
# AI Security Scanner - Docker Test Script
# Run this inside the Docker container to test the scanner
###############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=================================================${NC}"
echo -e "${BLUE}  AI Security Scanner v4.0.0 - Test Suite${NC}"
echo -e "${BLUE}=================================================${NC}"
echo ""

# Step 1: Clone repository
echo -e "${GREEN}[1/7] Cloning repository...${NC}"
if [ ! -d "ai-security-scanner" ]; then
    git clone https://github.com/ssfdre38/ai-security-scanner.git
    cd ai-security-scanner
else
    cd ai-security-scanner
    git fetch
fi

# Step 2: Checkout v4 branch
echo -e "${GREEN}[2/7] Checking out v4 branch...${NC}"
git checkout v4
git pull origin v4

# Step 3: Install dependencies
echo -e "${GREEN}[3/7] Installing Node.js dependencies...${NC}"
cd web-ui
npm install

# Step 4: Create test environment file
echo -e "${GREEN}[4/7] Creating test configuration...${NC}"
cat > .env << 'EOF'
NODE_ENV=development
PORT=3001
SESSION_SECRET=test-secret-key-for-docker-testing-only
MFA_ENCRYPTION_KEY=test-mfa-key-32-characters-long
JWT_SECRET=test-jwt-secret-key-for-testing

# Rate Limiting
AUTH_RATE_LIMIT_WINDOW=300000
AUTH_RATE_LIMIT_MAX=5
API_RATE_LIMIT_WINDOW=60000
API_RATE_LIMIT_MAX=100
SCAN_RATE_LIMIT_WINDOW=3600000
SCAN_RATE_LIMIT_MAX=10

# Database
DB_TYPE=sqlite
DB_PATH=./data/database.db

# Logging
LOG_LEVEL=info
LOG_FILE=./logs/app.log
EOF

echo -e "✅ Configuration created"
echo ""

# Step 5: Quick server test
echo -e "${GREEN}[5/7] Testing server startup...${NC}"
timeout 10 node server-new.js 2>&1 | tee /tmp/server-test.log &
SERVER_PID=$!
sleep 5

# Check if server started
if ps -p $SERVER_PID > /dev/null; then
    echo -e "✅ Server started successfully"
    kill $SERVER_PID 2>/dev/null || true
    wait $SERVER_PID 2>/dev/null || true
else
    echo -e "${RED}❌ Server failed to start${NC}"
    cat /tmp/server-test.log
    exit 1
fi

echo ""

# Step 6: Check plugin loading
echo -e "${GREEN}[6/7] Verifying plugin loading...${NC}"
if grep -q "Successfully loaded 7 plugins" /tmp/server-test.log; then
    echo -e "✅ All 7 plugins loaded"
else
    echo -e "${YELLOW}⚠ Check plugin loading in logs${NC}"
fi

if grep -q "vpn v1.0.0" /tmp/server-test.log; then
    echo -e "✅ VPN plugin loaded"
else
    echo -e "${YELLOW}⚠ VPN plugin not detected${NC}"
fi

if grep -q "admin v1.0.0" /tmp/server-test.log; then
    echo -e "✅ Admin plugin loaded"
else
    echo -e "${YELLOW}⚠ Admin plugin not detected${NC}"
fi

echo ""

# Step 7: Summary
echo -e "${BLUE}=================================================${NC}"
echo -e "${GREEN}✅ Basic Tests Complete!${NC}"
echo -e "${BLUE}=================================================${NC}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo ""
echo -e "1. Start server interactively:"
echo -e "   ${BLUE}node server-new.js${NC}"
echo ""
echo -e "2. Test VPN installer (requires sudo):"
echo -e "   ${BLUE}cd /home/tester/ai-security-scanner${NC}"
echo -e "   ${BLUE}sudo ./scripts/install-wireguard.sh${NC}"
echo ""
echo -e "3. Test API endpoints:"
echo -e "   ${BLUE}curl http://localhost:3001/api/vpn/status${NC}"
echo ""
echo -e "4. View logs:"
echo -e "   ${BLUE}cat /tmp/server-test.log${NC}"
echo ""
echo -e "${GREEN}Happy Testing! 🚀${NC}"
