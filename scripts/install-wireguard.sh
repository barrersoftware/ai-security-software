#!/bin/bash

###############################################################################
# WireGuard Installation Script
# Installs and configures WireGuard VPN server
###############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
WG_INTERFACE="wg0"
WG_PORT=51820
WG_ADDRESS="10.8.0.1/24"
WG_CONFIG_DIR="/etc/wireguard"

echo -e "${GREEN}=====================================${NC}"
echo -e "${GREEN}WireGuard VPN Server Installation${NC}"
echo -e "${GREEN}=====================================${NC}"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Error: This script must be run as root${NC}"
  exit 1
fi

# Detect OS
if [ -f /etc/os-release ]; then
  . /etc/os-release
  OS=$ID
  VERSION=$VERSION_ID
else
  echo -e "${RED}Error: Cannot detect operating system${NC}"
  exit 1
fi

echo -e "${YELLOW}Detected OS: $OS $VERSION${NC}"
echo ""

# Install WireGuard based on OS
echo -e "${GREEN}[1/6] Installing WireGuard...${NC}"

case "$OS" in
  ubuntu|debian)
    apt-get update
    apt-get install -y wireguard wireguard-tools qrencode iptables resolvconf
    ;;
  centos|rhel|fedora)
    if command -v dnf &> /dev/null; then
      dnf install -y wireguard-tools qrencode iptables
    else
      yum install -y epel-release
      yum install -y wireguard-tools qrencode iptables
    fi
    ;;
  *)
    echo -e "${RED}Unsupported OS: $OS${NC}"
    exit 1
    ;;
esac

echo -e "${GREEN}✓ WireGuard installed successfully${NC}"
echo ""

# Enable IP forwarding
echo -e "${GREEN}[2/6] Enabling IP forwarding...${NC}"
echo "net.ipv4.ip_forward=1" >> /etc/sysctl.conf
echo "net.ipv6.conf.all.forwarding=1" >> /etc/sysctl.conf
sysctl -p
echo -e "${GREEN}✓ IP forwarding enabled${NC}"
echo ""

# Create configuration directory
echo -e "${GREEN}[3/6] Creating configuration directory...${NC}"
mkdir -p "$WG_CONFIG_DIR"
chmod 700 "$WG_CONFIG_DIR"
echo -e "${GREEN}✓ Configuration directory created${NC}"
echo ""

# Generate server keys
echo -e "${GREEN}[4/6] Generating server keys...${NC}"
cd "$WG_CONFIG_DIR"
wg genkey | tee server_private.key | wg pubkey > server_public.key
chmod 600 server_private.key

SERVER_PRIVATE_KEY=$(cat server_private.key)
SERVER_PUBLIC_KEY=$(cat server_public.key)

echo -e "${GREEN}✓ Server keys generated${NC}"
echo -e "  Public Key: ${YELLOW}$SERVER_PUBLIC_KEY${NC}"
echo ""

# Detect network interface
echo -e "${GREEN}[5/6] Detecting network interface...${NC}"
NETWORK_INTERFACE=$(ip route | grep default | awk '{print $5}' | head -n1)
if [ -z "$NETWORK_INTERFACE" ]; then
  NETWORK_INTERFACE="eth0"
fi
echo -e "  Using interface: ${YELLOW}$NETWORK_INTERFACE${NC}"
echo ""

# Create server configuration
echo -e "${GREEN}[6/6] Creating server configuration...${NC}"
cat > "${WG_CONFIG_DIR}/${WG_INTERFACE}.conf" << EOF
[Interface]
# Server configuration for WireGuard
Address = ${WG_ADDRESS}
ListenPort = ${WG_PORT}
PrivateKey = ${SERVER_PRIVATE_KEY}

# Forwarding and NAT rules
PostUp = iptables -A FORWARD -i ${WG_INTERFACE} -j ACCEPT; iptables -t nat -A POSTROUTING -o ${NETWORK_INTERFACE} -j MASQUERADE; ip6tables -A FORWARD -i ${WG_INTERFACE} -j ACCEPT; ip6tables -t nat -A POSTROUTING -o ${NETWORK_INTERFACE} -j MASQUERADE
PostDown = iptables -D FORWARD -i ${WG_INTERFACE} -j ACCEPT; iptables -t nat -D POSTROUTING -o ${NETWORK_INTERFACE} -j MASQUERADE; ip6tables -D FORWARD -i ${WG_INTERFACE} -j ACCEPT; ip6tables -t nat -D POSTROUTING -o ${NETWORK_INTERFACE} -j MASQUERADE

# DNS (Cloudflare and Google)
# DNS = 1.1.1.1, 8.8.8.8

# Add client peers below with format:
# [Peer]
# PublicKey = CLIENT_PUBLIC_KEY
# AllowedIPs = CLIENT_IP/32
# PresharedKey = PSK (optional)
EOF

chmod 600 "${WG_CONFIG_DIR}/${WG_INTERFACE}.conf"
echo -e "${GREEN}✓ Server configuration created${NC}"
echo ""

# Enable WireGuard service
echo -e "${GREEN}Enabling WireGuard service...${NC}"
systemctl enable wg-quick@${WG_INTERFACE}

# Start WireGuard
echo -e "${GREEN}Starting WireGuard...${NC}"
if systemctl start wg-quick@${WG_INTERFACE}; then
  echo -e "${GREEN}✓ WireGuard started successfully${NC}"
else
  echo -e "${YELLOW}⚠ WireGuard failed to start (may need manual configuration)${NC}"
fi
echo ""

# Configure firewall
echo -e "${GREEN}Configuring firewall...${NC}"
if command -v ufw &> /dev/null; then
  ufw allow ${WG_PORT}/udp
  echo -e "${GREEN}✓ UFW rule added${NC}"
elif command -v firewall-cmd &> /dev/null; then
  firewall-cmd --permanent --add-port=${WG_PORT}/udp
  firewall-cmd --reload
  echo -e "${GREEN}✓ Firewalld rule added${NC}"
fi
echo ""

# Display status
echo -e "${GREEN}=====================================${NC}"
echo -e "${GREEN}Installation Complete!${NC}"
echo -e "${GREEN}=====================================${NC}"
echo ""
echo -e "WireGuard Status:"
wg show || echo "Not running yet"
echo ""
echo -e "${YELLOW}Configuration:${NC}"
echo -e "  Interface: ${WG_INTERFACE}"
echo -e "  Port: ${WG_PORT}"
echo -e "  Address: ${WG_ADDRESS}"
echo -e "  Config: ${WG_CONFIG_DIR}/${WG_INTERFACE}.conf"
echo ""
echo -e "${YELLOW}Server Public Key:${NC}"
echo -e "  ${SERVER_PUBLIC_KEY}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo -e "  1. Use the AI Security Scanner web UI to generate client configurations"
echo -e "  2. Or manually add peers to: ${WG_CONFIG_DIR}/${WG_INTERFACE}.conf"
echo -e "  3. Restart WireGuard: systemctl restart wg-quick@${WG_INTERFACE}"
echo ""
echo -e "${GREEN}Done!${NC}"
