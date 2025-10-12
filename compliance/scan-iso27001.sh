#!/bin/bash

###################################################
# AI Security Scanner - ISO 27001:2022 Scanner
# Information Security Management System compliance
###################################################

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPORT_FILE="$HOME/security-reports/iso27001_$(date +%Y%m%d_%H%M%S).md"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Run ISO/IEC 27001:2022 compliance assessment

ISO 27001 is the international standard for information security management.
This scanner checks technical controls from Annex A.

OPTIONS:
    -n, --notify                 Send notification on completion
    -v, --verbose                Verbose output
    -h, --help                   Show this help

EXAMPLES:
    # Run ISO 27001 assessment
    $0
    
    # With notifications
    $0 --notify

NOTES:
    - Focuses on technical controls from Annex A
    - ISO 27001 also requires organizational controls (policy, procedures)
    - This scan covers the technical implementation aspects

EOF
    exit 0
}

# Initialize report
init_report() {
    mkdir -p "$(dirname "$REPORT_FILE")"
    
    cat > "$REPORT_FILE" << EOF
# ISO/IEC 27001:2022 Compliance Assessment
Generated: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
Hostname: $(hostname)
Standard: ISO/IEC 27001:2022 with Annex A Controls

## Executive Summary

This assessment evaluates technical implementation of ISO/IEC 27001:2022 Annex A controls.
ISO 27001 certification requires additional organizational controls, documentation, and ISMS procedures.

## Assessment Results

EOF
}

# Annex A.5: Organizational Controls
check_organizational() {
    echo -e "${BLUE}🔍 Checking Annex A.5 - Organizational Controls...${NC}"
    
    cat >> "$REPORT_FILE" << EOF
### Annex A.5: Organizational Controls

#### A.5.1: Policies for Information Security
EOF
    
    if [[ -d /etc/security/policies ]] || [[ -f /etc/security/policy.conf ]]; then
        echo "- ✅ Security policy directory exists" >> "$REPORT_FILE"
    else
        echo "- ⚠️  No security policy directory found" >> "$REPORT_FILE"
        echo "  *Note: Create /etc/security/policies for policy documentation*" >> "$REPORT_FILE"
    fi
    
    cat >> "$REPORT_FILE" << EOF

#### A.5.10: Acceptable Use of Information
EOF
    
    # Check for usage policies
    if [[ -f /etc/motd ]] || [[ -f /etc/issue ]]; then
        echo "- ✅ Login banners configured" >> "$REPORT_FILE"
    else
        echo "- ⚠️  No login banners (usage warnings)" >> "$REPORT_FILE"
    fi
    
    echo "" >> "$REPORT_FILE"
}

