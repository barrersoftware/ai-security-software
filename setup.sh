#!/bin/bash
################################################################################
# AI Security Scanner - Universal Setup Script
# Compatible with: Ubuntu, Debian, CentOS, RHEL, Fedora, Arch, macOS
# Skill Level: Beginner to SpecOps
# Version: 3.1.0
################################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Banner
clear
echo -e "${CYAN}"
cat << "EOF"
╔══════════════════════════════════════════════════════════════════╗
║                                                                  ║
║           AI SECURITY SCANNER v3.1.0                            ║
║           Universal Setup Script                                 ║
║                                                                  ║
║           From Zero to Secure in Minutes                        ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

# Configuration
REPO_URL="https://github.com/ssfdre38/ai-security-scanner.git"
INSTALL_DIR="$HOME/ai-security-scanner"
WEB_UI_PORT=3000

################################################################################
# Utility Functions
################################################################################

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}!${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_step() {
    echo -e "\n${CYAN}▶${NC} ${BLUE}$1${NC}\n"
}

spinner() {
    local pid=$1
    local delay=0.1
    local spinstr='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
    while [ "$(ps a | awk '{print $1}' | grep $pid)" ]; do
        local temp=${spinstr#?}
        printf " [%c]  " "$spinstr"
        local spinstr=$temp${spinstr%"$temp"}
        sleep $delay
        printf "\b\b\b\b\b\b"
    done
    printf "    \b\b\b\b"
}

prompt_yes_no() {
    local prompt="$1"
    local default="${2:-n}"
    
    if [ "$default" = "y" ]; then
        prompt="$prompt [Y/n]: "
    else
        prompt="$prompt [y/N]: "
    fi
    
    read -p "$prompt" response
    response=${response:-$default}
    
    if [[ "$response" =~ ^[Yy]$ ]]; then
        return 0
    else
        return 1
    fi
}

generate_random_key() {
    openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | xxd -p | tr -d '\n'
}

################################################################################
# System Detection
################################################################################

detect_os() {
    print_step "Detecting Operating System"
    
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        if [ -f /etc/os-release ]; then
            . /etc/os-release
            OS=$ID
            OS_VERSION=$VERSION_ID
            OS_NAME=$PRETTY_NAME
        else
            OS="unknown"
            OS_NAME="Unknown Linux"
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macos"
        OS_NAME="macOS $(sw_vers -productVersion)"
    else
        OS="unknown"
        OS_NAME="Unknown OS"
    fi
    
    print_info "Detected: $OS_NAME"
    print_info "Architecture: $(uname -m)"
}

################################################################################
# Dependency Installation
################################################################################

install_dependencies() {
    print_step "Installing Dependencies"
    
    case "$OS" in
        ubuntu|debian)
            print_info "Using APT package manager"
            sudo apt-get update -qq
            sudo apt-get install -y -qq \
                curl wget git nodejs npm \
                build-essential python3 python3-pip \
                openssl clamav clamav-daemon \
                rkhunter chkrootkit aide \
                jq bc net-tools > /dev/null 2>&1 &
            spinner $!
            ;;
            
        centos|rhel|fedora)
            print_info "Using YUM/DNF package manager"
            sudo yum install -y -q \
                curl wget git nodejs npm \
                gcc gcc-c++ make python3 python3-pip \
                openssl clamav clamav-update \
                rkhunter aide \
                jq bc net-tools > /dev/null 2>&1 &
            spinner $!
            ;;
            
        arch|manjaro)
            print_info "Using Pacman package manager"
            sudo pacman -Sy --noconfirm --quiet \
                curl wget git nodejs npm \
                base-devel python python-pip \
                openssl clamav \
                rkhunter aide \
                jq bc net-tools > /dev/null 2>&1 &
            spinner $!
            ;;
            
        macos)
            print_info "Using Homebrew package manager"
            if ! command -v brew &> /dev/null; then
                print_warning "Homebrew not found. Installing..."
                /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
            fi
            brew install node git python3 openssl clamav jq > /dev/null 2>&1 &
            spinner $!
            ;;
            
        *)
            print_error "Unsupported operating system: $OS"
            print_info "Please install manually: Node.js, npm, git, Python3, OpenSSL"
            exit 1
            ;;
    esac
    
    print_success "Dependencies installed"
}

