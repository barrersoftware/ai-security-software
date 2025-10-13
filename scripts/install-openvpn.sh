#!/bin/bash

###############################################################################
# OpenVPN Installation Script
# Installs and configures OpenVPN server with Easy-RSA PKI
###############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
OVPN_PORT=1194
OVPN_PROTOCOL="udp"
OVPN_NETWORK="10.9.0.0"
OVPN_NETMASK="255.255.255.0"
OVPN_CONFIG_DIR="/etc/openvpn"
OVPN_LOG_DIR="/var/log/openvpn"

echo -e "${GREEN}=====================================${NC}"
echo -e "${GREEN}OpenVPN Server Installation${NC}"
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

# Install OpenVPN and Easy-RSA
echo -e "${GREEN}[1/7] Installing OpenVPN and Easy-RSA...${NC}"

case "$OS" in
  ubuntu|debian)
    apt-get update
    apt-get install -y openvpn easy-rsa iptables
    ;;
  centos|rhel|fedora)
    if command -v dnf &> /dev/null; then
      dnf install -y epel-release
      dnf install -y openvpn easy-rsa iptables
    else
      yum install -y epel-release
      yum install -y openvpn easy-rsa iptables
    fi
    ;;
  *)
    echo -e "${RED}Unsupported OS: $OS${NC}"
    exit 1
    ;;
esac

echo -e "${GREEN}✓ OpenVPN and Easy-RSA installed${NC}"
echo ""

# Enable IP forwarding
echo -e "${GREEN}[2/7] Enabling IP forwarding...${NC}"
echo "net.ipv4.ip_forward=1" >> /etc/sysctl.conf
sysctl -p
echo -e "${GREEN}✓ IP forwarding enabled${NC}"
echo ""

# Setup Easy-RSA
echo -e "${GREEN}[3/7] Setting up Easy-RSA PKI...${NC}"
make-cadir ${OVPN_CONFIG_DIR}/easy-rsa
cd ${OVPN_CONFIG_DIR}/easy-rsa

# Configure Easy-RSA vars
cat > vars << EOF
set_var EASYRSA_REQ_COUNTRY    "US"
set_var EASYRSA_REQ_PROVINCE   "California"
set_var EASYRSA_REQ_CITY       "San Francisco"
set_var EASYRSA_REQ_ORG        "AI Security Scanner"
set_var EASYRSA_REQ_EMAIL      "admin@example.com"
set_var EASYRSA_REQ_OU         "VPN"
set_var EASYRSA_KEY_SIZE       2048
set_var EASYRSA_ALGO           rsa
set_var EASYRSA_CA_EXPIRE      3650
set_var EASYRSA_CERT_EXPIRE    3650
EOF

# Initialize PKI
./easyrsa init-pki
echo -e "${GREEN}✓ PKI initialized${NC}"
echo ""

# Build CA
echo -e "${GREEN}[4/7] Building Certificate Authority...${NC}"
EASYRSA_BATCH=1 ./easyrsa build-ca nopass
echo -e "${GREEN}✓ CA certificate created${NC}"
echo ""

# Generate server certificate
echo -e "${GREEN}[5/7] Generating server certificate...${NC}"
EASYRSA_BATCH=1 ./easyrsa build-server-full server nopass
echo -e "${GREEN}✓ Server certificate created${NC}"
echo ""

# Generate Diffie-Hellman parameters
echo -e "${GREEN}[6/7] Generating Diffie-Hellman parameters (this may take a while)...${NC}"
./easyrsa gen-dh
echo -e "${GREEN}✓ DH parameters generated${NC}"
echo ""

# Generate TLS auth key
openvpn --genkey secret pki/ta.key
echo -e "${GREEN}✓ TLS auth key generated${NC}"
echo ""

# Detect network interface
echo -e "${GREEN}Detecting network interface...${NC}"
NETWORK_INTERFACE=$(ip route | grep default | awk '{print $5}' | head -n1)
if [ -z "$NETWORK_INTERFACE" ]; then
  NETWORK_INTERFACE="eth0"
fi
echo -e "  Using interface: ${YELLOW}$NETWORK_INTERFACE${NC}"
echo ""

# Create server configuration
echo -e "${GREEN}[7/7] Creating server configuration...${NC}"
cat > ${OVPN_CONFIG_DIR}/server.conf << EOF
# OpenVPN Server Configuration
port ${OVPN_PORT}
proto ${OVPN_PROTOCOL}
dev tun