# Annex A.8: Technology Controls
check_technology() {
    echo -e "${BLUE}🔍 Checking Annex A.8 - Technology Controls...${NC}"
    
    cat >> "$REPORT_FILE" << EOF
### Annex A.8: Technology Controls

#### A.8.1: User Endpoint Devices
EOF
    
    # Check for endpoint security
    if command -v ufw &>/dev/null || command -v firewalld &>/dev/null; then
        echo "- ✅ Host-based firewall available" >> "$REPORT_FILE"
    fi
    
    if command -v clamav &>/dev/null; then
        echo "- ✅ Antivirus software installed" >> "$REPORT_FILE"
    else
        echo "- ⚠️  No antivirus software detected" >> "$REPORT_FILE"
    fi
    
    cat >> "$REPORT_FILE" << EOF

#### A.8.2: Privileged Access Rights
EOF
    
    # Check sudo configuration
    if [[ -f /etc/sudoers ]]; then
        echo "- ✅ Privilege escalation controls (sudo)" >> "$REPORT_FILE"
        
        # Check for logging
        if grep -q "Defaults.*log" /etc/sudoers 2>/dev/null; then
            echo "- ✅ Privileged command logging enabled" >> "$REPORT_FILE"
        fi
    fi
    
    # Check for root login restrictions
    if grep -q "^PermitRootLogin no" /etc/ssh/sshd_config 2>/dev/null; then
        echo "- ✅ Direct root login disabled (SSH)" >> "$REPORT_FILE"
    else
        echo "- ⚠️  Direct root login allowed" >> "$REPORT_FILE"
    fi
    
    cat >> "$REPORT_FILE" << EOF

#### A.8.3: Information Access Restriction
EOF
    
    # Check file permissions
    local world_writable=$(find /etc /usr/local/etc -type f -perm -002 2>/dev/null | wc -l)
    if [[ $world_writable -eq 0 ]]; then
        echo "- ✅ No world-writable configuration files" >> "$REPORT_FILE"
    else
        echo "- ⚠️  Found $world_writable world-writable files in system directories" >> "$REPORT_FILE"
    fi
    
    cat >> "$REPORT_FILE" << EOF

#### A.8.9: Configuration Management
EOF
    
    # Check for configuration management tools
    if command -v git &>/dev/null; then
        echo "- ✅ Version control available" >> "$REPORT_FILE"
    fi
    
    if command -v ansible &>/dev/null || command -v puppet &>/dev/null; then
        echo "- ✅ Configuration management tools available" >> "$REPORT_FILE"
    else
        echo "- ⚠️  No configuration management tools detected" >> "$REPORT_FILE"
    fi
    
    cat >> "$REPORT_FILE" << EOF

#### A.8.10: Information Deletion
EOF
    
    # Check for secure deletion tools
    if command -v shred &>/dev/null || command -v srm &>/dev/null; then
        echo "- ✅ Secure deletion tools available" >> "$REPORT_FILE"
    else
        echo "- ⚠️  No secure deletion tools found" >> "$REPORT_FILE"
    fi
    
    cat >> "$REPORT_FILE" << EOF

#### A.8.16: Monitoring Activities
EOF
    
    # System monitoring
    if systemctl is-active rsyslog &>/dev/null || systemctl is-active syslog-ng &>/dev/null; then
        echo "- ✅ System logging operational" >> "$REPORT_FILE"
    else
        echo "- 🚨 **CRITICAL:** System logging not active" >> "$REPORT_FILE"
    fi
    
    if systemctl is-active auditd &>/dev/null; then
        echo "- ✅ Security audit logging operational" >> "$REPORT_FILE"
    else
        echo "- ⚠️  Security audit logging not configured" >> "$REPORT_FILE"
    fi
    
    cat >> "$REPORT_FILE" << EOF

#### A.8.18: Use of Privileged Utility Programs
EOF
    
    # Check for privilege monitoring
    if systemctl is-active auditd &>/dev/null; then
        local sudo_rules=$(auditctl -l 2>/dev/null | grep -c "sudo" || echo "0")
        if [[ $sudo_rules -gt 0 ]]; then
            echo "- ✅ Privileged command auditing configured" >> "$REPORT_FILE"
        fi
    fi
    
    cat >> "$REPORT_FILE" << EOF

#### A.8.23: Web Filtering
EOF
    
    # Check for web proxy/filtering
    if command -v squid &>/dev/null || [[ -f /etc/squid/squid.conf ]]; then
        echo "- ✅ Web proxy available" >> "$REPORT_FILE"
    else
        echo "- ⚠️  No web filtering detected" >> "$REPORT_FILE"
    fi
    
    cat >> "$REPORT_FILE" << EOF

#### A.8.24: Use of Cryptography
EOF
    
    # Encryption at rest
    if lsblk -f 2>/dev/null | grep -q "crypt"; then
        echo "- ✅ Disk encryption implemented" >> "$REPORT_FILE"
    else
        echo "- 🚨 **CRITICAL:** No disk encryption detected" >> "$REPORT_FILE"
    fi
    
    # SSL/TLS
    if command -v openssl &>/dev/null; then
        local openssl_version=$(openssl version | awk '{print $2}')
        echo "- ✅ Cryptographic tools available (OpenSSL $openssl_version)" >> "$REPORT_FILE"
    fi
    
    # Check for HTTPS
    if netstat -tuln 2>/dev/null | grep -q ":443"; then
        echo "- ✅ HTTPS services configured" >> "$REPORT_FILE"
    fi
    
    cat >> "$REPORT_FILE" << EOF

#### A.8.26: Application Security Requirements
EOF
    
    # Check for development security tools
    if command -v git &>/dev/null; then
        echo "- ✅ Version control for application development" >> "$REPORT_FILE"
    fi
    
    echo "" >> "$REPORT_FILE"
}