check_nodejs() {
    print_step "Checking Node.js Installation"
    
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node -v)
        print_success "Node.js $NODE_VERSION installed"
        
        # Check if version is sufficient (v14+)
        NODE_MAJOR=$(echo $NODE_VERSION | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$NODE_MAJOR" -lt 14 ]; then
            print_warning "Node.js version is old. Recommend v18 or higher."
            if prompt_yes_no "Upgrade Node.js?" "y"; then
                upgrade_nodejs
            fi
        fi
    else
        print_error "Node.js not found"
        install_dependencies
    fi
    
    if command -v npm &> /dev/null; then
        NPM_VERSION=$(npm -v)
        print_success "npm $NPM_VERSION installed"
    else
        print_error "npm not found"
        exit 1
    fi
}

upgrade_nodejs() {
    print_info "Installing Node Version Manager (nvm)"
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    nvm install --lts
    nvm use --lts
    print_success "Node.js upgraded to LTS version"
}

################################################################################
# Download Repository
################################################################################

download_repository() {
    print_step "Downloading AI Security Scanner"
    
    if [ -d "$INSTALL_DIR" ]; then
        print_warning "Installation directory already exists: $INSTALL_DIR"
        if prompt_yes_no "Remove and reinstall?" "y"; then
            rm -rf "$INSTALL_DIR"
        else
            print_info "Using existing installation"
            cd "$INSTALL_DIR"
            git pull origin master > /dev/null 2>&1 || true
            return
        fi
    fi
    
    print_info "Cloning repository..."
    git clone "$REPO_URL" "$INSTALL_DIR" > /dev/null 2>&1 &
    spinner $!
    
    cd "$INSTALL_DIR"
    print_success "Repository downloaded to $INSTALL_DIR"
}

################################################################################
# Install NPM Dependencies
################################################################################

install_npm_packages() {
    print_step "Installing Node.js Packages"
    
    cd "$INSTALL_DIR/web-ui"
    
    print_info "Installing packages (this may take a few minutes)..."
    npm install --quiet --no-progress > /dev/null 2>&1 &
    spinner $!
    
    print_success "Node.js packages installed"
}

################################################################################
# Configuration
################################################################################

configure_environment() {
    print_step "Configuring Environment"
    
    cd "$INSTALL_DIR/web-ui"
    
    if [ -f .env ]; then
        print_warning "Configuration file already exists"
        if ! prompt_yes_no "Reconfigure?" "n"; then
            print_info "Using existing configuration"
            return
        fi
    fi
    
    print_info "Creating .env configuration file..."
    
    # Generate secure keys
    SESSION_SECRET=$(generate_random_key)
    MFA_KEY=$(generate_random_key)
    CSRF_KEY=$(generate_random_key)
    
    cat > .env << EOF
# AI Security Scanner Configuration
# Generated: $(date)
# DO NOT COMMIT THIS FILE TO VERSION CONTROL

# Application Settings
NODE_ENV=production
PORT=$WEB_UI_PORT
LOG_LEVEL=info

# Security Settings
SESSION_SECRET=$SESSION_SECRET
MFA_ENCRYPTION_KEY=$MFA_KEY
CSRF_SECRET=$CSRF_KEY

# Redis Configuration (optional)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
USE_REDIS=false

# Backup Settings
AUTO_BACKUP_ENABLED=true
AUTO_BACKUP_SCHEDULE=0 2 * * *
BACKUP_RETENTION_DAYS=30

# Rate Limiting
AUTH_RATE_LIMIT_WINDOW_MS=900000
AUTH_RATE_LIMIT_MAX=5
API_RATE_LIMIT_WINDOW_MS=60000
API_RATE_LIMIT_MAX=100
SCAN_RATE_LIMIT_WINDOW_MS=300000
SCAN_RATE_LIMIT_MAX=10

# SSL/TLS Settings (configure if needed)
SSL_CERT_PATH=
SSL_KEY_PATH=
FORCE_HTTPS=false

# OAuth Settings (optional - leave blank to disable)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:$WEB_UI_PORT/api/auth/google/callback

MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_CALLBACK_URL=http://localhost:$WEB_UI_PORT/api/auth/microsoft/callback

# Notification Settings (optional)
SLACK_WEBHOOK_URL=
DISCORD_WEBHOOK_URL=
EMAIL_ENABLED=false
EMAIL_FROM=security@localhost
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
PAGERDUTY_KEY=
EOF

    chmod 600 .env
    print_success "Configuration file created with secure keys"
}

