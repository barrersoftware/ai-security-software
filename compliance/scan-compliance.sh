#!/bin/bash

###################################################
# AI Security Scanner - Compliance Framework Scanner
# PCI-DSS, HIPAA, SOC2, GDPR compliance checks
###################################################

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_REMATCH[0]}")" && pwd)"
REPORT_FILE="$HOME/security-reports/compliance_$(date +%Y%m%d_%H%M%S).md"
FRAMEWORK="${FRAMEWORK:-pci-dss}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Run compliance framework checks

OPTIONS:
    -f, --framework FRAMEWORK    Framework to check (pci-dss|hipaa|soc2|gdpr|all)
    -n, --notify                 Send notification on completion
    -v, --verbose                Verbose output
    -h, --help                   Show this help

EXAMPLES:
    # Run PCI-DSS compliance check
    $0 --framework pci-dss
    
    # Run all frameworks
    $0 --framework all --notify
    
    # Run HIPAA compliance
    $0 --framework hipaa

EOF
    exit 0
}

# Initialize report
init_report() {
    mkdir -p "$(dirname "$REPORT_FILE")"
    
    local framework_name=""
    case "$FRAMEWORK" in
        pci-dss) framework_name="PCI-DSS 3.2.1" ;;
        hipaa) framework_name="HIPAA Security Rule" ;;
        soc2) framework_name="SOC 2 Type II" ;;
        gdpr) framework_name="GDPR" ;;
        all) framework_name="Multi-Framework" ;;
    esac
    
    cat > "$REPORT_FILE" << EOF
# Compliance Security Analysis Report
Framework: $framework_name
Generated: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
Hostname: $(hostname)

## Executive Summary

EOF
}

# PCI-DSS Checks
check_pci_dss() {
    echo -e "${BLUE}🔍 Running PCI-DSS compliance checks...${NC}"
    
    cat >> "$REPORT_FILE" << EOF
## PCI-DSS 3.2.1 Compliance

### Requirement 1: Install and maintain a firewall
EOF
    
    # Check firewall
    if ufw status 2>/dev/null | grep -q "Status: active"; then
        echo "- ✅ Firewall (UFW) is active" >> "$REPORT_FILE"
    elif iptables -L 2>/dev/null | grep -q "Chain INPUT"; then
        echo "- ✅ Firewall (iptables) is configured" >> "$REPORT_FILE"
    else
        echo "- 🚨 **FAIL:** No firewall configured" >> "$REPORT_FILE"
    fi
    
    cat >> "$REPORT_FILE" << EOF

### Requirement 2: Do not use vendor-supplied defaults
EOF
    
    # Check for default passwords in common configs
    if grep -r "password.*admin\|password.*root\|password.*123" /etc 2>/dev/null | grep -v "^Binary"; then
        echo "- ⚠️  Potential default passwords found in configs" >> "$REPORT_FILE"
    else
        echo "- ✅ No obvious default passwords in configs" >> "$REPORT_FILE"
    fi
    
    # Check SSH port
    local ssh_port=$(grep "^Port " /etc/ssh/sshd_config 2>/dev/null | awk '{print $2}')
    if [[ -z "$ssh_port" ]] || [[ "$ssh_port" == "22" ]]; then
        echo "- ⚠️  SSH running on default port 22" >> "$REPORT_FILE"
    else
        echo "- ✅ SSH running on non-default port" >> "$REPORT_FILE"
    fi
    
    cat >> "$REPORT_FILE" << EOF

### Requirement 3: Protect stored cardholder data
EOF
    
    # Check for encryption
    if lsblk -f 2>/dev/null | grep -q "crypt"; then
        echo "- ✅ Disk encryption detected" >> "$REPORT_FILE"
    else
        echo "- ⚠️  No disk encryption detected" >> "$REPORT_FILE"
    fi
    
    cat >> "$REPORT_FILE" << EOF

### Requirement 4: Encrypt transmission of cardholder data
EOF
    
    # Check SSL/TLS
    if command -v openssl &>/dev/null; then
        echo "- ✅ OpenSSL available for encryption" >> "$REPORT_FILE"
    fi
    
    # Check web server SSL
    if netstat -tuln 2>/dev/null | grep -q ":443"; then
        echo "- ✅ HTTPS (port 443) is listening" >> "$REPORT_FILE"
    else
        echo "- ⚠️  No HTTPS service detected" >> "$REPORT_FILE"
    fi
    
    cat >> "$REPORT_FILE" << EOF

### Requirement 8: Identify and authenticate access
EOF
    
    # Check password policy
    if [[ -f /etc/security/pwquality.conf ]]; then
        local minlen=$(grep "^minlen" /etc/security/pwquality.conf 2>/dev/null | awk -F'=' '{print $2}' | tr -d ' ')
        if [[ -n "$minlen" ]] && [[ "$minlen" -ge 8 ]]; then
            echo "- ✅ Password minimum length: $minlen (compliant)" >> "$REPORT_FILE"
        else
            echo "- ⚠️  Password minimum length not configured or too short" >> "$REPORT_FILE"
        fi
    fi
    
    cat >> "$REPORT_FILE" << EOF

### Requirement 10: Track and monitor all access
EOF
    
    # Check audit logging
    if systemctl is-active auditd &>/dev/null; then
        echo "- ✅ Audit logging (auditd) is active" >> "$REPORT_FILE"
    else
        echo "- ⚠️  Audit logging not active" >> "$REPORT_FILE"
    fi
    
    # Check log rotation
    if [[ -f /etc/logrotate.conf ]]; then
        echo "- ✅ Log rotation configured" >> "$REPORT_FILE"
    else
        echo "- ⚠️  Log rotation not configured" >> "$REPORT_FILE"
    fi
    
    echo "" >> "$REPORT_FILE"
}

