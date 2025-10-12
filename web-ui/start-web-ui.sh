#!/bin/bash

# AI Security Scanner Web UI Launcher
# Starts the web dashboard for monitoring security scans

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}🛡️  AI Security Scanner Web UI${NC}"
echo -e "${BLUE}================================${NC}\n"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}⚠️  Node.js is not installed${NC}"
    echo "Please install Node.js (v16 or higher):"
    echo "  Ubuntu/Debian: sudo apt install nodejs npm"
    echo "  Or visit: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    echo -e "${YELLOW}⚠️  Node.js version is too old (v$NODE_VERSION)${NC}"
    echo "Please upgrade to Node.js v16 or higher"
    exit 1
fi

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Installing dependencies...${NC}"
    npm install
    echo -e "${GREEN}✅ Dependencies installed${NC}\n"
fi

# Create reports directory if it doesn't exist
mkdir -p ~/security-reports

# Get port from environment or use default
PORT=${PORT:-3000}

echo -e "${GREEN}✅ Starting Web UI on port $PORT...${NC}\n"
echo -e "${BLUE}📡 Access the dashboard at:${NC}"
echo -e "${GREEN}   http://localhost:$PORT${NC}"
echo -e "${GREEN}   http://$(hostname -I | awk '{print $1}'):$PORT${NC}\n"
echo -e "${YELLOW}Press Ctrl+C to stop${NC}\n"

# Start the server
exec node server.js