################################################################################
# Security Scanning Tools
################################################################################

install_security_tools() {
    print_step "Installing Security Scanning Tools"
    
    # Update ClamAV database
    if command -v freshclam &> /dev/null; then
        print_info "Updating ClamAV virus definitions..."
        sudo freshclam > /dev/null 2>&1 || print_warning "ClamAV update failed (may need to run manually)"
    fi
    
    # Initialize AIDE
    if command -v aide &> /dev/null; then
        if [ ! -f /var/lib/aide/aide.db ]; then
            print_info "Initializing AIDE database..."
            sudo aide --init > /dev/null 2>&1 || print_warning "AIDE init failed"
        fi
    fi
    
    print_success "Security tools configured"
}

################################################################################
# Create Systemd Service
################################################################################

create_systemd_service() {
    print_step "Creating System Service"
    
    if [ "$OS" = "macos" ]; then
        print_info "Skipping systemd service (macOS uses launchd)"
        return
    fi
    
    if ! prompt_yes_no "Create systemd service for auto-start?" "y"; then
        print_info "Skipping service creation"
        return
    fi
    
    SERVICE_FILE="/etc/systemd/system/ai-security-scanner.service"
    
    sudo tee "$SERVICE_FILE" > /dev/null << EOF
[Unit]
Description=AI Security Scanner Web UI
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$INSTALL_DIR/web-ui
Environment=NODE_ENV=production
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

    sudo systemctl daemon-reload
    sudo systemctl enable ai-security-scanner
    
    print_success "Systemd service created"
    print_info "Start with: sudo systemctl start ai-security-scanner"
    print_info "View logs: sudo journalctl -u ai-security-scanner -f"
}

################################################################################
# Firewall Configuration
################################################################################

configure_firewall() {
    print_step "Configuring Firewall"
    
    if ! prompt_yes_no "Open firewall port $WEB_UI_PORT?" "y"; then
        print_info "Skipping firewall configuration"
        return
    fi
    
    if command -v ufw &> /dev/null; then
        sudo ufw allow $WEB_UI_PORT/tcp > /dev/null 2>&1
        print_success "UFW: Port $WEB_UI_PORT opened"
    elif command -v firewall-cmd &> /dev/null; then
        sudo firewall-cmd --permanent --add-port=$WEB_UI_PORT/tcp > /dev/null 2>&1
        sudo firewall-cmd --reload > /dev/null 2>&1
        print_success "Firewalld: Port $WEB_UI_PORT opened"
    else
        print_warning "No firewall detected or manual configuration needed"
    fi
}

################################################################################
# SSL Certificate Setup
################################################################################

setup_ssl() {
    print_step "SSL/TLS Certificate Setup"
    
    if ! prompt_yes_no "Configure SSL/TLS certificates?" "n"; then
        print_info "Skipping SSL setup (you can configure later)"
        return
    fi
    
    echo ""
    echo "SSL Certificate Options:"
    echo "1) Let's Encrypt (free, requires domain name)"
    echo "2) Self-signed certificate (for testing)"
    echo "3) Use existing certificates"
    echo "4) Skip SSL setup"
    echo ""
    read -p "Select option [1-4]: " ssl_option
    
    case $ssl_option in
        1)
            setup_letsencrypt
            ;;
        2)
            setup_selfsigned
            ;;
        3)
            setup_existing_cert
            ;;
        *)
            print_info "Skipping SSL setup"
            ;;
    esac
}