# HIPAA Checks
check_hipaa() {
    echo -e "${BLUE}🔍 Running HIPAA compliance checks...${NC}"
    
    cat >> "$REPORT_FILE" << EOF
## HIPAA Security Rule Compliance

### Administrative Safeguards
EOF
    
    # Access control
    echo "#### Access Control" >> "$REPORT_FILE"
    
    # Check sudo configuration
    if [[ -f /etc/sudoers ]]; then
        echo "- ✅ Sudo configuration exists" >> "$REPORT_FILE"
    fi
    
    # Check for audit trails
    if systemctl is-active auditd &>/dev/null; then
        echo "- ✅ Audit logging configured" >> "$REPORT_FILE"
    else
        echo "- 🚨 **FAIL:** No audit logging" >> "$REPORT_FILE"
    fi
    
    cat >> "$REPORT_FILE" << EOF

### Physical Safeguards
EOF
    
    echo "#### Workstation Security" >> "$REPORT_FILE"
    
    # Check screen lock
    if command -v vlock &>/dev/null || command -v xscreensaver &>/dev/null; then
        echo "- ✅ Screen lock tools available" >> "$REPORT_FILE"
    else
        echo "- ⚠️  No screen lock tools detected" >> "$REPORT_FILE"
    fi
    
    cat >> "$REPORT_FILE" << EOF

### Technical Safeguards
EOF
    
    echo "#### Encryption and Decryption" >> "$REPORT_FILE"
    
    # Check encryption
    if lsblk -f 2>/dev/null | grep -q "crypt"; then
        echo "- ✅ Disk encryption in use" >> "$REPORT_FILE"
    else
        echo "- 🚨 **FAIL:** No disk encryption (required for ePHI)" >> "$REPORT_FILE"
    fi
    
    # Check SSL/TLS
    if [[ -d /etc/ssl/certs ]] && [[ $(ls -A /etc/ssl/certs 2>/dev/null | wc -l) -gt 0 ]]; then
        echo "- ✅ SSL certificates configured" >> "$REPORT_FILE"
    fi
    
    echo "" >> "$REPORT_FILE"
    echo "#### Access Control" >> "$REPORT_FILE"
    
    # Check authentication
    if grep -q "^auth required pam_faillock.so" /etc/pam.d/common-auth 2>/dev/null; then
        echo "- ✅ Account lockout policy configured" >> "$REPORT_FILE"
    else
        echo "- ⚠️  No account lockout policy" >> "$REPORT_FILE"
    fi
    
    echo "" >> "$REPORT_FILE"
}

