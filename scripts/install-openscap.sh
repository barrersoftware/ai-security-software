#!/bin/bash

###################################################
# AI Security Scanner - OpenSCAP Installation
# Install OpenSCAP scanner and SCAP Security Guide
###################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${GREEN}🛡️  Installing OpenSCAP Security Scanner${NC}\n"

# Check if running as root
if [[ $EUID -ne 0 ]]; then
    echo -e "${YELLOW}⚠️  This script requires root privileges${NC}"
    echo -e "${YELLOW}Please run with sudo${NC}\n"
    exit 1
fi

# Detect OS
detect_os() {
    if [[ -f /etc/os-release ]]; then
        . /etc/os-release
        echo "$ID"
    else
        echo "unknown"
    fi
}

OS=$(detect_os)

echo -e "${BLUE}Detected OS: $OS${NC}\n"

# Install based on OS
case "$OS" in
    ubuntu|debian)
        echo -e "${CYAN}Installing OpenSCAP on Debian/Ubuntu...${NC}\n"
        
        apt-get update
        
        # Install OpenSCAP packages
        apt-get install -y \
            libopenscap8 \
            openscap-scanner \
            openscap-utils \
            scap-security-guide \
            ssg-base \
            ssg-debderived \
            ssg-debian \
            ssg-nondebian
        
        # Install SCAP Workbench (optional GUI)
        if [[ "$1" == "--with-gui" ]]; then
            apt-get install -y scap-workbench
        fi
        
        echo ""
        echo -e "${GREEN}✅ OpenSCAP installed successfully!${NC}\n"
        ;;
        
    rhel|centos|rocky|almalinux|fedora)
        echo -e "${CYAN}Installing OpenSCAP on RHEL/CentOS/Fedora...${NC}\n"
        
        # Determine package manager
        if command -v dnf &>/dev/null; then
            PKG_MGR="dnf"
        else
            PKG_MGR="yum"
        fi
        
        # Install OpenSCAP packages
        $PKG_MGR install -y \
            openscap \
            openscap-scanner \
            openscap-utils \
            scap-security-guide
        
        # Install SCAP Workbench (optional GUI)
        if [[ "$1" == "--with-gui" ]]; then
            $PKG_MGR install -y scap-workbench
        fi
        
        echo ""
        echo -e "${GREEN}✅ OpenSCAP installed successfully!${NC}\n"
        ;;
        
    arch)
        echo -e "${CYAN}Installing OpenSCAP on Arch Linux...${NC}\n"
        
        pacman -Sy --noconfirm \
            openscap \
            scap-security-guide
        
        echo ""
        echo -e "${GREEN}✅ OpenSCAP installed successfully!${NC}\n"
        ;;
        
    opensuse*)
        echo -e "${CYAN}Installing OpenSCAP on openSUSE...${NC}\n"
        
        zypper install -y \
            openscap \
            openscap-utils \
            scap-security-guide
        
        echo ""
        echo -e "${GREEN}✅ OpenSCAP installed successfully!${NC}\n"
        ;;
        
    *)
        echo -e "${RED}❌ Unsupported OS: $OS${NC}"
        echo ""
        echo "Please install OpenSCAP manually:"
        echo "  - OpenSCAP: https://www.open-scap.org/download/"
        echo "  - SCAP Security Guide: https://github.com/ComplianceAsCode/content"
        exit 1
        ;;
esac

# Verify installation
echo -e "${CYAN}Verifying installation...${NC}\n"

if command -v oscap &>/dev/null; then
    oscap_version=$(oscap --version 2>&1 | head -1)
    echo -e "${GREEN}✅ OpenSCAP version: $oscap_version${NC}"
else
    echo -e "${RED}❌ OpenSCAP installation failed${NC}"
    exit 1
fi

# Check for SCAP content
echo ""
echo -e "${CYAN}Checking for SCAP Security Guide content...${NC}\n"

CONTENT_DIR="/usr/share/xml/scap/ssg/content"

if [[ -d "$CONTENT_DIR" ]]; then
    echo -e "${GREEN}✅ SCAP content directory found${NC}"
    echo ""
    echo "Available SCAP content files:"
    ls -1 "$CONTENT_DIR"/*.xml 2>/dev/null | while read file; do
        echo "  - $(basename $file)"
    done
else
    echo -e "${YELLOW}⚠️  SCAP content directory not found at $CONTENT_DIR${NC}"
    echo "Some distributions install content in different locations."
fi

# Download DISA STIGs (optional)
echo ""
echo -e "${CYAN}DISA STIG Content${NC}\n"
echo "DISA STIGs are available from: https://public.cyber.mil/stigs/"
echo ""
echo "The SCAP Security Guide includes STIG profiles for:"
echo "  - Red Hat Enterprise Linux"
echo "  - Ubuntu"
echo "  - Debian"
echo "  - And other systems"
echo ""

# Create example usage script
echo -e "${CYAN}Creating example usage scripts...${NC}\n"

cat > /tmp/openscap-example.sh << 'EOFSCRIPT'
#!/bin/bash

# Example OpenSCAP scans

# List available profiles
echo "Available profiles:"
oscap info /usr/share/xml/scap/ssg/content/ssg-*.xml 2>/dev/null | grep "Profile" | head -5

echo ""
echo "Example scans:"
echo ""

# Standard security profile
echo "1. Standard Security Profile:"
echo "   oscap xccdf eval --profile standard --report report.html /usr/share/xml/scap/ssg/content/ssg-*.xml"
echo ""

# PCI-DSS compliance
echo "2. PCI-DSS Compliance:"
echo "   oscap xccdf eval --profile pci-dss --report pci-report.html /usr/share/xml/scap/ssg/content/ssg-*.xml"
echo ""

# DISA STIG
echo "3. DISA STIG:"
echo "   oscap xccdf eval --profile stig --report stig-report.html /usr/share/xml/scap/ssg/content/ssg-*.xml"
echo ""

# CIS Benchmark
echo "4. CIS Benchmark:"
echo "   oscap xccdf eval --profile cis --report cis-report.html /usr/share/xml/scap/ssg/content/ssg-*.xml"
echo ""

EOFSCRIPT

chmod +x /tmp/openscap-example.sh

# Display summary
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ OpenSCAP Installation Complete${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${CYAN}Quick Start:${NC}"
echo ""
echo "1. Run OpenSCAP scan:"
echo "   cd $(dirname $0)/../compliance"
echo "   sudo ./scan-openscap.sh --profile standard"
echo ""
echo "2. Run DISA STIG scan:"
echo "   sudo ./scan-disa-stig.sh"
echo ""
echo "3. List available profiles:"
echo "   sudo ./scan-openscap.sh --list-profiles"
echo ""
echo -e "${CYAN}Security Profiles Available:${NC}"
echo "  - standard          Standard security baseline"
echo "  - pci-dss           Payment Card Industry compliance"
echo "  - hipaa             Healthcare data protection"
echo "  - stig              DISA Security Technical Implementation Guide"
echo "  - cis               CIS Benchmark"
echo "  - ospp              Common Criteria OSPP"
echo ""
echo -e "${CYAN}Documentation:${NC}"
echo "  - OpenSCAP: https://www.open-scap.org/"
echo "  - SCAP Guide: https://static.open-scap.org/ssg-guides/"
echo "  - DISA STIGs: https://public.cyber.mil/stigs/"
echo ""
echo -e "${YELLOW}⚠️  Important Notes:${NC}"
echo "  - Always test scans in non-production first"
echo "  - Review reports before applying auto-remediation"
echo "  - STIG compliance is very strict for DoD systems"
echo "  - Maintain audit logs of all security changes"
echo ""