setup_letsencrypt() {
    read -p "Enter your domain name: " domain
    read -p "Enter your email address: " email
    
    # Install certbot
    if ! command -v certbot &> /dev/null; then
        print_info "Installing certbot..."
        case "$OS" in
            ubuntu|debian)
                sudo apt-get install -y certbot
                ;;
            centos|rhel|fedora)
                sudo yum install -y certbot
                ;;
        esac
    fi
    
    print_info "Obtaining Let's Encrypt certificate..."
    sudo certbot certonly --standalone -d "$domain" --email "$email" --agree-tos --non-interactive
    
    CERT_PATH="/etc/letsencrypt/live/$domain/fullchain.pem"
    KEY_PATH="/etc/letsencrypt/live/$domain/privkey.pem"
    
    # Update .env
    sed -i "s|SSL_CERT_PATH=.*|SSL_CERT_PATH=$CERT_PATH|" "$INSTALL_DIR/web-ui/.env"
    sed -i "s|SSL_KEY_PATH=.*|SSL_KEY_PATH=$KEY_PATH|" "$INSTALL_DIR/web-ui/.env"
    sed -i "s|FORCE_HTTPS=.*|FORCE_HTTPS=true|" "$INSTALL_DIR/web-ui/.env"
    
    print_success "Let's Encrypt certificate configured"
}

setup_selfsigned() {
    CERT_DIR="$INSTALL_DIR/web-ui/certs"
    mkdir -p "$CERT_DIR"
    
    print_info "Generating self-signed certificate..."
    openssl req -x509 -newkey rsa:4096 -keyout "$CERT_DIR/key.pem" -out "$CERT_DIR/cert.pem" \
        -days 365 -nodes -subj "/CN=localhost" > /dev/null 2>&1
    
    # Update .env
    sed -i "s|SSL_CERT_PATH=.*|SSL_CERT_PATH=$CERT_DIR/cert.pem|" "$INSTALL_DIR/web-ui/.env"
    sed -i "s|SSL_KEY_PATH=.*|SSL_KEY_PATH=$CERT_DIR/key.pem|" "$INSTALL_DIR/web-ui/.env"
    
    print_success "Self-signed certificate created"
    print_warning "Note: Browsers will show security warnings for self-signed certificates"
}

setup_existing_cert() {
    read -p "Enter path to certificate file: " cert_path
    read -p "Enter path to private key file: " key_path
    
    if [ ! -f "$cert_path" ] || [ ! -f "$key_path" ]; then
        print_error "Certificate or key file not found"
        return
    fi
    
    # Update .env
    sed -i "s|SSL_CERT_PATH=.*|SSL_CERT_PATH=$cert_path|" "$INSTALL_DIR/web-ui/.env"
    sed -i "s|SSL_KEY_PATH=.*|SSL_KEY_PATH=$key_path|" "$INSTALL_DIR/web-ui/.env"
    
    print_success "Existing certificates configured"
}

################################################################################
# Test Installation
################################################################################