# SOC 2 Checks
check_soc2() {
    echo -e "${BLUE}🔍 Running SOC 2 compliance checks...${NC}"
    
    cat >> "$REPORT_FILE" << EOF
## SOC 2 Type II Compliance

### Security (Common Criteria)
EOF
    
    echo "#### CC6.1: Logical and Physical Access Controls" >> "$REPORT_FILE"
    
    # Firewall
    if ufw status 2>/dev/null | grep -q "Status: active" || iptables -L 2>/dev/null | grep -q "Chain INPUT"; then
        echo "- ✅ Network access controls in place" >> "$REPORT_FILE"
    else
        echo "- 🚨 **FAIL:** No firewall configured" >> "$REPORT_FILE"
    fi
    
    # SSH configuration
    if grep -q "^PermitRootLogin no" /etc/ssh/sshd_config 2>/dev/null; then
        echo "- ✅ Root login disabled" >> "$REPORT_FILE"
    else
        echo "- ⚠️  Root login not explicitly disabled" >> "$REPORT_FILE"
    fi
    
    echo "" >> "$REPORT_FILE"
    echo "#### CC6.6: Logical and Physical Access - Monitoring" >> "$REPORT_FILE"
    
    # Monitoring and logging
    if systemctl is-active rsyslog &>/dev/null || systemctl is-active syslog-ng &>/dev/null; then
        echo "- ✅ System logging active" >> "$REPORT_FILE"
    else
        echo "- ⚠️  System logging not detected" >> "$REPORT_FILE"
    fi
    
    if systemctl is-active auditd &>/dev/null; then
        echo "- ✅ Security audit logging active" >> "$REPORT_FILE"
    else
        echo "- ⚠️  No audit logging" >> "$REPORT_FILE"
    fi
    
    echo "" >> "$REPORT_FILE"
    echo "#### CC7.2: System Operations - Data Backup" >> "$REPORT_FILE"
    
    # Check for backup tools
    if command -v restic &>/dev/null || command -v duplicity &>/dev/null || command -v rsync &>/dev/null; then
        echo "- ✅ Backup tools available" >> "$REPORT_FILE"
    else
        echo "- ⚠️  No backup tools detected" >> "$REPORT_FILE"
    fi
    
    # Check cron jobs for backups
    if crontab -l 2>/dev/null | grep -i "backup\|rsync" | grep -v "^#" &>/dev/null; then
        echo "- ✅ Scheduled backup jobs found" >> "$REPORT_FILE"
    else
        echo "- ⚠️  No scheduled backups detected" >> "$REPORT_FILE"
    fi
    
    echo "" >> "$REPORT_FILE"
}

# GDPR Checks
check_gdpr() {
    echo -e "${BLUE}🔍 Running GDPR compliance checks...${NC}"
    
    cat >> "$REPORT_FILE" << EOF
## GDPR Compliance

### Article 32: Security of Processing
EOF
    
    echo "#### Encryption of Personal Data" >> "$REPORT_FILE"
    
    # Check encryption
    if lsblk -f 2>/dev/null | grep -q "crypt"; then
        echo "- ✅ Disk encryption configured" >> "$REPORT_FILE"
    else
        echo "- 🚨 **FAIL:** No disk encryption for personal data protection" >> "$REPORT_FILE"
    fi
    
    # Check SSL/TLS
    if netstat -tuln 2>/dev/null | grep -q ":443"; then
        echo "- ✅ HTTPS available for secure data transmission" >> "$REPORT_FILE"
    else
        echo "- ⚠️  HTTPS not detected" >> "$REPORT_FILE"
    fi
    
    echo "" >> "$REPORT_FILE"
    echo "#### Access Controls" >> "$REPORT_FILE"
    
    # Check authentication mechanisms
    if [[ -f /etc/security/pwquality.conf ]]; then
        echo "- ✅ Password quality requirements configured" >> "$REPORT_FILE"
    else
        echo "- ⚠️  No password quality enforcement" >> "$REPORT_FILE"
    fi
    
    echo "" >> "$REPORT_FILE"
    echo "#### Logging and Monitoring" >> "$REPORT_FILE"
    
    # Check audit logging
    if systemctl is-active auditd &>/dev/null; then
        echo "- ✅ Audit logging for data access tracking" >> "$REPORT_FILE"
    else
        echo "- 🚨 **FAIL:** No audit logging (required for GDPR accountability)" >> "$REPORT_FILE"
    fi
    
    echo "" >> "$REPORT_FILE"
}