# Annex A.9: Physical Controls (Limited technical checks)
check_physical() {
    echo -e "${BLUE}🔍 Checking Annex A.9 - Physical Controls...${NC}"
    
    cat >> "$REPORT_FILE" << EOF
### Annex A.9: Physical Controls

*Note: Most physical controls require on-site verification*

#### A.9.1: Physical Security Perimeters
EOF
    
    echo "- ℹ️  Physical access controls require on-site assessment" >> "$REPORT_FILE"
    
    cat >> "$REPORT_FILE" << EOF

#### A.9.4: Physical Security Monitoring
EOF
    
    # Check for USB restrictions
    if [[ -f /etc/modprobe.d/usb-storage.conf ]]; then
        echo "- ✅ USB storage restrictions configured" >> "$REPORT_FILE"
    else
        echo "- ⚠️  No USB storage restrictions" >> "$REPORT_FILE"
    fi
    
    echo "" >> "$REPORT_FILE"
}

# Annex A.10: Network Security
check_network() {
    echo -e "${BLUE}🔍 Checking Network Security Controls...${NC}"
    
    cat >> "$REPORT_FILE" << EOF
### Network Security

#### Network Segmentation
EOF
    
    # Check for firewall
    if ufw status 2>/dev/null | grep -q "Status: active"; then
        echo "- ✅ Firewall active (UFW)" >> "$REPORT_FILE"
        local rule_count=$(ufw status numbered 2>/dev/null | grep -c "\[" || echo "0")
        echo "- ✅ Firewall rules configured: $rule_count" >> "$REPORT_FILE"
    elif iptables -L 2>/dev/null | grep -q "Chain INPUT"; then
        echo "- ✅ Firewall active (iptables)" >> "$REPORT_FILE"
    else
        echo "- 🚨 **CRITICAL:** No firewall configured" >> "$REPORT_FILE"
    fi
    
    cat >> "$REPORT_FILE" << EOF

#### Network Protection
EOF
    
    # Check for intrusion detection
    if command -v fail2ban-client &>/dev/null && systemctl is-active fail2ban &>/dev/null; then
        echo "- ✅ Intrusion prevention active (fail2ban)" >> "$REPORT_FILE"
        local ban_count=$(fail2ban-client status 2>/dev/null | grep "Jail list" | wc -w || echo "0")
        echo "- ✅ Protected services: $ban_count" >> "$REPORT_FILE"
    else
        echo "- ⚠️  No intrusion prevention system" >> "$REPORT_FILE"
    fi
    
    cat >> "$REPORT_FILE" << EOF

#### Secure Network Services
EOF
    
    # Check SSH configuration
    if systemctl is-active sshd &>/dev/null; then
        echo "- ✅ SSH service active" >> "$REPORT_FILE"
        
        # Check for key-based auth
        if grep -q "^PasswordAuthentication no" /etc/ssh/sshd_config 2>/dev/null; then
            echo "- ✅ SSH password authentication disabled" >> "$REPORT_FILE"
        else
            echo "- ⚠️  SSH password authentication enabled" >> "$REPORT_FILE"
        fi
        
        # Check SSH protocol
        if ! grep -q "^Protocol 1" /etc/ssh/sshd_config 2>/dev/null; then
            echo "- ✅ SSH protocol 2 enforced" >> "$REPORT_FILE"
        fi
    fi
    
    echo "" >> "$REPORT_FILE"
}