test_installation() {
    print_step "Testing Installation"
    
    cd "$INSTALL_DIR/web-ui"
    
    # Test syntax
    print_info "Checking syntax..."
    node -c server.js && print_success "Server syntax OK" || print_error "Syntax error in server.js"
    node -c mfa.js && print_success "MFA module OK" || print_error "Syntax error in mfa.js"
    node -c security.js && print_success "Security module OK" || print_error "Syntax error in security.js"
    
    # Check permissions
    print_info "Checking permissions..."
    chmod +x ../scripts/*.sh 2>/dev/null
    chmod +x ../compliance/*.sh 2>/dev/null
    chmod +x ../cloud-security/*.sh 2>/dev/null
    print_success "Permissions set"
}

################################################################################
# Start Server
################################################################################

start_server() {
    print_step "Starting Server"
    
    if ! prompt_yes_no "Start the AI Security Scanner now?" "y"; then
        print_info "You can start manually with: cd $INSTALL_DIR/web-ui && node server.js"
        return
    fi
    
    cd "$INSTALL_DIR/web-ui"
    
    print_info "Starting server on port $WEB_UI_PORT..."
    print_info "Press Ctrl+C to stop the server"
    echo ""
    
    node server.js
}

################################################################################
# Show Summary
################################################################################

show_summary() {
    print_step "Installation Complete!"
    
    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                                                                  ║${NC}"
    echo -e "${GREEN}║           AI Security Scanner v3.1.0                            ║${NC}"
    echo -e "${GREEN}║           Installation Successful!                               ║${NC}"
    echo -e "${GREEN}║                                                                  ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    print_success "Installation Directory: $INSTALL_DIR"
    print_success "Web UI Port: $WEB_UI_PORT"
    print_success "Configuration: $INSTALL_DIR/web-ui/.env"
    echo ""
    
    print_info "Access the Web UI:"
    if grep -q "SSL_CERT_PATH=.*pem" "$INSTALL_DIR/web-ui/.env" 2>/dev/null; then
        echo -e "  ${CYAN}https://localhost:$WEB_UI_PORT${NC}"
    else
        echo -e "  ${CYAN}http://localhost:$WEB_UI_PORT${NC}"
    fi
    echo ""
    
    print_info "Start the server:"
    echo "  cd $INSTALL_DIR/web-ui"
    echo "  node server.js"
    echo ""
    
    if [ -f "/etc/systemd/system/ai-security-scanner.service" ]; then
        print_info "Or use systemd service:"
        echo "  sudo systemctl start ai-security-scanner"
        echo "  sudo systemctl status ai-security-scanner"
        echo ""
    fi
    
    print_info "Documentation:"
    echo "  Quick Start: $INSTALL_DIR/QUICK_START_SECURITY_FEATURES.md"
    echo "  Full Docs:   $INSTALL_DIR/SECURITY_ENHANCEMENTS_v3.1.0.md"
    echo "  Changelog:   $INSTALL_DIR/CHANGELOG_v3.1.0.md"
    echo ""
    
    print_info "Security Features:"
    echo "  ✓ Multi-Factor Authentication (MFA)"
    echo "  ✓ OAuth 2.0 (Google/Microsoft)"
    echo "  ✓ Rate Limiting"
    echo "  ✓ Audit Logging"
    echo "  ✓ Automated Backups"
    echo "  ✓ SSL/TLS Support"
    echo "  ✓ 10 Compliance Frameworks"
    echo ""
    
    print_warning "First Steps:"
    echo "  1. Access the web UI"
    echo "  2. Create admin account"
    echo "  3. Enable MFA for security"
    echo "  4. Configure OAuth (optional)"
    echo "  5. Run your first security scan"
    echo ""
    
    print_info "Need help? Check the documentation or visit:"
    echo "  https://github.com/ssfdre38/ai-security-scanner"
    echo ""
}

################################################################################
# Main Installation Flow
################################################################################

main() {
    echo "This script will install the AI Security Scanner with all security features."
    echo "It supports Ubuntu, Debian, CentOS, RHEL, Fedora, Arch, and macOS."
    echo ""
    
    if ! prompt_yes_no "Continue with installation?" "y"; then
        print_info "Installation cancelled"
        exit 0
    fi
    
    detect_os
    check_nodejs
    
    if prompt_yes_no "Install system dependencies?" "y"; then
        install_dependencies
    fi
    
    download_repository
    install_npm_packages
    configure_environment
    
    if prompt_yes_no "Install security scanning tools (ClamAV, rkhunter)?" "y"; then
        install_security_tools
    fi
    
    if [ "$OS" != "macos" ]; then
        create_systemd_service
    fi
    
    configure_firewall
    setup_ssl
    test_installation
    show_summary
    
    if prompt_yes_no "Start server now?" "y"; then
        start_server
    fi
}

# Run main installation
main

exit 0