# Generate compliance score
generate_score() {
    local framework="$1"
    
    local total=$(grep -cE "^- (✅|🚨|⚠️)" "$REPORT_FILE" 2>/dev/null || echo "1")
    local passed=$(grep -c "^- ✅" "$REPORT_FILE" 2>/dev/null || echo "0")
    local failed=$(grep -c "^- 🚨" "$REPORT_FILE" 2>/dev/null || echo "0")
    local warnings=$(grep -c "^- ⚠️" "$REPORT_FILE" 2>/dev/null || echo "0")
    
    local score=$(( (passed * 100) / total ))
    
    cat >> "$REPORT_FILE" << EOF

## Compliance Summary

- **Framework:** $framework
- **Total Checks:** $total
- **Passed:** $passed (${score}%)
- **Failed (Critical):** $failed
- **Warnings:** $warnings

### Compliance Score: $score/100

EOF
    
    if [[ $score -ge 90 ]]; then
        echo "**Status:** ✅ Highly Compliant" >> "$REPORT_FILE"
    elif [[ $score -ge 70 ]]; then
        echo "**Status:** ⚠️  Partially Compliant" >> "$REPORT_FILE"
    else
        echo "**Status:** 🚨 Non-Compliant" >> "$REPORT_FILE"
    fi
    
    echo "" >> "$REPORT_FILE"
}

# Generate recommendations
generate_recommendations() {
    cat >> "$REPORT_FILE" << EOF

## Recommended Actions

### Critical Issues (Fix Immediately)
EOF
    
    grep "^- 🚨" "$REPORT_FILE" | sed 's/^- 🚨/1./' >> "$REPORT_FILE"
    
    cat >> "$REPORT_FILE" << EOF

### Warnings (Fix Within 30 Days)
EOF
    
    grep "^- ⚠️" "$REPORT_FILE" | sed 's/^- ⚠️/1./' | head -10 >> "$REPORT_FILE"
    
    cat >> "$REPORT_FILE" << EOF

### General Recommendations
1. Conduct regular compliance audits
2. Document all security procedures
3. Train staff on compliance requirements
4. Implement automated compliance monitoring
5. Regular third-party assessments

---

**Report generated by AI Security Scanner - Compliance Module**
EOF
}

# Main function
main() {
    local framework="pci-dss"
    local notify=false
    local verbose=false
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -f|--framework)
                framework="$2"
                shift 2
                ;;
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
    
    FRAMEWORK="$framework"
    
    echo -e "${GREEN}🛡️  Compliance Framework Scanner${NC}\n"
    echo -e "${BLUE}Framework: $framework${NC}\n"
    
    # Initialize
    init_report
    
    # Run checks based on framework
    case "$framework" in
        pci-dss)
            check_pci_dss
            generate_score "PCI-DSS 3.2.1"
            ;;
        hipaa)
            check_hipaa
            generate_score "HIPAA Security Rule"
            ;;
        soc2)
            check_soc2
            generate_score "SOC 2 Type II"
            ;;
        gdpr)
            check_gdpr
            generate_score "GDPR"
            ;;
        all)
            check_pci_dss
            check_hipaa
            check_soc2
            check_gdpr
            generate_score "Multi-Framework"
            ;;
        *)
            echo -e "${RED}Unknown framework: $framework${NC}"
            usage
            ;;
    esac
    
    # Recommendations
    generate_recommendations
    
    echo ""
    echo -e "${GREEN}✅ Compliance scan complete!${NC}"
    echo -e "${BLUE}📄 Report: $REPORT_FILE${NC}\n"
    
    # Display summary
    echo -e "${CYAN}Summary:${NC}"
    grep -E "^- (✅|🚨|⚠️)" "$REPORT_FILE" | head -15
    
    # Notification
    if [[ "$notify" == "true" ]] && [[ -f "$SCRIPT_DIR/../integrations/notify.sh" ]]; then
        "$SCRIPT_DIR/../integrations/notify.sh" \
            --platform all \
            --title "Compliance Scan Complete ($framework)" \
            --file "$REPORT_FILE" \
            --severity "info" || true
    fi
}

# Run
main "$@"