# Annex A.12: Operations Security
check_operations() {
    echo -e "${BLUE}🔍 Checking Operations Security...${NC}"
    
    cat >> "$REPORT_FILE" << EOF
### Operations Security

#### Backup Procedures
EOF
    
    # Check for backup tools
    if command -v rsync &>/dev/null || command -v restic &>/dev/null || command -v duplicity &>/dev/null; then
        echo "- ✅ Backup tools available" >> "$REPORT_FILE"
    else
        echo "- ⚠️  No backup tools detected" >> "$REPORT_FILE"
    fi
    
    # Check for scheduled backups
    if crontab -l 2>/dev/null | grep -i "backup" &>/dev/null; then
        echo "- ✅ Automated backup jobs scheduled" >> "$REPORT_FILE"
    else
        echo "- ⚠️  No scheduled backup jobs found" >> "$REPORT_FILE"
    fi
    
    cat >> "$REPORT_FILE" << EOF

#### Malware Protection
EOF
    
    # Check antivirus
    if command -v clamscan &>/dev/null; then
        echo "- ✅ Antivirus software installed (ClamAV)" >> "$REPORT_FILE"
        
        # Check if definitions are recent
        if [[ -f /var/lib/clamav/daily.cvd ]]; then
            local age=$(( ($(date +%s) - $(stat -c %Y /var/lib/clamav/daily.cvd)) / 86400 ))
            if [[ $age -le 7 ]]; then
                echo "- ✅ Virus definitions up to date (${age} days old)" >> "$REPORT_FILE"
            else
                echo "- ⚠️  Virus definitions outdated (${age} days old)" >> "$REPORT_FILE"
            fi
        fi
    else
        echo "- ⚠️  No antivirus software installed" >> "$REPORT_FILE"
    fi
    
    cat >> "$REPORT_FILE" << EOF

#### Logging and Monitoring
EOF
    
    # Log management
    if [[ -f /etc/logrotate.conf ]]; then
        echo "- ✅ Log rotation configured" >> "$REPORT_FILE"
    fi
    
    # Check log protection
    if [[ -d /var/log ]] && [[ $(stat -c %a /var/log) == "755" ]]; then
        echo "- ✅ Log directory properly protected" >> "$REPORT_FILE"
    fi
    
    cat >> "$REPORT_FILE" << EOF

#### Vulnerability Management
EOF
    
    # Check for security updates
    if systemctl is-enabled unattended-upgrades &>/dev/null || \
       systemctl is-enabled dnf-automatic &>/dev/null; then
        echo "- ✅ Automatic security updates enabled" >> "$REPORT_FILE"
    else
        echo "- ⚠️  Automatic security updates not configured" >> "$REPORT_FILE"
    fi
    
    # Check for vulnerability scanners
    if command -v oscap &>/dev/null; then
        echo "- ✅ Vulnerability scanner available (OpenSCAP)" >> "$REPORT_FILE"
    fi
    
    echo "" >> "$REPORT_FILE"
}

# Generate compliance score
generate_score() {
    local total=$(grep -cE "^- (✅|🚨|⚠️)" "$REPORT_FILE" 2>/dev/null || echo "1")
    local passed=$(grep -c "^- ✅" "$REPORT_FILE" 2>/dev/null || echo "0")
    local failed=$(grep -c "^- 🚨" "$REPORT_FILE" 2>/dev/null || echo "0")
    local warnings=$(grep -c "^- ⚠️" "$REPORT_FILE" 2>/dev/null || echo "0")
    
    local score=$(( (passed * 100) / total ))
    
    cat >> "$REPORT_FILE" << EOF

## ISO 27001 Compliance Summary

- **Standard:** ISO/IEC 27001:2022
- **Total Technical Checks:** $total
- **Passed:** $passed (${score}%)
- **Critical Failures:** $failed
- **Warnings:** $warnings

### Technical Compliance Score: $score/100

EOF
    
    if [[ $score -ge 90 ]]; then
        echo "**Status:** ✅ Strong Technical Implementation" >> "$REPORT_FILE"
    elif [[ $score -ge 75 ]]; then
        echo "**Status:** ⚠️  Good Technical Implementation (improvements needed)" >> "$REPORT_FILE"
    elif [[ $score -ge 50 ]]; then
        echo "**Status:** ⚠️  Basic Technical Implementation (significant gaps)" >> "$REPORT_FILE"
    else
        echo "**Status:** 🚨 Weak Technical Implementation (urgent action required)" >> "$REPORT_FILE"
    fi
    
    cat >> "$REPORT_FILE" << EOF

### Important Notes

**This assessment covers technical controls only.** ISO 27001 certification requires:

1. **Information Security Management System (ISMS)**
   - Security policy and objectives
   - Risk assessment methodology
   - Statement of Applicability (SoA)
   - Management review processes

2. **Documented Procedures**
   - Incident response procedures
   - Business continuity plans
   - Access control procedures
   - Change management procedures

3. **Organizational Controls**
   - Security awareness training
   - HR security procedures
   - Supplier management
   - Asset management

4. **Continuous Improvement**
   - Internal audits
   - Management reviews
   - Corrective actions
   - Preventive actions

**For full ISO 27001 certification, work with an accredited certification body.**

EOF
}

