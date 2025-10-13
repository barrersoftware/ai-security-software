#!/bin/bash

###############################################################################
# Complete VPN Installation Script
# Installs both WireGuard and OpenVPN
###############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=================================================${NC}"
echo -e "${BLUE}  AI Security Scanner - VPN Installation${NC}"
echo -e "${BLUE}=================================================${NC}"
echo ""
echo -e "This script will install and configure:"
echo -e "  • WireGuard VPN Server"
echo -e "  • OpenVPN Server"
echo ""
echo -e "${YELLOW}Warning: This will modify system network configuration${NC}"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Error: This script must be run as root${NC}"
  echo "Please run: sudo $0"
  exit 1
fi

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Ask for confirmation
read -p "Do you want to continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Installation cancelled."
  exit 0
fi
echo ""

# Ask which VPN to install
echo -e "${BLUE}Select VPN servers to install:${NC}"
echo "  1) WireGuard only"
echo "  2) OpenVPN only"
echo "  3) Both WireGuard and OpenVPN (recommended)"
echo ""
read -p "Enter your choice (1-3): " VPN_CHOICE

case $VPN_CHOICE in
  1)
    INSTALL_WIREGUARD=true
    INSTALL_OPENVPN=false
    ;;
  2)
    INSTALL_WIREGUARD=false
    INSTALL_OPENVPN=true
    ;;
  3)
    INSTALL_WIREGUARD=true
    INSTALL_OPENVPN=true
    ;;
  *)
    echo -e "${RED}Invalid choice${NC}"
    exit 1
    ;;
esac

echo ""
echo -e "${GREEN}Starting installation...${NC}"
echo ""

# Install WireGuard
if [ "$INSTALL_WIREGUARD" = true ]; then
  echo -e "${BLUE}=== Installing WireGuard ===${NC}"
  if [ -f "${SCRIPT_DIR}/install-wireguard.sh" ]; then
    bash "${SCRIPT_DIR}/install-wireguard.sh"
  else
    echo -e "${RED}Error: install-wireguard.sh not found${NC}"
    exit 1
  fi
  echo ""
  echo -e "${GREEN}WireGuard installation complete!${NC}"
  echo ""
  sleep 2
fi

# Install OpenVPN
if [ "$INSTALL_OPENVPN" = true ]; then
  echo -e "${BLUE}=== Installing OpenVPN ===${NC}"
  if [ -f "${SCRIPT_DIR}/install-openvpn.sh" ]; then
    bash "${SCRIPT_DIR}/install-openvpn.sh"
  else
    echo -e "${RED}Error: install-openvpn.sh not found${NC}"
    exit 1
  fi
  echo ""
  echo -e "${GREEN}OpenVPN installation complete!${NC}"
  echo ""
  sleep 2
fi

# Display final summary
echo ""
echo -e "${BLUE}=================================================${NC}"
echo -e "${BLUE}  Installation Complete!${NC}"
echo -e "${BLUE}=================================================${NC}"
echo ""

if [ "$INSTALL_WIREGUARD" = true ]; then
  echo -e "${GREEN}✓ WireGuard VPN Server${NC}"
  echo -e "  Interface: wg0"
  echo -e "  Port: 51820/udp"
  echo -e "  Network: 10.8.0.0/24"
  echo ""
fi

if [ "$INSTALL_OPENVPN" = true ]; then
  echo -e "${GREEN}✓ OpenVPN Server${NC}"
  echo -e "  Port: 1194/udp"
  echo -e "  Network: 10.9.0.0/24"
  echo ""
fi

echo -e "${YELLOW}Next Steps:${NC}"
echo ""
echo -e "1. Access the AI Security Scanner Web UI"
echo -e "   Navigate to: http://your-server:3001"
echo ""
echo -e "2. Go to VPN Management section"
echo -e "   - View VPN status"
echo -e "   - Generate client configurations"
echo -e "   - Monitor connections"
echo ""
echo -e "3. Create VPN clients for your devices"
echo -e "   - Mobile devices (iOS, Android)"
echo -e "   - Desktops (Windows, macOS, Linux)"
echo -e "   - Download and import the generated configs"
echo ""
echo -e "${GREEN}Security Recommendations:${NC}"
echo -e "  • Change default ports if needed"
echo -e "  • Use strong client names/passwords"
echo -e "  • Regularly review connected clients"
echo -e "  • Monitor VPN logs for suspicious activity"
echo -e "  • Keep VPN software updated"
echo ""
echo -e "${BLUE}For support and documentation:${NC}"
echo -e "  https://github.com/your-repo/ai-security-scanner"
echo ""
echo -e "${GREEN}Done! Your VPN servers are ready to use.${NC}"