# Certificates and keys
ca ${OVPN_CONFIG_DIR}/easy-rsa/pki/ca.crt
cert ${OVPN_CONFIG_DIR}/easy-rsa/pki/issued/server.crt
key ${OVPN_CONFIG_DIR}/easy-rsa/pki/private/server.key
dh ${OVPN_CONFIG_DIR}/easy-rsa/pki/dh.pem

# Network configuration
server ${OVPN_NETWORK} ${OVPN_NETMASK}
ifconfig-pool-persist ${OVPN_LOG_DIR}/ipp.txt

# Push routes to client
push "redirect-gateway def1 bypass-dhcp"
push "dhcp-option DNS 1.1.1.1"
push "dhcp-option DNS 8.8.8.8"

# Client configuration
client-to-client
keepalive 10 120
cipher AES-256-GCM
auth SHA256
compress lz4-v2
push "compress lz4-v2"

# Maximum clients
max-clients 100

# Privileges
user nobody
group nogroup

# Persistence
persist-key
persist-tun

# Status and logging
status ${OVPN_LOG_DIR}/openvpn-status.log
log-append ${OVPN_LOG_DIR}/openvpn.log
verb 3
mute 20

# Security
tls-auth ${OVPN_CONFIG_DIR}/easy-rsa/pki/ta.key 0
tls-version-min 1.2
tls-cipher TLS-ECDHE-RSA-WITH-AES-256-GCM-SHA384
EOF

echo -e "${GREEN}✓ Server configuration created${NC}"
echo ""

# Create log directory
mkdir -p ${OVPN_LOG_DIR}
chown nobody:nogroup ${OVPN_LOG_DIR}

# Configure firewall rules
echo -e "${GREEN}Configuring NAT and firewall...${NC}"

# Add NAT rule
iptables -t nat -A POSTROUTING -s ${OVPN_NETWORK}/24 -o ${NETWORK_INTERFACE} -j MASQUERADE

# Save iptables rules
if command -v iptables-save &> /dev/null; then
  if [ -d /etc/iptables ]; then
    iptables-save > /etc/iptables/rules.v4
  fi
fi

# Configure firewall
if command -v ufw &> /dev/null; then
  ufw allow ${OVPN_PORT}/${OVPN_PROTOCOL}
  echo -e "${GREEN}✓ UFW rule added${NC}"
elif command -v firewall-cmd &> /dev/null; then
  firewall-cmd --permanent --add-port=${OVPN_PORT}/${OVPN_PROTOCOL}
  firewall-cmd --permanent --add-masquerade
  firewall-cmd --reload
  echo -e "${GREEN}✓ Firewalld rules added${NC}"
fi
echo ""

# Enable and start OpenVPN
echo -e "${GREEN}Enabling OpenVPN service...${NC}"
systemctl enable openvpn@server
systemctl start openvpn@server

# Check status
sleep 2
if systemctl is-active --quiet openvpn@server; then
  echo -e "${GREEN}✓ OpenVPN started successfully${NC}"
else
  echo -e "${YELLOW}⚠ OpenVPN may need manual configuration${NC}"
fi
echo ""

# Display status
echo -e "${GREEN}=====================================${NC}"
echo -e "${GREEN}Installation Complete!${NC}"
echo -e "${GREEN}=====================================${NC}"
echo ""
echo -e "OpenVPN Status:"
systemctl status openvpn@server --no-pager || true
echo ""
echo -e "${YELLOW}Configuration:${NC}"
echo -e "  Port: ${OVPN_PORT}"
echo -e "  Protocol: ${OVPN_PROTOCOL}"
echo -e "  Network: ${OVPN_NETWORK}/${OVPN_NETMASK}"
echo -e "  Config: ${OVPN_CONFIG_DIR}/server.conf"
echo -e "  CA Certificate: ${OVPN_CONFIG_DIR}/easy-rsa/pki/ca.crt"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo -e "  1. Use the AI Security Scanner web UI to generate client configurations"
echo -e "  2. Or use Easy-RSA to manually create client certificates:"
echo -e "     cd ${OVPN_CONFIG_DIR}/easy-rsa"
echo -e "     ./easyrsa build-client-full client1 nopass"
echo ""
echo -e "${GREEN}Done!${NC}"