# Generate recommendations
generate_recommendations() {
    cat >> "$REPORT_FILE" << EOF

## Recommended Actions

### Critical Issues (Fix Immediately)
EOF
    
    grep "^- 🚨" "$REPORT_FILE" | sed 's/^- 🚨 \*\*CRITICAL:\*\*/1./' | sed 's/^- 🚨/1./' >> "$REPORT_FILE" || echo "None" >> "$REPORT_FILE"
    
    cat >> "$REPORT_FILE" << EOF

### Warnings (Address Within 30 Days)
EOF
    
    grep "^- ⚠️" "$REPORT_FILE" | sed 's/^- ⚠️/1./' | head -10 >> "$REPORT_FILE" || echo "None" >> "$REPORT_FILE"
    
    cat >> "$REPORT_FILE" << EOF

## ISO 27001 Resources

- **ISO 27001:2022 Standard:** https://www.iso.org/standard/27001
- **ISO 27002:2022 (Controls):** https://www.iso.org/standard/75652.html
- **Certification Bodies:** Contact accredited ISO 27001 certification bodies
- **ISMS Implementation Guide:** https://www.iso.org/isoiec-27001-information-security.html

### Next Steps for Certification

1. Conduct formal risk assessment
2. Develop ISMS documentation
3. Implement organizational controls
4. Conduct internal audits
5. Management review
6. External certification audit

---

**Report generated by AI Security Scanner - ISO 27001 Module**
EOF
}

# Main function
main() {
    local notify=false
    local verbose=false
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -n|--notify)
                notify=true
                shift
                ;;
            -v|--verbose)
                verbose=true
                shift
                ;;
            -h|--help)
                usage
                ;;
            *)
                echo -e "${RED}Unknown option: $1${NC}"
                usage
                ;;
        esac
    done
    
    echo -e "${GREEN}🛡️  ISO 27001:2022 Compliance Scanner${NC}\n"
    
    # Initialize
    init_report
    
    # Run checks
    check_organizational
    check_technology
    check_physical
    check_network
    check_operations
    
    # Generate score and recommendations
    generate_score
    generate_recommendations
    
    echo ""
    echo -e "${GREEN}✅ ISO 27001 compliance scan complete!${NC}"
    echo -e "${BLUE}📄 Report: $REPORT_FILE${NC}\n"
    
    # Display summary
    echo -e "${CYAN}Summary:${NC}"
    grep -E "^- (✅|🚨|⚠️)" "$REPORT_FILE" | head -15
    
    # Notification
    if [[ "$notify" == "true" ]] && [[ -f "$SCRIPT_DIR/../integrations/notify.sh" ]]; then
        "$SCRIPT_DIR/../integrations/notify.sh" \
            --platform all \
            --title "ISO 27001 Compliance Scan Complete" \
            --file "$REPORT_FILE" \
            --severity "info" || true
    fi
}

# Run
main "$@"
