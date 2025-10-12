#!/bin/bash
# AI Security Scanner - Installation Script
# Works on Linux, BSD, and macOS

set -e

echo "================================================"
echo "  AI Security Scanner - Installation"
echo "================================================"
echo ""

# Check if running as root for system-wide installation
if [ "$EUID" -eq 0 ]; then 
    INSTALL_DIR="/usr/local/bin"
    SCRIPTS_DIR="/opt/ai-security-scanner"
    echo "Installing system-wide (requires root)..."
else
    INSTALL_DIR="$HOME/.local/bin"
    SCRIPTS_DIR="$HOME/.ai-security-scanner"
    echo "Installing for current user..."
    mkdir -p "$INSTALL_DIR"
fi

# Detect OS
OS="unknown"
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
elif [[ "$OSTYPE" == "freebsd"* ]] || [[ "$OSTYPE" == "openbsd"* ]]; then
    OS="bsd"
fi

echo "Detected OS: $OS"
echo ""

# Check dependencies
echo "Checking dependencies..."
MISSING_DEPS=()

command -v curl >/dev/null 2>&1 || MISSING_DEPS+=("curl")
command -v jq >/dev/null 2>&1 || MISSING_DEPS+=("jq")

if [ ${#MISSING_DEPS[@]} -ne 0 ]; then
    echo "Missing dependencies: ${MISSING_DEPS[*]}"
    echo ""
    echo "Install them with:"
    if [ "$OS" = "linux" ]; then
        echo "  sudo apt-get install ${MISSING_DEPS[*]}  # Debian/Ubuntu"
        echo "  sudo yum install ${MISSING_DEPS[*]}      # CentOS/RHEL"
        echo "  sudo dnf install ${MISSING_DEPS[*]}      # Fedora"
    elif [ "$OS" = "macos" ]; then
        echo "  brew install ${MISSING_DEPS[*]}"
    elif [ "$OS" = "bsd" ]; then
        echo "  sudo pkg install ${MISSING_DEPS[*]}"
    fi
    exit 1
fi

echo "✓ All dependencies found"
echo ""

# Check for Ollama
if ! command -v ollama &> /dev/null; then
    echo "Ollama not found. Installing..."
    
    if [ "$OS" = "linux" ] || [ "$OS" = "bsd" ]; then
        curl -fsSL https://ollama.com/install.sh | sh
    elif [ "$OS" = "macos" ]; then
        echo "Please install Ollama manually:"
        echo "  brew install ollama"
        echo "Or download from: https://ollama.com/download"
        exit 1
    fi
    
    echo "✓ Ollama installed"
else
    echo "✓ Ollama already installed"
fi

# Start Ollama service
echo ""
echo "Starting Ollama service..."
if [ "$OS" = "linux" ]; then
    if command -v systemctl &> /dev/null; then
        sudo systemctl enable ollama 2>/dev/null || true
        sudo systemctl start ollama 2>/dev/null || true
    else
        ollama serve > /dev/null 2>&1 &
    fi
elif [ "$OS" = "macos" ]; then
    ollama serve > /dev/null 2>&1 &
fi

sleep 2
echo "✓ Ollama service started"

# Install scripts
echo ""
echo "Installing security scanner scripts..."
mkdir -p "$SCRIPTS_DIR"
cp -r scripts/* "$SCRIPTS_DIR/"
chmod +x "$SCRIPTS_DIR"/*.sh

# Create symlinks
ln -sf "$SCRIPTS_DIR/security-scanner.sh" "$INSTALL_DIR/ai-security-scan"
ln -sf "$SCRIPTS_DIR/security-monitor.sh" "$INSTALL_DIR/ai-security-monitor"
ln -sf "$SCRIPTS_DIR/code-review.sh" "$INSTALL_DIR/ai-code-review"
ln -sf "$SCRIPTS_DIR/security-chat.sh" "$INSTALL_DIR/ai-security-chat"

echo "✓ Scripts installed to $SCRIPTS_DIR"
echo "✓ Symlinks created in $INSTALL_DIR"

# Create report directory
REPORT_DIR="$HOME/security-reports"
mkdir -p "$REPORT_DIR"
echo "✓ Report directory: $REPORT_DIR"

# Prompt for model selection
echo ""
echo "================================================"
echo "  AI Model Selection"
echo "================================================"
echo ""
echo "Choose an AI model based on your system resources:"
echo ""
echo "1) llama3.2:3b    - 2GB RAM  - Fast, good quality"
echo "2) llama3.1:8b    - 8GB RAM  - Better, balanced"
echo "3) llama3.1:70b   - 32GB RAM - Best, enterprise-grade"
echo "4) Skip (install later)"
echo ""
read -p "Enter choice [1-4]: " MODEL_CHOICE

case $MODEL_CHOICE in
    1)
        MODEL="llama3.2:3b"
        ;;
    2)
        MODEL="llama3.1:8b"
        ;;
    3)
        MODEL="llama3.1:70b"
        ;;
    4)
        MODEL=""
        ;;
    *)
        MODEL="llama3.1:8b"
        ;;
esac

if [ -n "$MODEL" ]; then
    echo ""
    echo "Downloading AI model: $MODEL"
    echo "This may take several minutes..."
    ollama pull "$MODEL"
    echo "✓ Model installed: $MODEL"
    
    # Update scripts with chosen model
    for script in "$SCRIPTS_DIR"/*.sh; do
        if grep -q 'MODEL="llama3.1:70b"' "$script" 2>/dev/null; then
            sed -i.bak "s/MODEL=\"llama3.1:70b\"/MODEL=\"$MODEL\"/" "$script"
            rm -f "$script.bak"
        fi
    done
fi

# Add to PATH if needed
if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
    echo ""
    echo "Add to your PATH by adding this to ~/.bashrc or ~/.zshrc:"
    echo "  export PATH=\"\$PATH:$INSTALL_DIR\""
fi

echo ""
echo "================================================"
echo "  Installation Complete! ✓"
echo "================================================"
echo ""
echo "Available commands:"
echo "  ai-security-scan      - Run comprehensive security scan"
echo "  ai-security-monitor   - Real-time threat monitoring"
echo "  ai-code-review <path> - Review code for vulnerabilities"
echo "  ai-security-chat      - Interactive security assistant"
echo ""
echo "Get started:"
echo "  ai-security-scan"
echo ""
echo "Reports will be saved to: $REPORT_DIR"
echo ""
echo "Documentation: https://github.com/yourusername/ai-security-scanner"
echo ""
