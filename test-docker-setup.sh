#!/bin/bash

###############################################################################
# Docker Test Environment Setup
# Creates a minimal Ubuntu container for testing AI Security Scanner
###############################################################################

set -e

echo "=== AI Security Scanner - Docker Test Environment ==="
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed"
    echo "Install Docker first: https://docs.docker.com/engine/install/"
    exit 1
fi

echo "✅ Docker is installed: $(docker --version)"
echo ""

# Create Dockerfile
cat > Dockerfile.test << 'EOF'
FROM ubuntu:22.04

# Prevent interactive prompts
ENV DEBIAN_FRONTEND=noninteractive

# Install required packages
RUN apt-get update && apt-get install -y \
    curl \
    git \
    sudo \
    systemctl \
    iptables \
    iproute2 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 20.x
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Create test user
RUN useradd -m -s /bin/bash tester \
    && echo "tester ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

# Set working directory
WORKDIR /home/tester

# Switch to test user
USER tester

CMD ["/bin/bash"]
EOF

echo "✅ Dockerfile created"
echo ""

# Build Docker image
echo "Building Docker image (this may take a few minutes)..."
docker build -f Dockerfile.test -t ai-scanner-test:latest .

echo ""
echo "✅ Docker image built successfully"
echo ""
echo "=== How to Use ==="
echo ""
echo "1. Start test container:"
echo "   docker run -it --privileged --name ai-scanner-test ai-scanner-test:latest"
echo ""
echo "2. Inside container, clone and test:"
echo "   git clone https://github.com/ssfdre38/ai-security-scanner.git"
echo "   cd ai-security-scanner"
echo "   git checkout v4"
echo "   cd web-ui"
echo "   npm install"
echo "   node server-new.js"
echo ""
echo "3. Test VPN installers (requires privileged mode):"
echo "   sudo ./scripts/install-vpn-all.sh"
echo ""
echo "4. Clean up when done:"
echo "   docker stop ai-scanner-test"
echo "   docker rm ai-scanner-test"
echo ""
